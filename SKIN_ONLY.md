> Superseded scope: see TRAIN_AND_RUN.md. The app now includes separate skin-photo and breast-cell research paths. Earlier skin-only notes below are historical.

# Lungitude — skin-only mission

Help people worried about a skin spot capture clear close-ups on an iPhone, understand the limits of image research, and prepare for a dermatologist visit. The prototype does not confirm or rule out cancer.

## Current product

Home is the skin camera workflow: consent -> rear camera -> 8-second local recording -> up to three candidate close-ups -> choose one -> separate upload consent -> compatible skin-model class scores, if available -> clinical next steps. Supports photo input and native-camera video input (20 seconds/50 MB max) with manual frame extraction. MP4 is preferred where supported, with WebM fallback. No audio; no recording upload; selected still only. In-page captures are ephemeral unless the user saves them. Capture cancellation, consent withdrawal, backgrounding and navigation stop camera tracks. HTTPS is required for live iPhone camera access; localhost on a desktop is not the iPhone's localhost.

Older lung, study, pulse and recording entry URLs redirect to the skin capture. Imaging lab and dated skin-image comparison remain skin-only tools. Old model code and aggregate experimental reports are retained for provenance, but breast/cervical/pulse results are no longer displayed in the app or represented as skin evidence. No database health-profile flow is used by the new home.

## Run

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r ml/skin/requirements.txt
.\.venv\Scripts\python.exe -m uvicorn service:app --app-dir ml/skin --host 127.0.0.1 --port 8010
```

Second terminal (PHP with curl enabled):

```powershell
php -S localhost:8000 router.php
```

Open localhost:8000 on desktop. For iPhone, serve the web app over HTTPS with a same-origin `/api/imaging.php` proxy; do not point an iPhone at a desktop's localhost. Production hosting is not configured here. Image server port **8010** matches the existing PHP proxy and start-imaging.bat (supersedes the earlier guide's 8001).

## Training downloads

1. PAD-UFES-20: https://data.mendeley.com/datasets/zr7vgbcyr2/1 — all images + metadata; current clinical-photo trainer supports it. Patient-separated evaluation required.
2. ISIC 2024: https://api.isic-archive.com/collections/390/ — larger total-body-photo crop experiment; needs a metadata adapter. Do not assume iPhone generalization.
3. HAM10000/ISIC 2018: https://challenge.isic-archive.com/data/ — separate dermoscopy experiment only; existing HAM loader supported, but those checkpoints are intentionally rejected by the clinical-photo API.

```powershell
.\.venv\Scripts\python.exe ml/skin/train.py --dataset pad_ufes20 --architecture mobilenet_v3_small --metadata data/pad_ufes20/metadata.csv --images data/pad_ufes20/images --epochs 10 --output ml/skin/output_mobile
```

For EfficientNet use `--architecture efficientnet_b0 --output ml/skin/output_efficient`; for ViT use `--architecture vit_b_16 --batch-size 4 --output ml/skin/output_vit` with the same metadata/images. These train classifier heads on frozen pretrained backbones. No labeled skin image training set or checkpoint has been supplied yet.

## Newly uploaded datasets

Cancer_Data.csv is a 569-record Wisconsin breast diagnostic table (30 cell measurements). The breast ZIP contains the same measurements; the cervical ZIP contains cervical risk-factor records. They must not train the skin-image model, and duplicating them does not add independent patients. Additional training runs/audits stay separate from the skin product.

## Validation boundaries

Browser automation can verify UI, consent, frame capture and mocked API error handling, but not clinical accuracy or real iPhone hardware. Real iPhone Safari/Chrome, camera focus, native-file formats, low-light performance and external model validation remain necessary. Current frame ranking is a simple sharpness heuristic, not a learned image-quality or lesion detector. There is no clinically justified "safe" or "cancer-free" result.

## Validation performed for this update

Twelve Python tests passed, including selected-image consent enforcement and the absence of prediction scores when a checkpoint is missing. Python compilation, JavaScript syntax and git whitespace checks passed. The mobile browser test suite is included and scheduled in CI, but could not run locally because no Chromium executable was installed and the browser download returned a truncated archive. Physical iPhone testing is still outstanding.

Both new tabular training runs completed; the breast CSV is identical to the 569 records in the new ZIP, so they were not pooled. Breast SVM: 114 held-out records, one false negative and no false positives. Cervical gradient boosting: 172 held-out records, all 11 positives missed at default threshold. Reports are in `reports/new_*`; these results are not skin evidence and are not shown in the app. Re-running duplicate datasets did not improve the skin model or add independent patients.
