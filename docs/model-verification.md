# Trained-model publication checks

All three artifacts were produced by real training runs on the documented public research datasets. No synthetic data, fabricated scores or renamed ImageNet-only models are presented as trained medical models.

- Both skin runs: 20 classifier-training epochs, frozen ImageNet feature backbone, validation-selected checkpoint (epoch 12), evaluated once on the fixed 461-image patient-disjoint test set.
- All 2,298 expected PAD images present. Exact-byte hash audit found 2,283 unique hashes and zero cross-partition exact duplicates. This does not establish absence of near-duplicates or external validation.
- Lung model: 5,433 training cycles from 88 patients, 1,459 held-out cycles from 38 different patients. Exported rounded JSON predictions matched the fitted classifier on every held-out cycle. No official split file was available; the fixed patient split is documented.
- `python tests/test_model_artifacts.py`: four test methods passed, including artifact SHA-256/size verification, both checkpoint reloads and finite six-class inference, evaluation/registry agreement and lung export structure.
- Existing FastAPI service: nine checks passed using a real held-out image for each skin checkpoint, verifying successful inference, expected class labels, normalized scores, rejected missing upload consent and status availability.
- Python syntax compilation passed for the four changed ML scripts and the artifact test. JavaScript syntax check passed for the updated privacy disclosure. `git diff --check` passed.

No external, prospective, phone-camera, subgroup or clinical validation was performed. No browser visual checks were performed for this model-only revision. In particular, the low SCC recall and poor lung baseline must not be hidden behind a general accuracy claim. See the actual reports linked from `MODELS.md`.

Raw images, audio, patient metadata, training features and split CSVs remain excluded from Git. Only reviewed model artifacts, aggregate evaluations, hashes, code and documentation are published. AI-assisted training/code work must be disclosed accurately in the student submission.
