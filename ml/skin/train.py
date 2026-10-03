"""Research-only HAM10000 lesion classifier; NOT validated for user photos.
Usage: python ml/skin/train.py --metadata PATH/HAM10000_metadata.csv --images PATH/images --epochs 10
All training/evaluation images must come from the licensed dataset. Seven lesion
categories are retained; these are not equivalent to seven cancers.
"""
import argparse
import json
import random
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from PIL import Image
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import GroupShuffleSplit
from torch import nn
from torch.utils.data import DataLoader, Dataset
from torchvision.models import (EfficientNet_B0_Weights, efficientnet_b0,
                                MobileNet_V3_Small_Weights, mobilenet_v3_small)

CLASSES = ['akiec', 'bcc', 'bkl', 'df', 'mel', 'nv', 'vasc']
PAD_CLASSES = ['ACK', 'BCC', 'MEL', 'NEV', 'SCC', 'SEK']
LABELS = {
    'akiec': 'Actinic keratoses and intraepithelial carcinoma / Bowen disease',
    'bcc': 'Basal cell carcinoma', 'bkl': 'Benign keratosis-like lesions',
    'df': 'Dermatofibroma', 'mel': 'Melanoma', 'nv': 'Melanocytic nevi',
    'vasc': 'Vascular lesions',
}


def split_metadata(frame):
    """Same lesion never crosses partitions. HAM10000 lacks full patient IDs;
    lesion-disjoint is not a guarantee of patient-disjoint evaluation.
    """
    first = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
    development, test = next(first.split(frame, groups=frame['group_id'] if 'group_id' in frame else frame['lesion_id']))
    dev = frame.iloc[development]
    second = GroupShuffleSplit(n_splits=1, test_size=0.1875, random_state=43)
    train, validation = next(second.split(dev, groups=dev['group_id'] if 'group_id' in dev else dev['lesion_id']))
    parts = [dev.iloc[train].copy(), dev.iloc[validation].copy(), frame.iloc[test].copy()]
    groups = [set(p['group_id'] if 'group_id' in p else p['lesion_id']) for p in parts]
    assert not (groups[0] & groups[1] or groups[0] & groups[2] or groups[1] & groups[2])
    for part, name in zip(parts, ['train', 'validation', 'test']):
        missing = set(CLASSES) - set(part['dx'])
        if missing:
            raise ValueError(f'{name} lacks classes {missing}; obtain a documented split with coverage before training.')
    return parts


class Lesions(Dataset):
    def __init__(self, frame, files, transform):
        self.frame = frame.reset_index(drop=True)
        self.files = files
        self.transform = transform

    def __len__(self):
        return len(self.frame)

    def __getitem__(self, i):
        row = self.frame.iloc[i]
        with Image.open(self.files[row['image_id']]) as image:
            tensor = self.transform(image.convert('RGB'))
        return tensor, CLASSES.index(row['dx'])


def build_model(pretrained=False, architecture='efficientnet_b0', classes=None):
    classes = classes or CLASSES
    if architecture == 'mobilenet_v3_small':
        model = mobilenet_v3_small(weights=MobileNet_V3_Small_Weights.DEFAULT if pretrained else None)
        model.classifier[-1] = nn.Linear(model.classifier[-1].in_features, len(classes))
    elif architecture == 'efficientnet_b0':
        model = efficientnet_b0(weights=EfficientNet_B0_Weights.DEFAULT if pretrained else None)
        model.classifier[-1] = nn.Linear(model.classifier[-1].in_features, len(classes))
    else:
        raise ValueError('Unsupported architecture')
    return model


def weights_for(architecture):
    return MobileNet_V3_Small_Weights.DEFAULT if architecture == 'mobilenet_v3_small' else EfficientNet_B0_Weights.DEFAULT


@torch.no_grad()
def evaluate(model, loader, device):
    model.eval()
    truth, predicted = [], []
    for x, y in loader:
        predicted.extend(model(x.to(device)).argmax(1).cpu().tolist())
        truth.extend(y.tolist())
    report = classification_report(truth, predicted, labels=list(range(len(CLASSES))),
                                   target_names=CLASSES, output_dict=True, zero_division=0)
    matrix = confusion_matrix(truth, predicted, labels=list(range(len(CLASSES)))).tolist()
    return report, matrix


