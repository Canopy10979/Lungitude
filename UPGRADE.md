# Lungitude: model and live-signal upgrade

## What changed and what was actually measured

- Four tabular candidates per dataset: logistic regression, SVM, random forest and histogram gradient boosting. Preprocessing stays inside cross-validation pipelines. Identical predictor rows are grouped across every fold. Model selection uses development average precision; the selected model is evaluated once on the reserved fold. These are small internal evaluations, not clinical evidence.
- Breast: SVM selected; 114 test records, 42 malignant. Confusion matrix [[72,0],[1,41]]. Requires FNA cell measurements; it cannot power a photo or symptom-based breast cancer assessment.
- Cervical: gradient boosting selected; 172 test records, 11 positive. Confusion matrix [[160,1],[11,0]], test AP about 0.148. Default-threshold recall is zero. **Do not enable patient scoring.** Future work must use development-only threshold selection and independent validation, not tuning to this observed test set. Prior diagnoses and examination outcomes are excluded from predictors. Missing patient IDs remain a limitation.
- The uploaded `.crdownload` is a CRC-verified BIDMC archive, not an image dataset. A contact-PPG spectral benchmark accepted 701/795 eligible windows across 53 records, with subject-macro MAE about 1.24 bpm. This is conditional on a quality gate, not webcam accuracy. No pulse neural network was trained.
- USCS importer exports WA lung/bronchus county statistics. Suppressed values remain null. Keep source year/event labels: incidence and mortality windows may differ. County rates are not individual risk.
- ViT-B/16 is now an image-training and inference option alongside existing MobileNet and EfficientNet. All three train replacement heads with frozen pretrained backbones. No labeled image dataset was uploaded, so no image checkpoint was trained here. A single JPG is not a training set. ViT imports were syntax-checked, not runtime-tested locally: PyTorch is unavailable in this execution environment.
- An explicit-consent local camera experiment sends only timestamped mean RGB samples to a bounded FastAPI WebSocket endpoint. Video stays in the browser. The ROI is fixed/manual, **not automatic facial tracking**. It rejects some poor-exposure, flat, irregular and spectrally diffuse signals; periodic movement/lighting can still fool it. No identity, cancer, arrhythmia, oxygen, HRV or respiratory-rate output.
- Evidence page makes internal results and limitations inspectable from the home navigation.

## Run (Windows PowerShell, from repository root)

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt -r ml/tabular/requirements.txt httpx
.\.venv\Scripts\python.exe -m unittest discover -s tests -p 'test_*.py' -v
.\.venv\Scripts\python.exe -m uvicorn backend.app:app --host 127.0.0.1 --port 8002 --ws-max-size 180000 --ws-max-queue 1 --limit-concurrency 8
```

In another terminal (PHP must be installed):

```powershell
php -S localhost:8000 router.php
```

Open `http://localhost:8000/evidence.html` and `http://localhost:8000/live.html`.
Alternatively `docker compose up --build` starts only the local signal service; PHP still runs separately. Docker was not available for verification here. Never expose the PHP development server as production hosting.

## Reproduce yesterday's tabular runs

Place the two original ZIPs in `data/raw/`. Outputs are ignored by git; only aggregate evaluation reports are committed. Pickle/joblib files should only be loaded from trusted training runs.

```powershell
.\.venv\Scripts\python.exe ml/tabular/train.py --dataset breast --zip "data/raw/breast+cancer+wisconsin+diagnostic (1).zip" --output ml/tabular/output_breast
.\.venv\Scripts\python.exe ml/tabular/train.py --dataset cervical --zip "data/raw/cervical+cancer+risk+factors.zip" --output ml/tabular/output_cervical
.\.venv\Scripts\python.exe ml/evaluate_bidmc.py --zip "data/raw/Unconfirmed 861818.crdownload" --output reports/bidmc_signal_evaluation.json
.\.venv\Scripts\python.exe tools/import_uscs.py --zip data/raw/USCS-1999-2023-ASCII.zip --output data/uscs_wa_context.json
```

