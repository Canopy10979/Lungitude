# Train and run in C:\Users\rishi\Downloads\Lungitude

This document supersedes earlier skin-only scope notes. The UI now has two separate tasks: iPhone skin capture and sampled-cell breast research. Model weights are not combined: the datasets contain different organs, patients, labels and input modalities. There is no paired training data to learn a validated fusion model. A unified UI routes each input to its corresponding model.

## Get this version

Save or commit your existing local edits first. Git switch will refuse conflicting edits; do not force it.

```powershell
cd "C:\Users\rishi\Downloads\Lungitude"
git fetch origin
git switch codex/model-training-and-signal-research
git pull --ff-only origin codex/model-training-and-signal-research
```

If that branch doesn't exist locally, `git switch --track origin/codex/model-training-and-signal-research` creates it. Main has not been merged. These commands must run on your Windows computer; this session only modifies the shared checkout/GitHub.

## Train the breast model now

`Cancer_Data.csv` and the Wisconsin ZIP are the same 569 records; use one, never concatenate them. The CSV adapter now requires named features and reorders them to the canonical 30-field schema so a reordered CSV cannot silently change feature meaning. A fresh run is required for older checkpoints with generic feature names.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Train-Models.ps1 -BreastOnly -BreastInput "C:\Users\rishi\Downloads\Cancer_Data.csv"
```

Use your actual CSV path if different. The script creates .venv, installs tabular dependencies, compares four candidates with development-only grouped cross-validation, evaluates the selected model on a held-out fold and saves `ml/tabular/output_breast/model.joblib` and `evaluation.json`. Models remain local and ignored by git. Only load joblib checkpoints from your own trusted training runs.

The UI accepts a measurement CSV with the same named features, ignores id/diagnosis and sends only the selected record after consent. Reusing a training row demonstrates wiring, not an unbiased accuracy test. The service returns a research dataset class, not a patient diagnosis or calibrated probability.

## Train skin models after downloading images

Download PAD-UFES-20 images and metadata from https://data.mendeley.com/datasets/zr7vgbcyr2/1 . Extract all image parts. Then:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Train-Models.ps1 -SkinOnly -SkinMetadata ".\data\pad_ufes20\metadata.csv" -SkinImages ".\data\pad_ufes20\images" -Epochs 10
```

This trains MobileNetV3, EfficientNet-B0 and ViT classifier heads using frozen pretrained backbones, with the existing patient-separated PAD splits. Start at one epoch to smoke-test installation; that is not adequate evidence of performance. Training time depends on your hardware; CPU ViT can be slow. Compare validation metrics and latency before choosing the skin architecture. Preserve the held-out test fold for final reporting.

No skin image data has been uploaded in this conversation, so no skin checkpoint has been trained here. Wisconsin and cervical tables cannot fill this gap. Cervical data remains an unrelated research experiment, not an active app feature.

## Start the shared model service and web app

```powershell
.\.venv\Scripts\python.exe -m pip install -r ml/skin/requirements.txt -r ml/tabular/requirements.txt
.\.venv\Scripts\python.exe -m uvicorn service:app --app-dir ml/skin --host 127.0.0.1 --port 8010
```

In another terminal:

```powershell
cd "C:\Users\rishi\Downloads\Lungitude"
php -S localhost:8000 router.php
```

PHP requires curl. Open http://localhost:8000 for skin; http://localhost:8000/breast.html for breast measurement research. The PHP proxy routes both tasks to port 8010. The breast model is reloaded from its fixed local path for each request; restart the service after replacing a skin checkpoint because skin models are cached. No database profile is required for either flow.

Live iPhone capture requires HTTPS hosting with the same-origin API proxy. Your iPhone's localhost is not your laptop. This change does not deploy a public service or certify iPhone hardware behavior.

## Verified in the shared execution environment

The breast training run was executed against the uploaded CSV, and endpoint tests exercise its saved model with a dataset record. This verifies model loading/schema/API wiring, not independent clinical performance. No training was run on the user's Windows machine. Skin training remains blocked on labeled images. Browser/real-iPhone testing remains outstanding.

## Capture button fixes

Photo capture waits for JPEG encoding to finish, replaces prior captures, and reports an error if no image can be saved. Recording finalization awaits pending frame encodes and selects the best-ranked retained frame. A visible explanation next to Analyze tells you which consent/capture prerequisite is missing. Once a selected frame and both consents exist, Analyze can recheck the backend and report an absent skin checkpoint or offline service without uploading the image. Refresh model status detects newly installed checkpoints and can select an available architecture.

Verification: the real front-end script passes mocked DOM/media state tests for snapshot completion, recording completion, consent gating, unavailable models with no image upload, and revocation during encoding. Browser tests now also exercise Take a photo; actual iPhone hardware verification remains outstanding.
