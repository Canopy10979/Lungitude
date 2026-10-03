<?php
/*
 * GET: what is set up and what is missing. Open it in the browser:
 *     http://localhost:8000/api/health.php
 * It never shows the API key itself.
 */
require __DIR__ . '/lib.php';
require __DIR__ . '/config.php';

$dataDir = realpath(__DIR__ . '/../data');

function bw_file_info(string $path): array
{
    if (!is_readable($path)) {
        return ['ok' => false];
    }
    return ['ok' => true, 'updated' => gmdate('Y-m-d', filemtime($path)), 'bytes' => filesize($path)];
}

$ratesFile = $dataDir . '/wa_county_rates.json';
$rates = is_readable($ratesFile) ? json_decode(file_get_contents($ratesFile), true) : null;

$checks = [
    'php_version' => PHP_VERSION,
    'php_8_or_newer' => PHP_MAJOR_VERSION >= 8,
    'curl_extension' => extension_loaded('curl'),
    'pdo_sqlite_extension' => extension_loaded('pdo_sqlite'),
    'data_folder_writable' => is_writable($dataDir),
    'google_key_set' => GOOGLE_KEY !== '',
    'openrouteservice_key_set' => ORS_KEY !== '',
    'force_demo' => FORCE_DEMO,
    'files' => [
        'wa_cancers.json (built in)' => bw_file_info($dataDir . '/wa_cancers.json'),
        'places_county.csv (php tools/fetch_places.php)' => bw_file_info($dataDir . '/places_county.csv'),
        'wa_county_rates.json (php tools/import_scp.php)' => bw_file_info($ratesFile),
        'lung_model.json (python3 ml/train_icbhi.py)' => bw_file_info($dataDir . '/lung_model.json'),
    ],
    'county_rate_cancers' => $rates ? array_keys($rates['years'] ?? []) : [],
];

$todo = [];
if (!$checks['curl_extension']) {
    $todo[] = 'Turn on the curl extension in php.ini (remove the ; before extension=curl).';
}
if (!$checks['pdo_sqlite_extension']) {
    $todo[] = 'Turn on pdo_sqlite in php.ini (remove the ; before extension=pdo_sqlite).';
}
if (!$checks['data_folder_writable']) {
    $todo[] = 'Make the data folder writable, so the study log and cache can save.';
}
if (!$checks['google_key_set']) {
    $todo[] = 'Add your Google key to api/secrets.php for real clinics and phone numbers.';
}
if (!$checks['files']['places_county.csv (php tools/fetch_places.php)']['ok']) {
    $todo[] = 'Run: php tools/fetch_places.php';
}
if (!$checks['files']['wa_county_rates.json (php tools/import_scp.php)']['ok']) {
    $todo[] = 'Export county CSVs (see data/scp/README.txt), then run: php tools/import_scp.php';
}
$checks['todo'] = $todo;
$checks['ready'] = $checks['curl_extension'] && $checks['pdo_sqlite_extension'] && $checks['data_folder_writable'];

header('Content-Type: application/json');
echo json_encode($checks, JSON_PRETTY_PRINT);
