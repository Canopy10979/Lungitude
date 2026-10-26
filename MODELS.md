# Published trained research models

Three trained research artifacts are included in this repository. **None is clinically validated, calibrated for user cancer probability, or suitable for deciding that a lesion or symptom is safe.** The survey is independent of these models.

## Artifacts and measured test performance

| Model | Artifact | Held-out test accuracy | Macro F1 | Evaluation |
| --- | --- | ---: | ---: | --- |
| MobileNetV3-Small | [ml/skin/output_mobile/model.pt](ml/skin/output_mobile/model.pt) | 60.1% | 0.530 | [ml/skin/output_mobile/evaluation.json](ml/skin/output_mobile/evaluation.json) |
| EfficientNet-B0 | [checkpoint parts](ml/skin/output_efficient/) | 58.8% | 0.510 | [ml/skin/output_efficient/evaluation.json](ml/skin/output_efficient/evaluation.json) |
| Lung-sound logistic regression | [data/lung_model.json](data/lung_model.json) | 35.2% | 0.283 | [data/lung_model_evaluation.json](data/lung_model_evaluation.json) |

Scores describe the fixed dataset test partitions below, not real-world cancer-detection accuracy. Checkpoint SHA-256 hashes, sizes and class ordering are recorded in [models/manifest.json](models/manifest.json).

## Skin baselines

Both models use ImageNet-initialized Torchvision backbones with frozen feature parameters and a replacement classifier trained for 20 epochs. The epoch with the best validation macro F1 was selected (epoch 12 for both). Deterministic backbone features are cached once to make CPU training practical; only the classifier is optimized. These are transfer-learning baselines, not networks trained from scratch.

Data: PAD-UFES-20 v1, [Pacheco et al., 2020](https://doi.org/10.1016/j.dib.2020.106221), [dataset DOI](https://doi.org/10.17632/zr7vgbcyr2.1), CC BY 4.0. The original Mendeley API was inaccessible here, so data was obtained from documented mirrors. All 2,298 expected images were checked against the metadata, and 1,692 overlapping files matched byte-for-byte across mirrors. Provenance and archive hashes are in `models/data_provenance.json`.

Fixed split seeds 42/43; grouping by patient ID:

| Partition | Images | Patients |
| --- | ---: | ---: |
| Training | 1,497 | 892 |
| Validation | 340 | 206 |
| Test | 461 | 275 |

There is no patient overlap. The dataset contains 2,283 unique image-byte hashes among 2,298 images; **no exact-image hash crosses partitions**. Near-duplicate similarity and external datasets were not audited. Multiple images from a patient are not independent clinical observations.

### Per-class test recall (sensitivity within this dataset)

| Class | Meaning | Test images | MobileNetV3-Small | EfficientNet-B0 |
| --- | --- | ---: | ---: | ---: |
| ACK | Actinic keratosis | 127 | 72.4% | 64.6% |
| BCC | Basal cell carcinoma | 174 | 62.1% | 59.2% |
| MEL | Melanoma | 7 | 57.1% | 42.9% |
| NEV | Nevus | 49 | 65.3% | 75.5% |
| SCC | Squamous cell carcinoma / Bowen disease | 49 | 12.2% | 10.2% |
| SEK | Seborrheic keratosis | 55 | 63.6% | 74.5% |

**Important failures:** each model misses most SCC test images. Melanoma has only seven test images, so melanoma recall is highly uncertain. A majority-class BCC prediction gives 37.7% accuracy on this test set; accuracy alone does not measure clinical usefulness. Class scores are uncalibrated. There is no external, prospective, webcam, skin-tone subgroup or clinical validation. The original labels include benign and premalignant conditions; these are not six cancer types.

## Lung-sound baseline

Logistic regression was trained on 97 deterministic audio features per annotated breathing cycle from ICBHI 2017. The source contains 920 recordings from 126 patients; the existing minimum-duration rule excludes six very short cycles, leaving 6,892 cycles. A fixed GroupShuffleSplit (seed 7, patient grouping, 30% of patients for test) gives 5,433 training cycles from 88 patients and 1,459 test cycles from 38 different patients. The official split file was not supplied by the mirror, so **this is not an official-split benchmark**.

Measured ICBHI score: **0.346**, normal specificity **41.5%**, abnormal-class sensitivity **27.6%**. Test accuracy is **35.2%**, below the majority-class accuracy of **54.4%**. This is a weak baseline. Rounded exported JSON weights reproduced all held-out predictions in the export check.

Classes: normal, crackle, wheeze, both. These are sound labels, not cancer labels or disease diagnoses. Training recordings were acquired with clinical respiratory-recording equipment; phone microphones and home recordings are a domain shift. No phone or clinical validation was performed. The official source makes the database available for research; the mirror lists its license as unknown. No raw audio is redistributed, and this publication does not assert commercial data rights.

## Reproduce

Tested on Python 3.12, Torch 2.14.1+cpu, Torchvision 0.29.1+cpu, NumPy 2.5.2, Pandas 2.2.3, SciPy 1.17.0 and scikit-learn 1.8.0. Install the existing research requirements in a virtual environment; CPU-specific Torch wheels are available from the official PyTorch index. No Python dependencies are needed for the main PHP survey.

The EfficientNet checkpoint is published as `model.pt.part1`, `model.pt.part2` and `model.pt.part3` because the publication connector limits request sizes. Before inference or artifact tests, reconstruct the exact original checkpoint with `python models/restore_checkpoints.py`. The script verifies its size and SHA-256 against the manifest; no retraining is involved.

Obtain the datasets under their original terms, place PAD metadata/images under `ml/skin/pad/` and ICBHI WAV/annotation pairs under `ml/icbhi/`, then run from the repository root:

```sh
python ml/skin/train.py --dataset pad_ufes20 --architecture mobilenet_v3_small --metadata ml/skin/pad/metadata.csv --images ml/skin/pad/images --epochs 20 --batch-size 16 --cache-features --threads 2 --output ml/skin/output_mobile
python ml/skin/train.py --dataset pad_ufes20 --architecture efficientnet_b0 --metadata ml/skin/pad/metadata.csv --images ml/skin/pad/images --epochs 20 --batch-size 16 --cache-features --threads 2 --output ml/skin/output_efficient
python ml/train_icbhi.py ml/icbhi
python tests/test_model_artifacts.py
```

Checkpoints were reloaded for held-out evaluation. Both skin artifacts were tested through the existing research inference service; missing image-upload consent was rejected. No raw images, audio, patient metadata or split CSV files are included in Git.

Torchvision architecture code and pretrained initialization retain their upstream terms and credits. Dataset attribution does not confer clinical approval or endorsement. This work used AI-assisted implementation and automated training; the student must accurately disclose this assistance and review the code, experiments and limitations.