def main():
    global CLASSES
    parser = argparse.ArgumentParser()
    parser.add_argument('--dataset', choices=['ham10000', 'pad_ufes20'], default='ham10000')
    parser.add_argument('--architecture', choices=['efficientnet_b0', 'mobilenet_v3_small'], default='efficientnet_b0')
    parser.add_argument('--metadata', required=True)
    parser.add_argument('--images', required=True, help='Directory containing both extracted image parts; searches recursively')
    parser.add_argument('--epochs', type=int, default=10)
    parser.add_argument('--batch-size', type=int, default=16)
    parser.add_argument('--output', default='ml/skin/output')
    args = parser.parse_args()
    if args.epochs < 1 or args.batch_size < 1:
        parser.error('epochs and batch-size must be positive')
    random.seed(42); np.random.seed(42); torch.manual_seed(42)
    frame = pd.read_csv(args.metadata, dtype={'image_id': str, 'lesion_id': str, 'dx': str})
    if args.dataset == 'pad_ufes20':
        CLASSES = PAD_CLASSES.copy()
        required = {'img_id', 'diagnostic', 'patient_id', 'lesion_id'}
        if not required.issubset(frame.columns):
            raise ValueError(f'PAD metadata must include {required}')
        frame = frame.rename(columns={'img_id':'image_id', 'diagnostic':'dx'})
        frame['image_id'] = frame['image_id'].map(lambda v: Path(str(v)).stem)
        if frame['patient_id'].isna().any():
            raise ValueError('Patient IDs are required for PAD splits')
        frame['group_id'] = frame['patient_id'].astype(str)
    else:
        frame['group_id'] = frame['lesion_id']
    for col in ['image_id', 'lesion_id', 'dx']:
        if col not in frame or frame[col].isna().any():
            raise ValueError(f'Missing/empty {col}')
    if frame['image_id'].duplicated().any() or not set(frame['dx']).issubset(CLASSES):
        raise ValueError('Duplicate images or unsupported diagnosis labels')
    files = {}
    for path in Path(args.images).rglob('*'):
        if path.suffix.lower() in {'.jpg', '.jpeg', '.png'}:
            if path.stem in files:
                raise ValueError(f'Duplicate image filename: {path.stem}')
            files[path.stem] = path
    missing = set(frame.image_id) - set(files)
    if missing:
        raise ValueError(f'{len(missing)} metadata images missing from image directory')
    train, validation, test = split_metadata(frame)
    output = Path(args.output); output.mkdir(parents=True, exist_ok=True)
    for part, name in zip([train, validation, test], ['train', 'validation', 'test']):
        part.to_csv(output / f'{name}_split.csv', index=False)
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    transform = weights_for(args.architecture).transforms()
    loaders = [DataLoader(Lesions(part, files, transform), batch_size=args.batch_size,
                          shuffle=i == 0, num_workers=0)
               for i, part in enumerate([train, validation, test])]
    model = build_model(pretrained=True, architecture=args.architecture).to(device)
    # Transfer-learning baseline: train the replacement classifier first.
    for parameter in model.features.parameters():
        parameter.requires_grad = False
    counts = np.bincount([CLASSES.index(x) for x in train.dx], minlength=len(CLASSES))
    weights = torch.tensor(len(train) / (len(CLASSES) * counts), dtype=torch.float32, device=device)
    criterion = nn.CrossEntropyLoss(weight=weights)
    optimizer = torch.optim.AdamW(model.classifier.parameters(), lr=1e-3, weight_decay=1e-4)
    best = -1.0
    for epoch in range(args.epochs):
        model.train(); model.features.eval()  # Preserve pretrained BatchNorm statistics.
        total = 0.0
        for x, y in loaders[0]:
            x, y = x.to(device), y.to(device)
            optimizer.zero_grad()
            loss = criterion(model(x), y)
            loss.backward(); optimizer.step()
            total += loss.item() * len(y)
        report, _ = evaluate(model, loaders[1], device)
        score = report['macro avg']['f1-score']
        print(f'Epoch {epoch+1}: train loss={total/len(train):.4f}, validation macro F1={score:.4f}')
        if score > best:
            best = score
            torch.save({'state_dict': model.state_dict(), 'classes': CLASSES,
                        'modality': 'clinical_photo' if args.dataset == 'pad_ufes20' else 'dermoscopy',
                        'architecture': args.architecture, 'dataset': args.dataset, 'research_only': True}, output / 'model.pt')
    checkpoint = torch.load(output / 'model.pt', map_location=device, weights_only=True)
    model.load_state_dict(checkpoint['state_dict'])
    report, matrix = evaluate(model, loaders[2], device)
    result = {'classes': CLASSES, 'test_report': report, 'confusion_matrix': matrix,
              'best_validation_macro_f1': best,
              'split_counts': {n: {'images': len(p), 'lesions': p.lesion_id.nunique(), 'split_groups': p.group_id.nunique()}
                               for n, p in zip(['train', 'validation', 'test'], [train, validation, test])},
              'limitations': ['Patient-disjoint PAD split.' if args.dataset == 'pad_ufes20' else 'Lesion-disjoint HAM split; full patient IDs unavailable.',
                              'No external validation, calibration, or webcam validation.',
                              'Not intended to diagnose users.'],
              'research_only': True, 'dataset': args.dataset, 'architecture': args.architecture}
    (output / 'evaluation.json').write_text(json.dumps(result, indent=2))
    print('Saved research checkpoint and holdout evaluation. No clinical performance claimed.')


if __name__ == '__main__':
    main()
