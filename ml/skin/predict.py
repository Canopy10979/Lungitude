"""Offline research inference on a dataset dermoscopic image. Not a user scanner."""
import argparse
import json

import torch
from PIL import Image
from torchvision.models import EfficientNet_B0_Weights
from train import CLASSES, LABELS, build_model, weights_for


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--checkpoint', default='ml/skin/output/model.pt')
    parser.add_argument('--image', required=True)
    parser.add_argument('--dermoscopy-dataset-image', action='store_true',
                        help='Confirm this is a dermoscopic dataset image, not a webcam/user photo')
    args = parser.parse_args()
    if not args.dermoscopy_dataset_image:
        parser.error('This research model is restricted to dermoscopic dataset images.')
    checkpoint = torch.load(args.checkpoint, map_location='cpu', weights_only=True)
    if checkpoint.get('classes') != CLASSES or checkpoint.get('modality') != 'dermoscopy':
        raise ValueError('Checkpoint has incompatible labels or image modality')
    architecture = checkpoint.get('architecture', 'efficientnet_b0')
    model = build_model(architecture=architecture); model.load_state_dict(checkpoint['state_dict']); model.eval()
    with Image.open(args.image) as image:
        x = weights_for(architecture).transforms()(image.convert('RGB')).unsqueeze(0)
    with torch.inference_mode():
        scores = torch.softmax(model(x), dim=1)[0].tolist()
    print(json.dumps({'research_only': True, 'modality': 'dermoscopy',
                      'notice': 'Uncalibrated class scores, not your probability of cancer. No diagnosis or clinical recommendation.',
                      'scores': [{'class': c, 'label': LABELS[c], 'score': float(s)}
                                 for c, s in zip(CLASSES, scores)]}, indent=2))


if __name__ == '__main__':
    main()
