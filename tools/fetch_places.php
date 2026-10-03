<?php
/*
 * Run once:
 *     php tools/fetch_places.php          (Washington's 39 counties)
 *     php tools/fetch_places.php --all    (every US county)
 * Downloads CDC PLACES county data and writes:
 *     data/places_county.csv    fips,state,county,population,smoking,copd,
 *                               obesity,colon_screen,mammogram,cancer
 *     data/places_national.json population-weighted US averages
 * The extra columns are empty if a PLACES release does not have them.
 * After this, the county lookup needs no network.
 */
require __DIR__ . '/../api/lib.php';

$urls = [
    'https://data.cdc.gov/api/views/i46a-9kgh/rows.csv?accessType=DOWNLOAD',
    'https://data.cdc.gov/api/v3/views/i46a-9kgh/export.csv?accessType=DOWNLOAD',
];

$csv = null;
foreach ($urls as $url) {
    echo "Downloading $url\n";
    $csv = bw_http_get($url, 120);
    if ($csv !== null) {
        break;
    }
}
if ($csv === null) {
    fwrite(STDERR, "Download failed. The app will use the live API or sample data.\n");
    exit(1);
}

$lines = preg_split('/\r\n|\n/', trim($csv));
$header = array_map('strtolower', str_getcsv(array_shift($lines)));

function bw_col_optional(array $header, array $names): ?int
{
    foreach ($names as $n) {
        $i = array_search($n, $header, true);
        if ($i !== false) {
            return $i;
        }
    }
    return null;
}

function bw_col(array $header, array $names): int
{
    foreach ($names as $n) {
        $i = array_search($n, $header, true);
        if ($i !== false) {
            return $i;
        }
    }
    fwrite(STDERR, 'Missing column: ' . implode(' or ', $names) . "\n");
    exit(1);
}

$iFips = bw_col($header, ['countyfips', 'locationid']);
$iState = bw_col($header, ['stateabbr']);
$iCounty = bw_col($header, ['countyname', 'locationname']);
$iPop = bw_col($header, ['totalpopulation']);
$iSmoke = bw_col($header, ['csmoking_adjprev', 'csmoking_crudeprev']);
$iCopd = bw_col($header, ['copd_adjprev', 'copd_crudeprev']);
$iObesity = bw_col_optional($header, ['obesity_adjprev', 'obesity_crudeprev']);
$iColon = bw_col_optional($header, ['colon_screen_adjprev', 'colon_screen_crudeprev']);
$iMammo = bw_col_optional($header, ['mammouse_adjprev', 'mammouse_crudeprev']);
$iCancer = bw_col_optional($header, ['cancer_adjprev', 'cancer_crudeprev']);
$onlyWa = !in_array('--all', $argv, true);

function bw_opt(array $r, ?int $i): string
{
    if ($i === null || !isset($r[$i])) {
        return '';
    }
    return $r[$i];
}

$out = fopen(__DIR__ . '/../data/places_county.csv', 'w');
fputcsv($out, ['fips', 'state', 'county', 'population', 'smoking', 'copd', 'obesity', 'colon_screen', 'mammogram', 'cancer']);
$popSum = 0;
$smokeSum = 0;
$copdSum = 0;
$n = 0;
foreach ($lines as $line) {
    $r = str_getcsv($line);
    if (count($r) <= max($iSmoke, $iCopd)) {
        continue;
    }
    $pop = (float)str_replace(',', '', $r[$iPop]);
    $fips = str_pad($r[$iFips], 5, '0', STR_PAD_LEFT);
    /* The national average always uses every county. */
    if (!$onlyWa || $r[$iState] === 'WA') {
        fputcsv($out, [$fips, $r[$iState], $r[$iCounty], $pop, $r[$iSmoke], $r[$iCopd],
            bw_opt($r, $iObesity), bw_opt($r, $iColon), bw_opt($r, $iMammo), bw_opt($r, $iCancer)]);
    }
    $popSum += $pop;
    $smokeSum += $pop * (float)$r[$iSmoke];
    $copdSum += $pop * (float)$r[$iCopd];
    $n++;
}
fclose($out);

file_put_contents(__DIR__ . '/../data/places_national.json', json_encode([
    'smoking' => round($smokeSum / $popSum, 1),
    'copd' => round($copdSum / $popSum, 1),
]));
echo "Saved " . ($onlyWa ? "Washington" : "all") . " counties. US averages use $n counties.\n";
