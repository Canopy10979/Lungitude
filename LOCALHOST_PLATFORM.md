# Lungitude localhost workspace

This update adds a shared tech-style interface, Mission Control (`dashboard.html`), an opt-in activity leaderboard, LungBot, and rolling live pulse modes. It is a localhost research prototype; it does not convert image scores or pulse observations into cancer diagnoses.

## Run locally

Merge the `codex/pulse-check-results-20261024` branch, then restart the Python sidecar so the new platform routes load. The existing PHP site stays on port 8000. No npm build is required for the app.

```powershell
Set-Location "$HOME\Downloads\Lungitude-Training"
.\.venv\Scripts\python.exe -m pip install -r ml/skin/requirements.txt
.\.venv\Scripts\python.exe -m uvicorn service:app --app-dir ml/skin --host 127.0.0.1 --port 8010
```

In a separate terminal, if PHP is not already running:

```powershell
php -S localhost:8000 router.php
```

Open `http://localhost:8000/dashboard.html`. Mission Control also appears in the navigation on every non-redirect app page.

## Configure real LungBot answers

LungBot calls the Anthropic Messages API from the Python backend. Keys never go into browser JavaScript, GitHub, API status responses, or chat messages. The supplied code contains no API credential. Any key posted in a chat should be revoked and replaced; enter the replacement locally.

Stop the existing Uvicorn process with Ctrl+C, then run in that same PowerShell terminal:

```powershell
$lungbotSecret = Read-Host "New Anthropic API key" -AsSecureString
$env:ANTHROPIC_API_KEY = [System.Net.NetworkCredential]::new("", $lungbotSecret).Password
$env:LUNGBOT_MODEL = "claude-sonnet-4-6"
.\.venv\Scripts\python.exe -m uvicorn service:app --app-dir ml/skin --host 127.0.0.1 --port 8010
```

An API account/key with access to the chosen model and available API billing is required. Set a different available model through `LUNGBOT_MODEL` if needed. Environment variables in this example last for that terminal/process. `.env` is ignored by git; the existing account backend loads it if you prefer to manage local configuration there. Do not overwrite existing `.env` settings when adding credentials.

Open LungBot and submit a question to test the actual provider connection. Without a key, the interface shows API setup instructions and sends no fake answer. The backend limits requests and output length. Only the conversation text you submit (up to the recent context limit) goes to the provider: no scan images, measurements, location or profile are attached automatically. Conversations are kept in the current tab's memory, not this app's database; provider handling/retention depends on your API account. Clear chat removes the local tab context. LungBot can answer general learning/coding/app questions, but has no browser, diagnostic or device-control tools and can be wrong. It cannot promise unrestricted answers or medical diagnoses.

Provider documentation: https://platform.claude.com/docs/en/api/messages/create ; model IDs: https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions .

## How the activity game works

- The home dashboard displays actual account scan counts, 10 XP per completed unique full skin-image analysis, and Spark/Orbit/Nova/Cosmos milestones at 0/5/15/40 analyses.
- There are no fabricated leaderboard users or prefilled scores. No historical scans are invented or backfilled.
- A successful `/infer_all` completion records the submission hash once per signed-in account. Multiple model outputs, retries of that image, automatic live previews, failed analyses, manual pulses and unfinished captures earn no additional scan points.
- The browser cannot award itself points: there is no public “increment score” route. The award comes from a completed backend inference call. SHA-256 deduplicates identical uploaded bytes; it does not identify near-duplicate or re-encoded images, so this is demo accounting, not a competitive anti-cheat system.
- Signed-in activity is stored in the existing local accounts SQLite database. The leaderboard is optional and displays only opted-in aliases and completed-analysis counts. It does not expose account emails, photos, image-class scores, pulse readings or other health findings. Aliases do not guarantee anonymity if the user chooses an identifying nickname.
- Withdrawing leaderboard participation hides the entry immediately. Deleting the account removes its activity and alias records.
- Points measure use of the research app, not health, medical accuracy, eligibility for care or clinical expertise. The app has no daily scan target or reward for a concerning result. The new scoreboard starts at zero for past users because previous completions were not recorded by this feature.

## Live pulse changes

- Option 1 remains a manual wrist count. Its added camera alternative starts the fingertip live mode; it does not claim to measure the wrist automatically.
- Fingertip live mode uses a bounded rolling signal buffer, gives its first full estimate after about 28 seconds, and then updates on a rolling 25-second window. The existing one-shot mode remains available. It ends on Stop, mode switch, hidden page or navigation. Stop if the device becomes warm or uncomfortable.
- Neck live mode keeps the local preview and user-selected ROI, shows a POS-style optical waveform and a signal-driven neck illustration, and updates pulse estimates about every five seconds after the first 60-second window. The cycle count is an estimate within that sampled window, not a lifetime count or individual heartbeat confirmation. The illustration is not internal imaging or an artery detector.
- Continuous autofocus and a selected region of interest are requested only if the camera/browser advertises support. A status line reports requested/reported/unsupported focus; no camera can be forced to focus on an internal pulse point by this page. Move/steady the device if focus controls are unavailable. There is no automatic neck or artery detection.
- No video upload, server pulse inference or recording file is required. Samples stay in bounded in-memory browser buffers. Unstable signals hide the estimate instead of supplying a made-up number. A supported camera and secure context are still required for capture.

## Verification

Passed Python API tests for authentication regressions, current skin inference, deduplicated activity, opt-in privacy, account-deletion cleanup, CSRF/alias checks, mocked Anthropic requests/errors and rate limits. Passed a live HTTP proxy test using PHP without cURL for platform messages, cookies, size/origin checks and multipart image forwarding. No real provider call was made with a personal API key.

Passed DOM tests for dashboard values/aliases, safe chat rendering, missing-key setup state, wrist timer, fingertip capture/cleanup and continuous monitoring, neck full-minute/continuous capture, supported focus constraints, signal-driven illustrations, transparent preview overlay, permission denial and insecure-context messages. Synthetic signal fixtures passed; they do not establish physical-device or clinical accuracy. Whole-page visual browser QA and real camera/skin-tone/device validation remain outstanding.

```powershell
python tests/test_platform_service.py
node tests/test_neck_ppg.cjs
npm install --no-save --package-lock=false jsdom
node tests/test_platform_ui.cjs
node tests/test_pulse_page.cjs
node tests/test_neck_page.cjs
```

Do not publicly expose the PHP/Uvicorn development servers. This source update does not deploy or publish a website.
