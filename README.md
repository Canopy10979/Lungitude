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

The repository excludes secrets; copy `api/secrets.example.php` to `api/secrets.php` and configure your key locally. Places and Geocoding require their respective APIs and billing to be enabled in the key's Google Cloud project. Missing access is shown as an error; manual Washington county selection remains available. Keep `api/secrets.php` private.

## Current capabilities

The questionnaire accepts whole-number ages 0–120, including zero. Adult BMI categories are not applied below age 20. Existing screening age criteria remain in effect. The recording page includes three movable, resizable regions with live zoom panels, a REC indicator, elapsed timer and manual recording stop. These manually selected regions do not track people or detect cancer.

The camera supports front/rear selection, still photo capture, 10-second recording, preview/playback and local downloads. Consent withdrawal stops capture and removes local previews. The questionnaire leads to optional recording/imaging checks, then educational next steps and a Google Places search for up to five healthcare listings within a strict 10-mile radius. Listings are ordered by straight-line distance, not clinical quality. The supplied Washington map is presented specifically as a breast/cervical screening network with an unknown publication date.

The imaging lab computes descriptive asymmetry/border, color and texture measurements from a manually outlined lesion. Follow-up comparison accepts dated photos with ruler calibration and attempts image registration. Vessel analysis needs suitable dermoscopic imaging and is unavailable. These measurements do not determine malignancy.

## Install on a phone

Open the HTTPS site in Safari and choose Share → Add to Home Screen (Open as Web App), or use the browser installation menu on Android. Local testing works on localhost. Other devices need an HTTPS host. The PHP server remains required for survey and lung results; installation does not package PHP.

MobileNet and EfficientNet research training scripts and a local inference endpoint are included. No trained cancer checkpoints or real-data accuracy results are supplied. CNN inference stays disabled until a compatible PAD-UFES-20 checkpoint is trained. Video analysis is a frame-ensemble research experiment, not a trained temporal cancer detector. Breathing and ordinary camera recordings cannot diagnose lung, pancreatic or colon cancer.

See `ml/skin/README.md` for training commands. PHP risk/survey tests and JavaScript syntax checks passed during development. Dataset rates in the original prototype still require source verification before clinical use.

---

## Model status

No trained lung-sound or skin model is supplied. The lung-sound panel stays hidden unless an installed model includes a patient-level test score. Image, audio, pulse and finger prototypes are not validated cancer assessments.

## What data goes where

The survey sends age, optional BMI, symptom answers and your selected county or shared coordinates to this PHP server. Your name stays in page memory. The lung check sends health history and numeric observations to the risk endpoint. These endpoints calculate results without writing survey or risk answers to a database.

If you share coordinates, the server may send them to the US Census Geocoder and FCC for county lookup, and to Google Places for nearby healthcare. A ZIP lookup sends the ZIP code to Google Geocoding. County identifiers may be sent to CDC PLACES. Opening external maps or websites shares your request with that provider. Server and hosting logs may record IP addresses and request URLs.

data/cache.sqlite stores rounded coordinate-to-county lookups for up to 30 days, county statistics for up to 7 days, and IP-derived rate-limit buckets with expiry timestamps. Expired records can remain on disk until cleanup; no Google Places responses are cached by the app. The service worker caches only public interface files, never API responses or Google data.

The optional research study sends numeric measurements, age band and smoking status after consent and stores them with a date in data/study.sqlite. It does not save the name, photo or audio in that database. There is no automatic study-record deletion; the server operator must manage retention.

The separate imaging prototypes can upload photos and masks to the PHP server, which forwards them to a Python service on the same server. PHP uses temporary upload files; Python processing and any configured server logging are outside browser storage. Main survey results do not require images, Python or an AI model. No trained lung-sound or skin model is supplied.
