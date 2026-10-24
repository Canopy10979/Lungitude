# Lungitude

A short warning-sign survey for Washington residents, followed by screening information and nearby healthcare listings. Student project by Rishi Jasuja for the 2026 Congressional App Challenge, WA-01. Educational prototype; not a medical device or diagnosis.

## The problem in Washington State

The American Cancer Society estimates **48,590 new cancer cases** and **14,160 cancer deaths** in Washington in **2026** ([ACS state table](https://www.cancer.org/content/dam/cancer-org/research/cancer-facts-and-statistics/annual-cancer-facts-and-figures/2026/sd3-21-cancers-by-state-2026.pdf)). These are projections, not observed counts. The American Lung Association’s **2025** report lists Washington lung-screening uptake at **15.8%**, ranking **37 of 51**, compared with **18.2%** nationally ([ALA Washington report](https://www.lung.org/media/press-releases/fy26-solc-washington)). Screening access and understanding when symptoms need a clinician are distinct problems; this app explains that distinction.

## What Lungitude does

- Asks age, optional BMI and seven warning-sign questions; accepts ages 0–120 without applying adult BMI categories to children.
- Matches reported signs to topics to discuss with a clinician. A match is not a cancer probability or diagnosis.
- Shows age-based screening information with eligibility caveats and a separate lung guideline check.
- Accepts any of Washington’s 39 counties without GPS; optionally searches nearby healthcare using shared coordinates or a ZIP code.
- Labels fictional demo clinic listings and unavailable data explicitly.

Screenshots are in `docs/screenshots/`. Until captured:

- TODO: `docs/screenshots/survey-mobile.png` — survey question at 375px width.
- TODO: `docs/screenshots/results-desktop.png` — results with a warning-sign match, clinician advice, screening context and sample-care label.
- TODO: `docs/screenshots/lung-check.png` — lung demo result with guideline criteria and warning-sign disclaimer.

## How to run it

Install **PHP 8.2 or later**. Core JSON and PDO are used; enable **cURL** for external lookups, **PDO SQLite** for cache and the optional study, and **fileinfo** for research-image uploads. No npm, Composer, CDN, Python or build step is needed for the main survey and lung check.

```sh
git clone https://github.com/Canopy10979/Lungitude.git
cd Lungitude
php -S localhost:8000 router.php
```

Open http://localhost:8000. Do not open HTML as a local file. Use the router so private code, datasets and databases are not served as static downloads. PHP’s development server is for local demos.

**Demo:** set `define('FORCE_DEMO', true);` in place of the environment-based definition in `api/config.php` or start with `FORCE_DEMO=1` in the server environment. Choose **Load demo person** in the survey or lung check. The survey demo displays a sample person and location. With no Google key or failed provider access, care search returns clearly labeled fictional examples. No network or Python is needed for the core demo. External lookups remain unavailable offline; use a manual county or demo location.

**Optional Google key:** copy `api/secrets.example.php` to `api/secrets.php` and set `GOOGLE_KEY`, or set the `GOOGLE_PLACES_KEY` environment variable without creating that file. Never commit the key. Enable Places API (New), and Geocoding API if using ZIP lookup, with billing and appropriate server-key restrictions. Listings are general healthcare places; they are not confirmed screening providers. Call to confirm services, insurance and availability. No key is needed for sample mode.

**Phone installation:** serve through HTTPS, open the site on the phone, and choose Add to Home Screen / Open as Web App in Safari, or the browser installation option on Android. Localhost is supported for development. Installation caches only the public interface; it does not bundle PHP or provide offline medical results. The server must remain reachable.

## How it works

The vanilla HTML/JavaScript interface calls same-origin PHP endpoints. `index.html` is the survey and results flow; `lung.html` is a separate lung guideline check. Research pages are linked only in a labeled section after survey results. Local JSON files supply questions, sources and county identifiers.

| Endpoint | Purpose |
| --- | --- |
| `POST api/survey.php` | Warning-sign matches, age-based screening context, selected county |
| `POST api/risk.php` | Lung guideline rules and an educational PLCOm2012 calculation |
| `GET api/nearby.php` | Up to five nearby general healthcare listings, or labeled fictional examples |
| `GET api/zipcode.php` | Optional Google ZIP-to-coordinate lookup |
| `GET api/region.php` | County lookup and optional local context |
| `GET api/health.php` | Configuration checks without exposing keys |
| `POST api/log.php`, `GET api/stats.php` | Optional consented research-measurement logging and aggregate summary |
| `api/imaging.php` | Research-only proxy to a separate local Python service; not used by the main survey |

The lung risk calculation implements **PLCOm2012**, from Tammemägi et al., *NEJM* **2013**, 368:728–736, [doi:10.1056/NEJMoa1211776](https://doi.org/10.1056/NEJMoa1211776). It estimates six-year lung-cancer risk in people with smoking history. The original development population was aged 55–74; calculations outside the studied population are extrapolations, not validated advice. The 1.51% comparison threshold comes from [Tammemägi et al., PLOS Medicine 2014](https://doi.org/10.1371/journal.pmed.1001761); it is not the USPSTF eligibility rule. This implementation has calculation tests, not clinical validation. Red flags take priority over routine screening.

Screening information is explicitly based on USPSTF final recommendations: lung and colorectal **2021**, breast **2024**, cervical and prostate **2018**. It is a discussion guide, not an order or complete eligibility assessment. Cervical guidance differs across organizations; HRSA updated its guidance in 2026. Sources, years, corrected estimates and removed/unverified values are recorded in `data/wa_cancers.json` and `docs/evidence-audit.md`. Missing county datasets are not filled with invented rates.

## Data and privacy

### What data goes where

The survey sends age, optional BMI, symptom answers and your selected county or shared coordinates to this PHP server. Your name stays in page memory. The lung check sends health history and numeric observations to the risk endpoint. These endpoints calculate results without writing survey or risk answers to a database.

If you share coordinates, the server may send them to the US Census Geocoder and FCC for county lookup, and to Google Places for nearby healthcare. A ZIP lookup sends the ZIP code to Google Geocoding. County identifiers may be sent to CDC PLACES when live county statistics are explicitly enabled. Opening external maps or websites shares your request with that provider. Server and hosting logs may record IP addresses and request URLs.

data/cache.sqlite stores rounded coordinate-to-county lookups for up to 30 days, county statistics for up to 7 days, and IP-derived rate-limit buckets with expiry timestamps. Expired records can remain on disk until cleanup; no Google Places responses are cached by the app. The service worker caches only public interface files, never API responses or Google data.

The optional research study sends numeric measurements, age band and smoking status after consent and stores them with a date in data/study.sqlite. It does not save the name, photo or audio in that database. There is no automatic study-record deletion; the server operator must manage retention.

The separate imaging prototypes can upload photos and masks to the PHP server, which forwards them to a Python service on the same server. PHP uses temporary upload files; Python processing and any configured server logging are outside browser storage. Main survey results do not require images, Python or an AI model. No trained lung-sound or skin model is supplied.

## Limits

Lungitude does not diagnose cancer, analyze a photo for cancer, validate a symptom, or replace a clinician. “No signs reported” does not rule out disease. Age-based screening lists cannot establish suitability without anatomy, history, prior screening and shared decision-making. Concerning symptoms require clinical evaluation rather than waiting for screening. Severe breathing difficulty or another emergency needs emergency care.

No trained lung-sound or skin model is included. The lung-sound panel remains hidden unless `data/lung_model.json` contains patient-level evaluation metadata; if enabled, it displays that file’s ICBHI score and patient count without claiming clinical accuracy. A metadata label is not independent validation of a supplied model.

`lab.html`, `record.html`, `followup.html`, `study.html` and `ml/` are preserved research prototypes. Manually positioned camera regions, finger ratios, audio timing, pulse estimates and lesion descriptors are unvalidated. They cannot detect cancer. Python dependencies belong only to the existing research sidecar; see `ml/skin/README.md`. No research checkpoint is required for the PHP demo. The undated screening-network map is preserved as an unverified asset and is not shown in the main results.

## Tests

Run from the repository root:

```sh
php tests/test_risk.php
php tests/test_survey.php
find . -type f -name '*.php' -not -path './.git/*' -exec php -l {} \;
find . -type f -name '*.js' -not -path './.git/*' -exec node --check {} \;
```

`test_risk.php`: **14 checks passed**. `test_survey.php`: **70 checks passed**. All **20 PHP files** and **14 JavaScript files** pass syntax checks. Additional verification and browser limitations are recorded in `docs/validation.md`. Tests check application behavior and calculations, not medical accuracy.

## Credits and licenses

- **ACS Cancer Facts & Figures 2026:** state estimates, © American Cancer Society; cited values are not a relicensed dataset. See the linked table and ACS reuse terms.
- **American Lung Association, State of Lung Cancer 2025:** cited Washington screening figures; attribution retained, no ownership claimed.
- **USPSTF:** dated final screening recommendations, linked in `data/wa_cancers.json`; clinical exceptions remain important.
- **Washington Department of Health:** county identifiers and the BCCHP program link; program eligibility must be confirmed directly.
- **NCI State Cancer Profiles / CDC PLACES:** optional county imports and lookups, with source-specific years. Unverified statewide incidence values are suppressed. Respect their data documentation and suppression rules.
- **Google Maps Platform:** optional Places and Geocoding services, governed by Google’s terms and billing. Google Places responses are not cached by the app.
- **US Census Geocoder / FCC:** optional coordinate-to-county services. **OpenStreetMap / openrouteservice:** legacy helper code is retained, but the current care-search path does not call it; OSM data is subject to ODbL if those helpers are enabled.
- **PLCOm2012:** cited research above; no endorsement by the authors or institutions is implied.
- **ICBHI 2017 / PAD-UFES-20:** no raw recordings, clinical images or trained weights are supplied. Research scripts require separately obtained data under the providers’ own licenses and consent conditions. Existing research dependency licenses remain applicable.
- AI-assisted maintenance in this revision is documented in `docs/validation.md`; student authorship, understanding and submission disclosures must be documented accurately by the student.

## Why I built this

TODO: Rishi will write this section in his own words.
