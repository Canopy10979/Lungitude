"""Offline research inference on a dataset dermoscopic image. Not a user scanner."""

import argparse
import json

import torch
from PIL import Image
from torchvision.models import EfficientNet_B0_Weights
from train import CLASSES, PAD_CLASSES, LABELS, build_model, weights_for


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", default="ml/skin/output/model.pt")
    parser.add_argument("--image", required=True)
    parser.add_argument(
        "--dermoscopy-dataset-image",
        action="store_true",
        help="Confirm this is a dermoscopic dataset image, not a webcam/user photo",
    )
    parser.add_argument(
        "--clinical-dataset-image",
        action="store_true",
        help="Confirm a PAD-UFES-20 research dataset image, not a user diagnostic scan",
    )
    parser.add_argument("--threads", type=int, default=4)
    args = parser.parse_args()
    torch.set_num_threads(max(1, args.threads))
    checkpoint = torch.load(args.checkpoint, map_location="cpu", weights_only=True)
    clinical = checkpoint.get("dataset") == "pad_ufes20"
    expected_classes = PAD_CLASSES if clinical else CLASSES
    expected_modality = "clinical_photo" if clinical else "dermoscopy"
    confirmed = (
        args.clinical_dataset_image if clinical else args.dermoscopy_dataset_image
    )
    if not confirmed:
        parser.error("Confirm the appropriate research dataset image modality.")
    if (
        checkpoint.get("classes") != expected_classes
        or checkpoint.get("modality") != expected_modality
    ):
        raise ValueError("Checkpoint has incompatible labels or image modality")
    architecture = checkpoint.get("architecture", "efficientnet_b0")
    model = build_model(architecture=architecture, classes=expected_classes)
    model.load_state_dict(checkpoint["state_dict"])
    model.eval()
    with Image.open(args.image) as image:
        x = weights_for(architecture).transforms()(image.convert("RGB")).unsqueeze(0)
    with torch.inference_mode():
        scores = torch.softmax(model(x), dim=1)[0].tolist()
    print(
        json.dumps(
            {
                "research_only": True,
                "modality": expected_modality,
                "notice": "Uncalibrated class scores, not your probability of cancer. No diagnosis or clinical recommendation.",
                "scores": [
                    {"class": c, "label": LABELS.get(c, c), "score": float(s)}
                    for c, s in zip(expected_classes, scores)
                ],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
