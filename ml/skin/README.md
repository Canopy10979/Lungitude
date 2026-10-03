# Skin-lesion research prototype

This is a dataset experiment, not a webcam cancer detector. It does not change
survey results or infer internal cancers. No trained weights or accuracy claims
are included. Model class scores are not calibrated clinical probabilities.

1. From the Lungitude folder, create a Python 3.11 virtual environment:
   Windows: `py -3.11 -m venv .venv`, then `.venv\Scripts\activate`.
2. Install: `python -m pip install -r ml/skin/requirements.txt`.
   PyTorch GPU installations may require the platform-specific official command.
3. Obtain HAM10000 images and metadata from https://doi.org/10.7910/DVN/DBW86T
   or the official ISIC archive. Review licensing/attribution before use.
   Extract both image parts under ml/skin/dataset/images and put
   HAM10000_metadata.csv under ml/skin/dataset.
4. Train: `python ml/skin/train.py --metadata ml/skin/dataset/HAM10000_metadata.csv --images ml/skin/dataset/images --epochs 10`.
   First run downloads ImageNet weights. A GPU helps; CPU training can be slow.
5. Read ml/skin/output/evaluation.json. Inspect melanoma/BCC recall, per-class
   precision and F1, and the confusion matrix, not only overall accuracy.
   Frozen EfficientNet features plus a trained classifier are a baseline,
   not an optimized or clinically validated model. There is no score target
   that automatically makes the model safe for public use.
6. Pick an image from test_split.csv and run:
   `python ml/skin/predict.py --image ml/skin/dataset/images/ISIC_XXXXXXX.jpg --dermoscopy-dataset-image`.
   Replace the filename with a real held-out image. Only load checkpoints you trust.
7. The updated imaging lab connects to the localhost research sidecar. Earlier research
   display should explicitly show dermoscopy modality, dataset ground truth,
   class scores, checkpoint identity, and limitations. Do not connect its
   outputs to live user diagnoses or cancer probability/risk scores.

Evaluation limits: split by lesion_id to prevent views of the same lesion from
crossing partitions. HAM10000 metadata do not provide complete patient IDs,
so patient leakage cannot be ruled out. Preserve a single held-out test set;
do not tune using it. Check duplicate images across external datasets, then
validate externally on the intended camera/device, skin-tone groups, ages,
and acquisition conditions before considering any user-facing image analysis.
ImageNet weights alone are not a cancer model. HAM10000 includes benign and
premalignant categories; do not label all seven categories as cancers.

Existing ml/train_icbhi.py models lung sounds, not cancer. Finger measurements
and pulse signals must not be presented as cancer detection. County cancer
rates remain educational population context, separate from image inference.

Validation in this editing environment: Python syntax compilation and a
synthetic lesion-disjoint split/coverage test passed. Torch/Torchvision were
unavailable, so training, weights downloading, and model inference were not run.


## Camera-photo and recording workflow (added)

Recommended initial camera-photo dataset: PAD-UFES-20, version 1:
https://data.mendeley.com/datasets/zr7vgbcyr2/1
CC BY 4.0; attribute the authors and dataset DOI. It contains six diagnostic
categories, clinical smartphone photos and patient IDs. It contains still
images, not labeled video, and does not establish clinical webcam performance.
Do not mix PAD and HAM labels or acquisition modalities into one model by default.
The camera-photo trainer ignores geographic data, age, BMI and other metadata;
it uses the images/diagnostic labels and patient IDs only for split grouping.

Extract the images recursively under ml/skin/pad/images and save the metadata
CSV as ml/skin/pad/metadata.csv. The adapter requires patient_id, lesion_id,
img_id, diagnostic and supports filename extensions in img_id.

Train the lightweight baseline:
python ml/skin/train.py --dataset pad_ufes20 --architecture mobilenet_v3_small --metadata ml/skin/pad/metadata.csv --images ml/skin/pad/images --epochs 10 --output ml/skin/output_mobile

Train the comparison baseline with the same deterministic split:
python ml/skin/train.py --dataset pad_ufes20 --architecture efficientnet_b0 --metadata ml/skin/pad/metadata.csv --images ml/skin/pad/images --epochs 10 --output ml/skin/output_efficient

Use validation results to select between models. Keep a truly untouched final
external evaluation set for the final choice; inspecting two internal test
results during model selection is not an unbiased final performance estimate.
Do not keep adjusting models to improve their reported test result.

Open http://localhost:8000/record.html after running php -S localhost:8000.
Camera requires HTTPS or localhost and permission. Confirm permission from the
person recorded, enable the camera, center one lesion and record a short clip.
Capture quality checks are heuristic brightness/frame-change checks, not CNN
predictions. Download is explicit, video-only and local. Stop releases the
camera; withdrawing consent clears the pending downloadable clip.

Offline frame ensemble experiment (requires opencv-python):
python ml/skin/video_research.py --checkpoint ml/skin/output_mobile/model.pt --video PATH/recording.webm --research-recording

The script center-crops and samples up to two frames/second (60 max), skips
extreme exposures, and averages uncalibrated class scores. It requires a PAD
checkpoint. Video domain remains unvalidated. Scores are research output only;
frame agreement is not proof of cancer or accuracy. Moving a camera over a
lesion is not a longitudinal measurement of cancer growth. For longitudinal
analysis, collect appropriately labeled visits over time, with standardized
acquisition. A trained temporal CNN/LSTM requires genuine labeled video and
patient-disjoint splits; still images duplicated into fake clips are not a
substitute.

Current validation: both CNN architectures executed forward and synthetic
classifier-update smoke tests; a patient-disjoint synthetic PAD split passed.
JavaScript/Python syntax checks passed. No real-image training or video model
inference ran. Dataset retrieval was attempted but the provider returned 403.
Browser/camera visual verification remains pending in this environment.
