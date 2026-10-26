<?php

/*
 * Optional settings. The app works with no keys.
 *
 * Secret keys go in api/secrets.php. That file is in .gitignore,
 * so it never goes to GitHub. See api/secrets.example.php.
 */
const ORS_KEY = '';

/* Set FORCE_DEMO=1 in the environment, or replace this definition with true for a demo. */
define('FORCE_DEMO', filter_var(getenv('FORCE_DEMO') ?: 'false', FILTER_VALIDATE_BOOL));

$bwSecrets = __DIR__ . '/secrets.php';
if (is_readable($bwSecrets)) {
    require $bwSecrets;
}
if (!defined('GOOGLE_KEY')) {
    define('GOOGLE_KEY', getenv('GOOGLE_PLACES_KEY') ?: '');
}
