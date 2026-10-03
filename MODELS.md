# Remaining model work

No trained checkpoints are installed.

| Component | Current status | Data needed |
|---|---|---|
| MobileNetV3-Small skin classifier | Trainer and research inference endpoint ready; untrained | PAD-UFES-20 clinical photos and metadata; split by patient |
| EfficientNet-B0 skin classifier | Trainer and research inference endpoint ready; untrained | Same PAD-UFES-20 split for a baseline comparison |
| Lung-sound Logistic Regression | Training script ready; no exported model | ICBHI 2017 respiratory recordings; split by patient |
| Automatic lesion segmentation | Not implemented; manual outlines used | Expert lesion masks matched to suitable images |
| Temporal/video model | Not implemented; video script only averages image-frame scores | Labeled real sequences with patient-level splits |
| Vascular segmentation | Not implemented; ordinary webcam vessels cannot be assumed measurable | Suitable dermoscopic images with expert vessel masks |

Live zoom boxes are manually positioned regions; they do not require training and do not track a person. Shape, color, texture and calibrated follow-up comparison use descriptive algorithms, not trained cancer models. No lung, pancreatic or colon cancer imaging model is implemented; those need suitable clinical imaging and independently validated workflows.

Start with the MobileNet training command in ml/skin/README.md, then evaluate on held-out patients before exposing any research scores. ImageNet initialization is not cancer training. No current output is a cancer diagnosis.
