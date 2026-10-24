# Research prototypes

The main PHP survey does not depend on these experiments. No trained checkpoints are supplied.

| Component | Status |
| --- | --- |
| MobileNetV3-Small / EfficientNet-B0 | Training and inference scripts only; no trained skin model |
| Lung-sound logistic regression | ICBHI training script only; no exported model |
| Lesion outline | Manual outline; no validated segmentation |
| Shape, color and texture | Descriptive algorithms; not a malignancy classifier |
| Dated follow-up | Measurement comparison with attempted registration; not validated biological growth |
| Video experiment | Frame aggregation; no trained temporal model |
| Vascular analysis | Not implemented; requires suitable imaging and validation |
| Live zoom regions | Manual regions; no automatic person or pulse-point tracking |

Setup and dataset prerequisites remain in `ml/skin/README.md`. Preserve patient-level splits and report actual held-out evaluation before exposing any experimental model. ImageNet initialization is not cancer training. This document consolidates the former frontend, GitHub setup and model notes; current startup, privacy and validation live in the root README.
