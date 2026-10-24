<?php
/*
 * GET lat, lon -> county -> local lung health context (used by lung.html).
 * The lookup functions are in geo.php.
 */
require __DIR__ . '/config.php';
require __DIR__ . '/geo.php';

$lat = (float)($_GET['lat'] ?? 0);
$lon = (float)($_GET['lon'] ?? 0);
$demo = FORCE_DEMO || isset($_GET['demo']);

if ($demo) {
    $sample = json_decode(file_get_contents(__DIR__ . '/../data/demo_region.json'), true);
    bw_json($sample);
    exit;
}

$geo = bw_county_lookup($lat, $lon);
if ($geo === null) {
    $sample = json_decode(file_get_contents(__DIR__ . '/../data/demo_region.json'), true);
    $sample['note'] = 'Could not look up your county. Showing sample data.';
    bw_json($sample);
    exit;
}

$stats = bw_county_stats($geo['fips']);

/* State screening rates we have checked by hand. Add more states from lung.org. */
$evidence = json_decode(file_get_contents(__DIR__ . '/../data/wa_cancers.json'), true);
$context = $evidence['screening_context'];
$stateScreening = ['53' => ['rate' => $context['wa_rate'], 'rank' => $context['rank'], 'of' => $context['of'], 'us_rate' => $context['us_rate'], 'source' => 'American Lung Association 2025: ' . $context['source']]];

bw_json([
    'sample' => false,
    'state_screening' => $stateScreening[$geo['state_fips']] ?? null,
    'fips' => $geo['fips'],
    'county' => $stats['county'] ?? $geo['county'],
    'state' => $stats['state'] ?? '',
    'smoking' => $stats['smoking'] ?? null,
    'copd' => $stats['copd'] ?? null,
    'obesity' => $stats['obesity'] ?? null,
    'colon_screen' => $stats['colon_screen'] ?? null,
    'mammogram' => $stats['mammogram'] ?? null,
    'national' => bw_national(),
    'source' => $stats['source'] ?? null,
]);
