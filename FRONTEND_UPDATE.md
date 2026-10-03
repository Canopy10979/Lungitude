# Frontend integration

Run in the Lungitude directory: `php -S localhost:8000` and open http://localhost:8000. PHP needs cURL and PDO SQLite.

The existing PHP backend remains the application backend. Added a responsive survey/results design and all 39 Washington counties as a manual alternative to GPS. County selection sends county_fips to survey.php; nearby search runs only when coordinates are shared. The survey renders before clinic search completes. Sample clinics and fake phone numbers are hidden. Missing county cancer rates are explicitly labeled. Restart clears all survey inputs.

County cancer CSV exports must still be imported with `php tools/import_scp.php`. No real county cancer datasets were included in the uploaded ZIP. Existing statewide figures, screening rules, and their source labels were preserved from the upload; they were not independently validated in this update. County rates are population context, not individual predictions. Age-based screening entries require clinical eligibility review.

Configure your Google Places key privately in api/secrets.php using secrets.example.php. The delivered ZIP excludes secrets.php and generated study/cache data.

Validation: JavaScript syntax check passed; all 39 county identifiers and the frontend/backend county contract were checked. Browser integration test was prepared but could not execute because Chromium was unavailable and its download failed. Visual/mobile verification remains pending. PHP execution was unavailable in the editing environment; run php tests/test_risk.php and php tests/test_survey.php locally before relying on live backend behavior.
