# Start the updated website locally

Extract the ZIP to a permanent folder such as `C:\Users\rishi\Projects\Lungitude`. Do not run it inside the ZIP preview or a temporary extraction directory.

1. Install PHP 8.2+ with cURL, PDO SQLite and fileinfo enabled, and ensure `php` is on PATH.
2. Double-click `start-web.bat`. Leave its terminal open.
3. Open **http://localhost:8000** in your browser. Opening `index.html` with `file://` cannot run the PHP backend.
4. For the optional imaging features, install Python 3.11+, then open a terminal in this folder and run:

```bat
py -3.11 -m venv .venv
.venv\Scripts\python -m pip install -r ml/skin/requirements.txt
start-imaging.bat
```

Leave both server windows open. Camera permissions work on localhost. Use a supported browser such as Chrome or Edge.

The private download has the Google key configured on the PHP server. The GitHub version excludes secrets; copy `api/secrets.example.php` to `api/secrets.php` and configure your key locally. Places and Geocoding require their respective APIs and billing to be enabled in the key's Google Cloud project. Missing access is shown as an error; manual Washington county selection remains available. Keep `api/secrets.php` private.

## Current capabilities

The questionnaire accepts whole-number ages 0–120, including zero. Adult BMI categories are not applied below age 20. Existing screening age criteria remain in effect. The recording page includes three movable, resizable regions with live zoom panels, a REC indicator, elapsed timer and manual recording stop. These manually selected regions do not track people or detect cancer.

The camera supports front/rear selection, still photo capture, 10-second recording, preview/playback and local downloads. Consent withdrawal stops capture and removes local previews. The questionnaire leads to optional recording/imaging checks, then educational next steps and a Google Places search for up to five healthcare listings within a strict 10-mile radius. Listings are ordered by straight-line distance, not clinical quality. The supplied Washington map is presented specifically as a breast/cervical screening network with an unknown publication date.

The imaging lab computes descriptive asymmetry/border, color and texture measurements from a manually outlined lesion. Follow-up comparison accepts dated photos with ruler calibration and attempts image registration. Vessel analysis needs suitable dermoscopic imaging and is unavailable. These measurements do not determine malignancy.

MobileNet and EfficientNet research training scripts and a local inference endpoint are included. No trained cancer checkpoints or real-data accuracy results are supplied. CNN inference stays disabled until a compatible PAD-UFES-20 checkpoint is trained. Video analysis is a frame-ensemble research experiment, not a trained temporal cancer detector. Breathing and ordinary camera recordings cannot diagnose lung, pancreatic or colon cancer.

See `ml/skin/README.md` for training commands. PHP risk/survey tests and JavaScript syntax checks passed during development. Dataset rates in the original prototype still require source verification before clinical use.

---

## Original project documentation

# Lungitude

**Your lungs, mapped. A 3-minute lung check on your phone that sends you to a lung cancer screening you can walk to.**

Lungitude uses 4 inputs:

- Your answers: they go into **PLCOm2012**, a published risk model that doctors use.
- The microphone: it times 1 forced exhale (forced expiratory time). An optional AI also listens for crackles and wheezes.
- The camera: it measures finger clubbing (phalangeal depth ratio). It also has an optional nail-bed color check.
- Your location: it finds your county data and the places you can walk to, and gives you a call script and a printable note for your doctor.

Lungitude does not diagnose cancer. It tells a person **"go get the scan"** and shows **where** to go.

---

## 0. The survey (index.html)

The home page is a short survey with 1 question on each screen:

1. "Hello, how are you doing today?"
2. Welcome text and the motto "Breathing shouldn't be a tax, make it a right."
3. Name (it stays in the browser and goes to no server), age, BMI (or height and weight).
4. 7 yes/no warning-sign questions: lung, breast, colorectal, urinary (prostate, bladder, kidney), skin, blood (leukemia and lymphoma), pancreas and liver.
5. A thank-you screen and a location request.
6. The result: "Based on your answers, your result is: Warning signs of ...". Then 5 healthcare centers near you with phone numbers (Google Places), Washington data for each matched cancer, the screenings for your age, the BMI link, and Washington's free screening program.

**The result is a warning-sign match, not a diagnosis.** If the app said "your result is: pancreatic cancer" after a survey, it would be false and could frighten people. Judges would also mark it down. The result names the cancers whose warning signs the person reported, and it always sends them to a doctor.

