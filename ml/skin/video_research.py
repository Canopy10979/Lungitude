"""Research-only frame ensemble, NOT a trained temporal model or a clinical scanner.
Requires a PAD-UFES20 clinical-photo checkpoint and consented research video.
Correlated video frames are not independent evidence; scores aren't probabilities
of cancer and do not establish lesions, skin identity, or input validity.
"""
import argparse
import json

import cv2
import numpy as np
import torch
from PIL import Image
from train import build_model, weights_for, PAD_CLASSES


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--video', required=True)
    p.add_argument('--checkpoint', required=True)
    p.add_argument('--research-recording', action='store_true')
    args = p.parse_args()
    if not args.research_recording:
        p.error('Confirm this is a consented research recording; no clinical results are provided.')
    ckpt = torch.load(args.checkpoint, map_location='cpu', weights_only=True)
    if ckpt.get('dataset') != 'pad_ufes20' or ckpt.get('classes') != PAD_CLASSES:
        raise ValueError('Use a PAD clinical-photo checkpoint; dermoscopy weights are incompatible.')
    architecture = ckpt['architecture']
    model = build_model(architecture=architecture, classes=ckpt['classes'])
    model.load_state_dict(ckpt['state_dict']); model.eval()
    transform = weights_for(architecture).transforms()
    cap = cv2.VideoCapture(args.video)
    fps = cap.get(cv2.CAP_PROP_FPS)
    if not cap.isOpened() or not np.isfinite(fps) or fps <= 0:
        cap.release(); raise ValueError('Cannot decode video or determine frame rate.')
    # At most two sampled frames per second and 60 samples. Brightness thresholds
    # are capture heuristics only and can behave differently across skin tones.
    stride = max(1, round(fps / 2)); i = 0; sampled = 0; accepted = []
    with torch.inference_mode():
        while sampled < 60:
            ok, frame = cap.read()
            if not ok: break
            if i % stride == 0:
                sampled += 1
                h, w = frame.shape[:2]
                side = min(h, w); y = (h-side)//2; x = (w-side)//2
                crop = frame[y:y+side, x:x+side]
                gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
                # Reject extreme exposures only; this is not an image-validity model.
                if side >= 224 and 15 < float(gray.mean()) < 240:
                    image = Image.fromarray(cv2.cvtColor(crop, cv2.COLOR_BGR2RGB))
                    accepted.append(torch.softmax(model(transform(image).unsqueeze(0)), dim=1)[0].numpy())
            i += 1
    cap.release()
    if len(accepted) < 3:
        raise ValueError('Fewer than three usable sampled frames; no model summary produced.')
    scores = np.stack(accepted)
    average = scores.mean(0)
    out = {'research_only': True, 'method': 'Mean of correlated frame class scores',
           'notice': 'Video domain is unvalidated. Not a cancer diagnosis or patient risk estimate.',
           'sampled_frames': sampled, 'accepted_frames': len(accepted),
           'scores': {c: float(v) for c, v in zip(ckpt['classes'], average)},
           'per_class_frame_std': {c: float(v) for c, v in zip(ckpt['classes'], scores.std(0))}}
    print(json.dumps(out, indent=2))


if __name__ == '__main__': main()
