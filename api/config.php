<?php
/*
 * Optional settings. The app works with no keys.
 *
 * Secret keys go in api/secrets.php. That file is in .gitignore,
 * so it never goes to GitHub. See api/secrets.example.php.
 */
const ORS_KEY = '';

/* Set to true to force sample data (use this if venue Wi-Fi fails). */
const FORCE_DEMO = false;

$bwSecrets = __DIR__ . '/secrets.php';
if (is_readable($bwSecrets)) {
    require $bwSecrets;
}
if (!defined('GOOGLE_KEY')) {
    define('GOOGLE_KEY', getenv('GOOGLE_PLACES_KEY') ?: '');
}