- With 3 or more "yes" answers, the app suggests a primary care doctor first, and it searches for primary care clinics.
- With 2 matched areas, buttons switch the clinic search between the 2 specialties.
- The lung check from earlier versions is now `lung.html` (microphone, camera, pulse, PLCOm2012). The result links to it when the lung question is "yes".

Backend: `api/survey.php` (rules in `bw_survey()`) and `data/wa_cancers.json` (all numbers and sources). Tests: `php tests/test_survey.php` (13 checks).

## Washington data: what is in the app, and what to download

**Already in the app (no download):** `data/wa_cancers.json`

| Data | Source |
|---|---|
| New cases and deaths in Washington in 2026, by cancer type | American Cancer Society, Cancer Facts & Figures 2026 |
| Washington vs US incidence rate per 100,000 (2019–2023), by cancer type | NCI State Cancer Profiles |
| Cancers linked to BMI (13 types) and to smoking | CDC |
| Screening ages and intervals | USPSTF final recommendations |
| Free screening program (age 21–64, income up to about 250–300% of the federal poverty level) | WA DOH, Breast, Cervical, and Colon Health Program |

**Download these for Washington:**

| # | Dataset | How | Adds to the app |
|---|---|---|---|
| 1 | **CDC PLACES, county data** | `php tools/fetch_places.php` (keeps Washington's 39 counties; add `--all` for every US county) | County smoking, COPD, obesity, colorectal screening and mammogram rates |
| 2 | **WA State Cancer Registry (WSCR) Data Online** | doh.wa.gov → Cancer Data → WSCR Data Online. Export rates by cancer site, county and **age group** as CSV | Age-specific Washington rates, for example "people aged 50–64 in King County" |
| 3 | **NCI State Cancer Profiles, Washington by county** | Export 1 CSV for each cancer into `data/scp/` (file names in `data/scp/README.txt`), then run `php tools/import_scp.php` | County rates for each cancer type on the survey result |
| 4 | **ICBHI 2017** (not Washington data) | See section 4 | The lung-sound AI on `lung.html` |
| — | Google Places API | API key in `api/secrets.php` | Real clinics and phone numbers |

Items 2 and 3 are manual exports, because those sites have no simple download API. Save the files in `data/`, and keep the source and the year in the file name, for example `data/wscr_king_by_age_2018-2022.csv`.

## Backend map

All endpoints are plain PHP 8. Open `http://localhost:8000/api/health.php` first. It lists what is set up and what is missing.

| Endpoint | Method | Does |
|---|---|---|
| `api/survey.php` | POST | Survey → warning-sign match, Washington data, county data, screenings for the age, BMI link |
| `api/nearby.php?type=…&limit=5` | GET | 5 places for the matched cancer type (Google Places → OpenStreetMap → sample data) |
| `api/risk.php` | POST | Lung risk (PLCOm2012, USPSTF, finger, breath, pulse) for `lung.html` |
| `api/region.php` | GET | County and lung data for `lung.html` |
| `api/log.php` / `api/stats.php` | POST / GET | Accuracy study (only with consent; numbers only) |
| `api/health.php` | GET | Setup check |

| Shared file | Holds |
|---|---|
| `api/lib.php` | Risk engine, input checks, HTTP helper |
| `api/geo.php` | Location → county (Census, then FCC), county health data, county cancer rates. County lookups are cached for 30 days. |
| `api/store.php` | SQLite cache and rate limit (`data/cache.sqlite`) |
| `api/db.php` | Study database (`data/study.sqlite`) |

**Google key protection:** each visitor can make at most 30 Google searches per hour (`GOOGLE_MAX_PER_HOUR` in `nearby.php`). The rate limit stores a hash of the IP address, never the IP address itself. Google results are **not** cached, because the Google Maps Platform terms do not allow storing Places content such as names and phone numbers. Also set a budget alert in the Google Cloud console.

**On Windows:** in `php.ini`, remove the `;` before `extension=curl`, `extension=pdo_sqlite` and `extension=openssl`. Then run `php -S localhost:8000` in the Lungitude folder.

**Tests:** `php tests/test_risk.php` (14 checks) and `php tests/test_survey.php` (20 checks, including the CSV importer on a fake file).

## 1. Run it (1 minute)

```
cd lungitude
php -S localhost:8000
```

Open `http://localhost:8000` and click **Load demo person**, then **Use demo location**.

- You need PHP 8 with curl. There is no npm, no Composer and no framework.
- The microphone and camera work only on `localhost` or on HTTPS.
- When there is no network, the app uses sample data for places and county data. Each sample item has a "sample" label.

### Optional upgrades

| Upgrade | Command or step | Result |
|---|---|---|
| County smoking and COPD rates | `php tools/fetch_places.php` | Downloads CDC PLACES once. After that, the county lookup works offline. |
| Google Places (real screening sites) | Put your key in `api/secrets.php` (this file is in .gitignore) | Text Search for "lung cancer screening" near the user, with phone and website. If it fails, the app uses OpenStreetMap. |
| Real street walk times | Put a free key in `api/config.php` (`ORS_KEY`) | OpenRouteService gives walk times on real streets. |
| AI lung-sound check | See section 4 | Shows the AI panel on the Breath step. |
| Use sample data only | `FORCE_DEMO = true` in `api/config.php` | Use this if the Wi-Fi fails during a demo. |

## 2. Files

```
index.html            survey (home page)
js/survey.js          survey screens and result page
css/survey.css        survey styles
api/survey.php        survey rules (warning-sign match, screenings, BMI)
data/wa_cancers.json  Washington cancer data + questions + sources
lung.html             lung check: 6 steps + results
css/app.css           all styles, no framework, works offline
js/app.js             flow, form, API calls, demo person
js/breath.js          forced exhale timer (mic loudness only, no recording)
js/hands.js           finger clubbing ratio (4 taps) + nail-bed color
js/lungsound.js       AI lung-sound model, runs in the browser
js/results.js         results page, walk radar, call script, doctor note
api/lib.php           risk engine: PLCOm2012, USPSTF, Medicare, red flags
api/risk.php          POST answers -> risk JSON
api/region.php        location -> county (Census/FCC) -> CDC PLACES
api/nearby.php        location -> OpenStreetMap places -> walk minutes
tools/fetch_places.php  cache CDC county data
ml/train_icbhi.py     trains the lung-sound model (Python, training only)
tests/test_risk.php   php tests/test_risk.php  (9 checks)
data/                 demo data + caches + lung_model.json after training
```

## 3. What each signal is, and what it is not

| Signal | What we measure | Evidence | What we do with it |
|---|---|---|---|
| Risk model | PLCOm2012: age, BMI, education, smoking, COPD, family history | Tammemägi, NEJM 2013. Screening is suggested at 1.51% or more over 6 years. | This is the main number. |
| Guideline | USPSTF 2021: age 50–80, 20+ pack-years, quit 15 years ago or less | Insurance coverage depends on it | Shows a check or a cross for each rule. |
| Exhale time | Seconds of a forced exhale | A long forced exhale is a known sign of blocked airways at the bedside | "Ask for spirometry." It does not change the risk. It shows "if COPD is confirmed, your risk becomes X%". |
| Finger clubbing | Depth at the nail fold ÷ depth at the last joint | Above 1.0 is a clubbing sign. About 5–15% of people with lung cancer have clubbing. | A red flag: "see a doctor this week". |
| Nail-bed color | Red share after white balance | Mannino et al., Nature Communications 2018 (hemoglobin from fingernail photos) | Experimental only. It suggests a blood test (CBC). |
| AI lung sounds | Crackles and wheezes in 2.5 s windows | Trained on ICBHI 2017 | Experimental. It is a talking point for a doctor. |

**The rule for symptoms:** if a person has a red flag, Lungitude tells them to see a doctor. It does not tell them to get a screening scan. Screening is only for people with no symptoms. EvergreenHealth's program has the same rule.

---

## 4. Your idea: "AI that detects the type of cancer from breathing patterns"

### The direct answer

No public dataset links breathing sounds or breathing patterns to lung cancer. No dataset links them to the **type** of lung cancer either (for example, adenocarcinoma, squamous cell or small cell). A doctor can find the type only from a biopsy. If you claim that your app does this, a judge with medical knowledge will ask "what did you train on?", and you will have no answer.

### What does exist

| Data | What it has | Use it? |
|---|---|---|
| **ICBHI 2017 Respiratory Sound Database** | 920 recordings, 126 patients, 6,898 breathing cycles. Each cycle has a crackle and wheeze label. Diagnoses include COPD and respiratory infections. | **Yes. This is your AI.** It is free for research. |
| Clinical Breathomics Dataset (Scientific Data, 2024) | Chemical breath data (GC-MS) for asthma, bronchiectasis and COPD, 121 samples. It has no cancer data. | It is not audio. Mention it only as future work. |
| Electronic-nose lung cancer studies | Chemical breath sensors. Some studies even predict the cancer type. | The data is **not public**. Use it as "where this goes next" in the pitch. |

### How to keep your idea and stay honest

The AI classifies **the type of breath sound**: normal, crackle, wheeze, or both. Crackles and wheezes are signs of COPD and other lung disease. COPD is a risk factor in the cancer model. Thus the AI result goes to the doctor as a talking point, and the validated model makes the risk decision.

> Pitch line: "Lungitude's AI hears what a stethoscope hears. It does not guess cancer. It finds the people who need the one test that does find cancer."

### Data to fetch

1. **ICBHI 2017** from `bhichallenge.med.auth.gr/ICBHI_2017_Challenge`. Unzip it into `ml/icbhi/`. Also download `ICBHI_challenge_train_test.txt` (the official split).
2. **CDC PLACES county data**: run `php tools/fetch_places.php`.
3. (Optional) The **ACR Lung Cancer Screening Locator** list for King County and Snohomish County. Add the real screening sites to `data/demo_places.json` with `"verified": true`.

### Train

```
pip install numpy scipy scikit-learn --break-system-packages
python3 ml/train_icbhi.py ml/icbhi
```

The script splits the data **by patient**. If you split by cycle, the same person can be in both the training data and the test data, and the score will be falsely high. The script prints the official ICBHI score: (specificity + sensitivity) ÷ 2. Expect a realistic score (published simple models often score about 0.5–0.6). Do not expect 0.95. Report the true number. Honesty gets more points than a high number.

The script writes `data/lung_model.json`. The browser loads it, and the AI panel appears. The JavaScript features are the same as the Python features (tested: maximum difference 5e-15).

**Known limit:** ICBHI was recorded with stethoscopes. A phone pressed on the chest is a different input. Say this in the video.

---

## Accuracy study (backend)

Each finger measurement is done **3 times**. The backend (`bw_pdr_from_trials()` in `api/lib.php`) applies these rules:

- It drops ratios outside 0.6–1.6. These come from wrong taps.
- It uses the **median** of the valid trials.
- If the trials differ by more than **0.05**, the result is "unsteady". The app then does not use the value, and asks the person to measure again.

On the results page, a person can tick a consent box and share their **numbers only**: age range, smoking status, finger trials, exhale time, window test answer and pulse. The data goes to `data/study.sqlite` through `api/log.php`. The app saves no name, no photo, no audio, no location, no exact age and no time of day.

`study.html` (it reads `api/stats.php`) shows: the number of people, how often the 3 trials agreed, the median spread, and a histogram of the ratios. Use it in the video: "We tested N people. The same finger gave the same answer within 0.05 in X% of cases."

To reset the study, delete `data/study.sqlite`. The file is in `.gitignore`.

## Pulse check (camera and flash)

`js/pulse.js` measures the heart rate when the fingertip covers the back camera and the flash (photoplethysmography). The method is autocorrelation. A sharp peak also means good signal quality, and a weak peak makes the app ask for a retake. Test results: the error was below 0.6 bpm on simulated signals from 42 to 170 bpm, and the fake-camera browser test read 72 bpm correctly.

- **A fingertip, not the wrist or arm.** The camera must see light pass through thin skin. On the wrist, the camera sees only the skin surface, and the signal is too weak.
- **Blood oxygen (SpO2):** the user types it in from a clip-on pulse oximeter. A phone camera has no second light color and no calibration, so the app does not guess SpO2. A reading of **92% or lower at rest** is a red flag ("see a doctor soon"). A reading of 93–94% is "measure again".
- **These are lung and heart signals, not cancer signs.** Low oxygen means "get checked now". It does not mean "you have cancer". The app does not add pulse or oxygen to the cancer risk number.
- **The torch** (flash) turns on automatically in Chrome on Android. iPhone Safari cannot turn on the flash from a web page, so the app asks the user to hold the phone near a bright light.

---

## 5. Timeline

### Today, 10:50 – 1:30

| Time | Do this | Done when |
|---|---|---|
| 10:50 | **Start the ICBHI download first.** It is large. Then run the app and click through the demo. | You see the results page. |
| 11:00 | Check that **WA-01 is a participating district** on congressionalappchallenge.us. Read the 2026 rules for the video length and the written questions. | You know the video limit and the questions. |
| 11:10 | Read `api/lib.php` and `js/results.js`. Each team member explains one card to the others. | Everyone can explain the risk number. |
| 11:30 | Run `php tools/fetch_places.php`. Run `php tests/test_risk.php`. | The county card shows real numbers. 9 PASS. |
| 11:45 | Train the AI (section 4). Write down the true ICBHI score. | `data/lung_model.json` exists. |
| 12:15 | Test on real people: an exhale, a finger photo, the window test, and a chest recording. Use 3 people. Write down every confusing moment. | You have a list of problems. |
| 12:45 | Fix the top 3 problems from that list. | — |
| 1:10 | Put the code on GitHub (public repository, with this README). | You have a link. |
| 1:20 | Write the one-sentence pitch and the "why we built this" story in your own words. | — |

### Until the deadline: Oct 26, 2026, 12:00 p.m. ET (9:00 a.m. Pacific)

| Dates | Goal |
|---|---|
| Oct 4 – 11 | Test with 5 adults aged 50 or more (for example, family friends). Adjust the wording until no person needs help. Add 3 real WA-01 screening sites from the ACR locator. |
| Oct 12 – 18 | Polish: large text, a Spanish version of the results (about 10% of WA-01 is Hispanic), and phone layout checks. |
| Oct 19 – 22 | Record the demo video (script below). Write the answers to the written questions. |
| Oct 23 | **Submit.** Use the 3 extra days only for problems. |

---

## 6. Ideas from past winners, and how Lungitude uses them

| Past winner | Idea | Lungitude |
|---|---|---|
| AnemoDx, **WA-01 2025** (Redmond High) | A phone camera screens for anemia with no needle | We use the same no-needle camera idea, but for a lung sign (clubbing). We keep nail color as a small extra and give AnemoDx credit for it. Do not make a second anemia app for the same judges. |
| BreatheAI, WA-08 2019 | AI finds pneumonia on chest X-rays | Our AI is on lung sounds. We report the true test score. |
| MediConnect, WA-08 2025 | Gets the right health data to the right person at the right time | The doctor note and the call script remove the hardest step: the first phone call. |

Patterns that these winners share: a real personal reason, a check with no needles, a real gap in local access, and an app that works in the demo.

## 7. Demo video script (about 2 minutes)

1. **Hook (10 s):** "In Washington, only 15.8% of the people who qualify for a lung cancer scan get one. That ranks 37th of 51."
2. **Why (15 s):** Your personal reason. Keep it true and short.
3. **Live demo (75 s):** Do the exhale on camera, take the finger photo with 4 taps, then show the results: the verdict, the walk radar, the call script, and the printed doctor note.
4. **How it works (15 s):** a published model (PLCOm2012), the USPSTF rules, CDC county data, OpenStreetMap, and an AI trained on 126 patients.
5. **Honesty and next step (10 s):** "It does not diagnose. It gets people to the test that does. Next: we want to validate it with a local clinic."

## 8. Questions the judges may ask

- **"Can it detect cancer?"** No. It finds people who should get the scan that detects cancer. That is the gap: only 15.8% get screened.
- **"How accurate is the AI?"** Give the exact ICBHI score from your patient-level split, and explain why the split matters.
- **"Why not train on cancer data?"** No public data links breath sounds to cancer. The chemical breath-sensor studies keep their data private.
- **"Privacy?"** Audio and photos never leave the phone. Only numbers go to the server. Nothing is stored.
- **"Why PHP and no frameworks?"** It is fast and simple to host, it works on bad Wi-Fi, and it has no npm supply-chain risk.

## Sources

- PLCOm2012 coefficients: Tammemägi et al., NEJM 2013. Checked against the Merck Manual calculator.
- American Lung Association, State of Lung Cancer 2025: 18.2% screened in the US. Washington is 15.8% (rank 37/51). Survival is 65% when the cancer is found early and 10% when it is found late.
- USPSTF 2021 lung cancer screening recommendation. CMS NCD 210.14 (Medicare, age 50–77).
- Finger clubbing criteria and the 5–15% figure: Medical News Today review.
- Mannino et al., Nature Communications 2018: hemoglobin from fingernail photos.
- ICBHI 2017: Rocha et al., Physiological Measurement 2019.
- EvergreenHealth lung cancer screening: (425) 899-6972. A referral is needed.
- Congressional App Challenge past winners: congressionalappchallenge.us (25-WA01, 19-WA08, 25-WA08).
