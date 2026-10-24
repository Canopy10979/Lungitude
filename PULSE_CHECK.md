# Pulse check integration

The home navigation now links to `pulse-check.html`. This standalone measurement page is available without creating an account. It adds no backend dependency and does not upload/store pulse samples or results.

## User results

- Manual wrist count: a 60-second timer, then a user-entered beat count displayed as manually counted beats/minute. The phone does not sense pressure at the wrist. The timer cancels if the page is hidden; cancelled/incomplete counts cannot be submitted.
- Experimental camera estimate: on a compatible phone, use a fingertip over the rear camera. The page draws the observed signal, resamples timestamps to 30 Hz and estimates periodicity using an autocorrelation baseline. It displays an experimental pulse estimate when the signal passes the heuristic gate, otherwise requests a retake or manual count. This is not validated wrist-camera measurement or a clinical accuracy claim.
- No cancer-type prediction, oxygen saturation, rhythm diagnosis or “normal/healthy” classification. A pulse measurement does not establish or exclude cancer.
- Camera access starts only on a button click. Stop, navigation, hidden page, denied permission and late camera permission are handled. Frames are not recorded or sent to a server. Stop if the phone feels warm or uncomfortable.

The copied estimator fixes the legacy boundary-peak bug: a synthetic 180 bpm waveform previously selected its two-beat harmonic at about 90 bpm. Boundary local maxima are now considered. This synthetic fix does not establish accuracy in real users or behavior outside the estimator's 40–180 bpm search range. Its signal-quality score is periodicity, not calibrated clinical confidence.

## Running

Use the existing PHP server and open `http://localhost:8000/pulse-check.html`, or choose Pulse check in the main navigation. Camera access needs a compatible device/browser and a secure context (HTTPS, or localhost on the device itself). A phone's localhost refers to the phone, not a PC server. Use an existing HTTPS deployment for phone testing; do not expose the PHP development server publicly.

The 1D CNN, LSTM and Transformer trained on BIDMC contact-PPG remain separate research models. They are not automatically connected to phone-camera RGB signals: sensor modality, preprocessing, devices and participants differ. Live camera measurements here use the baseline estimator. Train and test those neural models on matched, consented phone recordings and independent reference rates before considering a separate camera-model integration.

## Verification

```powershell
npm install --no-save --package-lock=false jsdom
node tests/test_pulse_page.cjs
```

Passed: full-minute manual-count/result/cancel flow; synthetic rate fixtures at 42, 60, 72, 100, 150 and 180 bpm; flat/short signal rejection; simulated-camera rate display and stream cleanup; denied camera access; and cancellation while a permission request is pending. JavaScript syntax checks also passed. DOM/media simulations are not physical camera tests. Real-phone accuracy, camera/light compatibility and visual mobile/desktop QA remain outstanding. Do not present synthetic test errors as real clinical performance.

Sources: manual wrist measurement instructions https://www.bhf.org.uk/informationsupport/tests/checking-your-pulse ; lung screening context https://www.cancer.gov/types/lung/hp/lung-screening-pdq ; contact PPG/reference modality https://physionet.org/content/bidmc/1.0.0/ .

## Labeled live graph and finger illustration

Option 2 now labels its scaled optical-signal axis and relative-time axis, displays a provisional bpm only after enough consistent data, and shows recording progress plus a final observation panel. The glow in a generic finger SVG follows the observed filtered trace. It is marked as an illustration rather than an X-ray; bones/vessels are decorative and are not inferred from the camera. The glow switches off at loss of contact, stop or completion. Reduced-motion mode uses a static contact indicator. The graph is explicitly not an ECG, and its autoscaled height cannot be compared as physiological pulse strength across windows. The final panel cannot determine a medical diagnosis.

## Option 3: non-contact neck rPPG

The user first confirms local-processing consent and enables the front-facing camera. They manually select a visible patch of neck skin and confirm that it stays in frame. There is no neck/artery/skin detector, no contact pressure sensing, and no need to touch or press the neck. An initial basic exposure/movement check must pass before the 60-second recording button enables.

`js/neck-ppg-core.js` implements an experimental POS-style temporal RGB projection, uniform resampling and a dominant-frequency pulse-band estimate. Source: Wang et al., Algorithmic Principles of Remote PPG, https://pubmed.ncbi.nlm.nih.gov/28113245/ . This specific implementation and ordinary RGB neck setup are not clinically validated. It has heuristic exposure, timestamp, periodicity and within-recording stability gates; slow motion/lighting or selection of non-skin can still pass. Do not interpret the gates as validated clinical confidence. The 42–180 bpm analysis range is a design scope, not a normal range, and can miss rates outside it.

The recording stays on-device. Its displayed cycle total is frequency multiplied by sampled duration, NOT an independently verified count of each heartbeat. A missing/unstable signal produces a retake message and no number. No cancer, rhythm disorder or oxygen-level result is produced. The graph remains blank until a stable pulse-band component can be estimated. Both camera modes stop when the other starts, consent is withdrawn, the page is hidden, or capture is cancelled. A frame-interruption timeout prevents indefinite recording.

Additional checks:

```powershell
node tests/test_neck_ppg.cjs
node tests/test_neck_page.cjs
```

Passed synthetic fixtures for six rates and estimated cycle totals, flat/common illumination rejection, duration/timestamp/exposure rejection; a simulated full-minute camera/ROI/result path; denied permission; and switching modes. Existing pulse tests also cover reduced motion, labeled result summary and an inactive glow after capture. A real canvas render of the labeled Option 2 waveform was inspected. Whole-page visual browser QA and physical-person RGB neck accuracy remain unverified. These tests do not establish medical performance.
