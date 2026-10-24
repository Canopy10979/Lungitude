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

## Public messages vs developer troubleshooting

Visitors see only availability, retry, capture/save and consent guidance. Public pages never instruct visitors to start Python, choose a port, install checkpoints or run training. Architecture selection is an internal hidden control; the skin UI picks an installed supported model when available. Clinical limitations remain visible.

Operator troubleshooting stays here: run the image service on 127.0.0.1:8010, verify /status, then check the PHP same-origin proxy. The proxy logs upstream action/status in the server error log and maps upstream failures to safe user messages. Browser clients also avoid displaying raw backend error details, which may contain paths, ports or model internals. User-friendly availability wording does not bring an offline backend online or imply that an absent model produced a result.

Visual theme: dark navy and teal-green surfaces, mint actions, editorial serif headings inspired by Claude-style typography, and monospace technical labels. Self-contained native font stacks avoid external font requests; the exact face varies by device.

## Account/profile -> national context -> automatic camera analysis

Accounts now use salted PBKDF2 password hashes, opaque HTTP-only SameSite session cookies, expiry, CSRF checks for profile/context/logout/delete, and SQLite persistence. Passwords are never stored in plaintext. The PHP account proxy enforces same-origin requests and forwards only the account cookie. Profiles can be deleted from the profile screen. This is a local prototype identity flow: no email verification, password recovery or audited production identity service is configured. Do not deploy real health profiles publicly without HTTPS, secure-cookie configuration, privacy review and production access/security controls. Set LUNGITUDE_SECURE_COOKIES=1 and LUNGITUDE_PUBLIC_ORIGIN to the exact public HTTPS origin when deploying behind a trusted same-origin proxy.

Profile fields: age, weight in pounds, height in inches, calculated BMI, optional race/ethnicity and registry-sex comparison categories, gender identity, and ZIP. Gender is not automatically treated as sex. BMI and other unsupported covariates do not alter registry rates or image scores. Profile records do not contain raw images.

The app uses the uploaded USCS archive's BYAGE.TXT: national 2023 melanoma incidence by the selected age band, registry race/ethnicity, and optional sex category. Suppressed/unmatched rates remain null; no silent alternative population or zero is substituted. This is not an individual probability. Registries do not routinely capture basal/squamous skin cancers; the context is explicitly melanoma-only, although the classifier has other lesion classes. No ZIP-level incidence is claimed.

ZIP mapping is opt-in. Only ZIP is sent to Zippopotam.us; only the approximate centroid is included in the OpenStreetMap iframe. Profile health fields, race and gender are not sent to either map provider. If geocoding/map/network access fails, show the absence honestly and keep the camera workflow available.

After explicit recording/selected-still consent in the profile, the camera opens on user action and an eight-second recording or photo automatically submits the chosen still to the skin model. Manual review/retry remains available. Context is shown before and during analysis; it does not modify predictions. If no trained skin model exists, there is no image assessment to present. No simulated success result is generated.

Public display palette is dark navy/green with editorial serif headings and monospace labels. Operations details remain in this guide and server logs. Account, statistics and automated-capture tests use temporary accounts, synthetic inputs and/or API mocks; they are not clinical or real-iPhone validation.

## All-model skin results

The main recording/photo flow now calls `/infer_all`. It runs every installed compatible skin checkpoint (MobileNetV3, EfficientNet-B0, ViT), with no model-choice step. Each model's softmax vector is displayed as percentage estimates over its skin-image categories, explicitly labeled uncalibrated. These are not validated personal cancer probabilities; missing models return no percentage. Agreement is not independent evidence because models can share datasets. No unsupported demographic correction or cross-organ fusion is applied. Multi-model CPU latency has not been load-tested; the proxy and client allow longer requests.


## Graceful result presentation

The user result list displays only models that actually returned estimates. Missing or failed model slots are omitted; they never produce mock percentages or a visible "unavailable model" card. If the entire assessment fails, a short recovery message clearly states it could not be completed and offers to save/retry. This intentionally does not claim a successful/full analysis when none occurred. Diagnostic model availability remains in backend status responses for operators. Failed model slots are not converted to zero probabilities and are not averaged into other models.
