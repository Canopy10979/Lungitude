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
