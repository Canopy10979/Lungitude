<?php
/*
 * Location -> county, and county -> local data.
 *   County FIPS: US Census Geocoder, then the FCC Area API (both free).
 *   County health data: data/places_county.csv (tools/fetch_places.php),
 *     then the live CDC PLACES API.
 *   County cancer rates: data/wa_county_rates.json (tools/import_scp.php).
 * Lookups are cached for 30 days, because county lines do not move.
 */
require_once __DIR__ . '/lib.php';
require_once __DIR__ . '/store.php';

const BW_DEMO_COUNTY = ['fips' => '53033', 'county' => 'King County', 'state_fips' => '53'];

function bw_county_census(float $lat, float $lon): ?array
{
    $url = 'https://geocoding.geo.census.gov/geocoder/geographies/coordinates?'
        . http_build_query([
            'x' => $lon,
            'y' => $lat,
            'benchmark' => 'Public_AR_Current',
            'vintage' => 'Current_Current',
            'layers' => 'Counties',
            'format' => 'json',
        ]);
    $body = bw_http_get($url);
    if ($body === null) {
        return null;
    }
    $c = json_decode($body, true)['result']['geographies']['Counties'][0] ?? null;
    if ($c === null) {
        return null;
    }
    return ['fips' => $c['GEOID'], 'county' => $c['NAME'], 'state_fips' => $c['STATE']];
}

function bw_county_fcc(float $lat, float $lon): ?array
{
    $body = bw_http_get("https://geo.fcc.gov/api/census/area?lat=$lat&lon=$lon&format=json");
    if ($body === null) {
        return null;
    }
    $r = json_decode($body, true)['results'][0] ?? null;
    if ($r === null) {
        return null;
    }
    return ['fips' => $r['county_fips'], 'county' => $r['county_name'], 'state_fips' => $r['state_fips']];
}

function bw_county_lookup(float $lat, float $lon): ?array
{
    $key = sprintf('county:%.3f,%.3f', $lat, $lon);
    $hit = bw_cache_get($key);
    if ($hit !== null) {
        return $hit;
    }
    $geo = bw_county_census($lat, $lon) ?? bw_county_fcc($lat, $lon);
    if ($geo !== null) {
        bw_cache_set($key, $geo, 30 * 86400);
    }
    return $geo;
}

function bw_stats_cache(string $fips): ?array
{
    $file = __DIR__ . '/../data/places_county.csv';
    if (!is_readable($file)) {
        return null;
    }
    $num = function ($v) {
        return ($v ?? '') === '' ? null : (float)$v;
    };
    $fh = fopen($file, 'r');
    fgetcsv($fh);
    while (($row = fgetcsv($fh)) !== false) {
        if ($row[0] === $fips) {
            fclose($fh);
            return [
                'state' => $row[1],
                'county' => $row[2],
                'smoking' => $num($row[4] ?? null),
                'copd' => $num($row[5] ?? null),
                'obesity' => $num($row[6] ?? null),
                'colon_screen' => $num($row[7] ?? null),
                'mammogram' => $num($row[8] ?? null),
                'source' => 'CDC PLACES (cached)',
            ];
        }
    }
    fclose($fh);
    return null;
}

function bw_stats_live(string $fips): ?array
{
    $key = 'places:' . $fips;
    $hit = bw_cache_get($key);
    if ($hit !== null) {
        return $hit;
    }
    $body = bw_http_get('https://data.cdc.gov/resource/i46a-9kgh.json?countyfips=' . urlencode($fips));
    if ($body === null) {
        return null;
    }
    $row = json_decode($body, true)[0] ?? null;
    if ($row === null) {
        return null;
    }
    $pick = function (string $m) use ($row) {
        $v = $row[$m . '_adjprev'] ?? $row[$m . '_crudeprev'] ?? null;
        return $v === null ? null : (float)$v;
    };
    $stats = [
        'state' => $row['stateabbr'] ?? '',
        'county' => $row['countyname'] ?? '',
        'smoking' => $pick('csmoking'),
        'copd' => $pick('copd'),
        'obesity' => $pick('obesity'),
        'colon_screen' => $pick('colon_screen'),
        'mammogram' => $pick('mammouse'),
        'source' => 'CDC PLACES (live)',
    ];
    bw_cache_set($key, $stats, 7 * 86400);
    return $stats;
}

function bw_county_stats(string $fips): ?array
{
    return bw_stats_cache($fips) ?? bw_stats_live($fips);
}

function bw_national(): ?array
{
    $file = __DIR__ . '/../data/places_national.json';
    if (!is_readable($file)) {
        return null;
    }
    return json_decode(file_get_contents($file), true);
}

/* County cancer rates by survey group, from tools/import_scp.php. */
function bw_county_rates(string $fips): ?array
{
    static $all = null;
    if ($all === null) {
        $file = __DIR__ . '/../data/wa_county_rates.json';
        $all = is_readable($file) ? json_decode(file_get_contents($file), true) : [];
    }
    return $all['counties'][$fips] ?? null;
}
