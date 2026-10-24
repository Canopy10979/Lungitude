# Train/validation/test and recording-time research

## What is implemented vs trained

Six image architectures are supported by the shared registry: MobileNetV3 Small, EfficientNet-B0, ViT-B/16, ResNet-18, DenseNet-121 and ConvNeXt-Tiny. These are comparison baselines; adding architectures does not establish higher accuracy, calibrated probabilities or better national statistics. All use ImageNet transfer learning with frozen backbones and trained replacement heads. A fresh skin training run still requires actual labeled skin images/metadata. No synthetic/random-weight model is installed as a cancer classifier.

Four Wisconsin breast-cell baselines were actually fit in this execution environment on the supplied Cancer_Data.csv: logistic regression, SVM, random forest and histogram gradient boosting. The 569 rows are split into 341 training, 114 validation, 114 test records. Selection uses validation average precision only; logistic regression was selected. All four checkpoints and their per-model validation/test reports are saved locally in ignored ml/tabular/output_breast/. The aggregate reproducible evidence is committed at ml/reports/breast_three_way_evaluation.json. Binaries are not committed; run the commands below on Windows to create them locally. Repeatedly rerunning/tuning on this test set would invalidate its status as an untouched evaluation.

This updates the previous breast evaluation protocol. Do not quote old confusion matrices alongside the new partition. These are sampled-cell research classifiers and cannot analyze skin images or breast photographs. The breast UI continues to use the validation-selected model, not an average of unrelated outputs.

## Split guarantees

- Skin: approximately 65/15/20 by groups, with fixed split seeds. PAD groups patient IDs, lesion IDs and exact file hashes across all six architectures. HAM groups lesions and exact hashes; full patient IDs are not available. Class coverage is required in every partition. Exact hashes do not detect resized or re-encoded duplicates.
- Breast: approximately 60/20/20, with identical predictor rows kept together. Train-only imputation/scaling; four models fit training records only. Validation selects the model. No test-based selection or refit on validation records.
- Skin output: train_split.csv, validation_split.csv, test_split.csv, split_audit.json, model.pt and evaluation.json in each model's output directory. The audit contains class counts and a data/split fingerprint to compare across models. Each model uses validation macro-F1 to select its best epoch; test is evaluated only after the best epoch is restored.
- Breast output: split_audit.json records row/group membership and source-file hash. Each candidate has a .joblib and _evaluation.json; model.joblib is the validation-selected checkpoint. Evaluation includes per-class precision/recall/F1 and confusion matrices.
- Freeze data and partitions before model comparison. Use validation for decisions and collect a new external cohort before claiming final performance after repeated experimentation. No calibrated personal cancer probability or clinical validation is claimed.

## Windows: get the changes

In PowerShell, from the isolated training worktree (keep other terminals running from this same folder):

```powershell
cd C:\Users\rishi\Downloads\Lungitude-Training
git fetch origin
git merge --ff-only origin/codex/model-training-and-signal-research
```

Train all four breast candidates using the actual location of your CSV:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Train-Models.ps1 -BreastOnly -BreastInput "C:\Users\rishi\Downloads\Cancer_Data.csv"
```

For smartphone-photo research, download/extract the PAD-UFES-20 images and metadata from https://data.mendeley.com/datasets/zr7vgbcyr2/1 and observe its license/attribution. The six categories are not six cancers; some are benign lesions or precancerous conditions. Metadata alone is not training data. Put images in data/pad_ufes20/images and metadata.csv in data/pad_ufes20, or pass your actual paths.

Start with the fast model (one epoch is only an installation check, not completed model development):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Train-Models.ps1 -SkinOnly -SkinArchitectures mobilenet_v3_small -SkinMetadata .\data\pad_ufes20\metadata.csv -SkinImages .\data\pad_ufes20\images -Epochs 10
```

Then compare all six, preferably on a GPU or with ample time. It can be slow on a laptop and no completion time is promised:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Train-Models.ps1 -SkinOnly -SkinMetadata .\data\pad_ufes20\metadata.csv -SkinImages .\data\pad_ufes20\images -Epochs 10
```

Use -SkinArchitectures to run a subset. Compare identical split fingerprints in each output folder before reporting a comparison. Do not combine HAM and PAD category scores: the label spaces and acquisition modalities differ. Only matching PAD checkpoints are accepted by the active clinical-photo service.

Restart start-imaging.bat after replacing checkpoints; keep php -S localhost:8000 router.php running. On http://localhost:8000, complete account/profile consent, open the camera, then optionally select experimental live AI preview before recording. iPhone live camera requires a reachable HTTPS deployment; iPhone localhost is the phone itself.

## Recording-time behavior and limitations

Lighting, motion and sharpness guidance runs locally without a trained classifier. These heuristics are not validated focus/lesion-quality tests and do not detect cancer. Optional live preview requires a separate unchecked opt-in plus analysis consent. It sends at most two sampled stills at least 2.5 seconds apart, with only one preview request in flight and no raw video upload. The server uses an installed compatible MobileNetV3, ResNet-18 or EfficientNet-B0 checkpoint, in that order. Results are preliminary uncalibrated category scores, not personal risk. It is possible that a slow response never arrives before the eight-second recording finishes.

After recording, the selected still runs through all installed compatible skin models. No trained temporal model, video-motion diagnosis, or validated lesion detector has been supplied. Models sharing training data are correlated; their agreement is not independent clinical evidence and their scores are not averaged into a cancer probability. National registry statistics remain separate and are not learned from this dataset.

Stopping/backgrounding/consent withdrawal aborts pending previews, clears the preview display and ignores late responses. Server-side work already started may still finish. Inference runs in a worker thread with a lock for CPU work so it does not directly block the async event loop. This is a local prototype; bounded browser requests do not replace production queueing, authentication/rate limiting, resource limits or latency benchmarking.

## Verification

All six architectures were instantiated with six output classes and passed CPU forward/head/preprocessing checks using synthetic tensors. This verifies architecture wiring, not skin model training or accuracy. Automated API/state tests cover consent, absent checkpoints, one-fast-model preview routing, registration race protection and ignoring a late live response after consent withdrawal. Real browser/iPhone camera testing and actual skin-dataset training remain outstanding. Playwright browser execution was attempted but the Chromium executable was not installed in this environment.

Primary references: https://docs.pytorch.org/vision/main/models/ ; https://data.mendeley.com/datasets/zr7vgbcyr2/1 .

## Recording warning screen

Every new recording requires an acknowledgment screen stating that the feature is for the Congressional App Challenge research prototype/data demonstration and that users should consult a medical professional for diagnoses. A reminder stays visible in the capture area. The warning does not authorize collection for training or imply enrollment in a research study. Continue rechecks capture readiness/consent before starting; Go back and Escape do not start a recording.