Reports record package versions and source hashes for the tabular runs. Exact results can differ across library versions; use the recorded versions to reproduce a published run. Do not repeatedly select models using held-out test results.

## Train the image models when PAD-UFES-20 is downloaded

Use the original dataset license and metadata; put all images beneath `data/pad_ufes20/images/`. Each command uses the same deterministic patient-separated split. CPU ViT can be slow; start at one epoch to test installation, then train properly with a GPU.

```powershell
.\.venv\Scripts\python.exe -m pip install -r ml/skin/requirements.txt
.\.venv\Scripts\python.exe ml/skin/train.py --dataset pad_ufes20 --architecture mobilenet_v3_small --metadata data/pad_ufes20/metadata.csv --images data/pad_ufes20/images --epochs 10 --output ml/skin/output_mobile
.\.venv\Scripts\python.exe ml/skin/train.py --dataset pad_ufes20 --architecture efficientnet_b0 --metadata data/pad_ufes20/metadata.csv --images data/pad_ufes20/images --epochs 10 --output ml/skin/output_efficient
.\.venv\Scripts\python.exe ml/skin/train.py --dataset pad_ufes20 --architecture vit_b_16 --metadata data/pad_ufes20/metadata.csv --images data/pad_ufes20/images --epochs 10 --batch-size 4 --output ml/skin/output_vit
.\.venv\Scripts\python.exe -m uvicorn service:app --app-dir ml/skin --host 127.0.0.1 --port 8001
```

The service accepts compatible PAD checkpoints, not arbitrary HAM10000 checkpoints. ViT is an API option; existing imaging-lab controls still present the two CNNs. Adding an architecture does not demonstrate better accuracy. Compare validation macro F1 and latency, then report the untouched test set.

## Production path (not implemented or claimed here)

1. Validate a single complete demo: questionnaire -> explanation -> appropriate local care -> follow-up. Test with real devices and volunteers; report observed usability results, not fabricated impact.
2. For facial tracking/rPPG, obtain consented synchronized video + reference pulse data (UBFC-rPPG/PURE). Compare a POS/CHROM baseline against a pretrained neural model; split by person, validate on a separate dataset, report MAE, failure coverage, motion/lighting/device and skin-tone subgroups. BIDMC contact PPG cannot substitute for this.
3. Put an authenticated TLS gateway in front of the service. The local demo uses ws:// and an origin allowlist, which is not authentication. Production needs WSS, session-scoped authorization, aggregate rate limits, operational monitoring, secrets management and explicit retention/consent controls. Do not upload facial video by default.
4. Keep lightweight ROI processing on-device where possible. For remote inference use a bounded latest-frame queue, cancellation, timeouts and cached model loading. Measure latency, memory and throughput before adopting a broker. Kafka/Celery are not needed just to move a few RGB numbers.
5. If measured throughput requires it, export validated models to ONNX/Triton, benchmark batching and CPU/GPU latency, then add replicas. TorchServe documentation warns of limited maintenance. No inference load test or thousand-session capacity claim has been made.
6. Use PostgreSQL once persistent multi-user profiles are necessary; Redis for shared ephemeral session/rate-limit state. Add migrations, access control, backups and deletion flows before migrating real data. The existing SQLite app remains unchanged.
7. Introduce Kubernetes/autoscaling only after an actual load test demonstrates the need. Cloud accounts, infrastructure and deployment were not created.

## Uploaded-file reconciliation

The uploaded large standalone index includes a call to `api/geocode.php`, which is absent from the GitHub tree reviewed here. Replacing the repository home blindly would break location behavior. This update extends the existing GitHub home and preserves the uploaded files unchanged. The uploaded `dual_models.py` defines network architectures without training data, fitting, or evaluation; it is not a trained abnormality detector. PLACES county data can add regional context later, but cannot supervise facial/pulse disease classification.

## CAC priorities

A defensible submission demonstrates originality, a usable end-to-end workflow, understandable code and measured results. Finish the demo and record authentic testing before broadening disease claims. Explain the false negatives and why the cervical model is disabled. No architecture guarantees a prize. Verify the current official submission deadline in the submission portal: uploaded launch notes and earlier discussion disagree.
