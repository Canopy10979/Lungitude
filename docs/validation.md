# Validation — 2026-10-24

## Automated results

- `php tests/test_risk.php`: **14 PASS**, zero failures.
- `php tests/test_survey.php`: **70 PASS**, zero failures. Includes ages 0/120, omitted BMI, zero/one/two/three/seven yes answers, and every one of the 39 Washington county choices.
- `php -l`: **20 PHP files**, zero syntax failures.
- `node --check`: **14 JavaScript files**, zero syntax failures (including the service worker).
- Temporary HTTP integration harness: **70 checks passed** against PHP with no Google key, no Python sidecar and live county-stat lookups disabled. Covered boundary and invalid ages, all counties, answer routing, sample care, ZIP failure, lung results, private-path blocking, static assets and actual security headers.
- Temporary DOM interaction harness: **27 checks passed**. Covered one-click survey and lung demos, age 0/120, omitted BMI, answer counts, denied geolocation, county options, escaped user name, privacy disclosure, prototype-link isolation, sample labels and hidden lung AI panel. This is DOM emulation, not visual/browser validation. Tooling was installed only in scratch, with no project dependency additions.
- `git diff --check` and source conflict-marker scan passed.

## Required manual checks / unfinished P0 verification

Chromium was obtained, but this environment denied its required Unix socket (`socket() failed: Operation not permitted`), preventing browser launch. Consequently **375px/desktop visual checks, actual camera permissions, service-worker lifecycle and iPhone installation have not been verified**. No screenshots were fabricated. P0 must not be described as fully verified until these checks are completed. P1 items 7–10 were deferred; basic focus/tap/overflow safeguards added for item 6 do not constitute a completed accessibility audit.

1. At 375px and desktop width, complete the survey with blank BMI, ages 0 and 120, and 0/1/2/3 yes answers. Deny location and select a county. Confirm readable results, no horizontal scrolling and usable controls.
2. Run with no key and no internet. Choose Load demo person on both main pages. Confirm the warning-sign disclaimer, clinician advice and fictional sample-care label.
3. Capture `docs/screenshots/survey-mobile.png`, `results-desktop.png` and `lung-check.png` as described in the README, using fictional inputs.
4. On HTTPS, install to the phone Home Screen. Check permissions, refresh/update behavior and offline messaging. Inspect Cache Storage: no `/api/` or Google data should appear.
5. With a private server Google key, verify Places API (New), billing and server-key restrictions, then confirm live results. No paid-key live call was tested here.

## Submission tasks for Rishi

- Review the project motivation in the README for accuracy before submitting.
- Record the 1–3 minute demo with participant/app names, audience, purpose, languages/tools and working features. Do not claim cancer detection or validated AI.
- Describe technical challenges and learning outcomes accurately in the submission, based on the implemented features and documented validation results.
- Review district and official 2026 rules. The WA-01 page lists **9:00 a.m. Pacific, October 26**, matching the official PDF’s **12:00 p.m. EDT**. A separate registration page lists a conflicting later time; use the earlier district/PDF deadline and confirm with the organizer if needed.
- Disclose AI assistance fully. This revision used ChatGPT/Codex for source inspection, code edits, documentation, evidence checking and test automation. The student must identify their own contributions, review changes and demonstrate technical understanding; do not describe all development as unaided student work.

Official references checked: [WA-01](https://delbene.house.gov/constituent-services/congressional-app-challenge.htm), [2026 rules PDF](https://www.congressionalappchallenge.us/wp-content/uploads/2026/05/2026-CAC-Rules.pdf), [registration page](https://www.congressionalappchallenge.us/students/student-registration/).
