<?php
/*
 * Google Places healthcare listings: nearest five within 10 miles.
 * Straight-line distance is independent of routing and treatment quality.
 */
require __DIR__ . '/lib.php';
require __DIR__ . '/config.php';
require __DIR__ . '/store.php';

const SEARCH_RADIUS_METERS = 16093.44; // exactly 10 statute miles
const GOOGLE_MAX_PER_HOUR = 30;   // paid searches per visitor per hour

const WALK_MIN_LIMIT = 20;
const METERS_PER_MIN = 80;
const DETOUR = 1.25;

$lat = (float)($_GET['lat'] ?? 0);
$lon = (float)($_GET['lon'] ?? 0);

function bw_overpass(float $lat, float $lon, int $radius): ?array
{
    $a = "(around:$radius,$lat,$lon)";
    $q = "[out:json][timeout:15];("
        . "nwr[\"amenity\"=\"hospital\"]$a;"
        . "nwr[\"amenity\"~\"^(clinic|doctors)$\"]$a;"
        . "nwr[\"healthcare\"~\"^(hospital|clinic|centre|doctor)$\"]$a;"
        . "nwr[\"healthcare:speciality\"~\"radiology|pulmonology|oncology\"]$a;"
        . ");out center tags 80;";

    $ch = curl_init('https://overpass-api.de/api/interpreter');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query(['data' => $q]),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 18,
        CURLOPT_CONNECTTIMEOUT => 4,
        CURLOPT_USERAGENT => 'Lungitude/1.0 (hackathon prototype)',
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($body === false || $code >= 400) {
        return null;
    }
    return json_decode($body, true)['elements'] ?? null;
}

function bw_classify(array $tags): string
{
    $spec = $tags['healthcare:speciality'] ?? '';
    if (($tags['amenity'] ?? '') === 'hospital' || ($tags['healthcare'] ?? '') === 'hospital') {
        return 'ct';
    }
    if (preg_match('/radiology|oncology|pulmonology/', $spec)) {
        return 'ct';
    }
    return 'primary';
}

function bw_places(array $elements, float $lat, float $lon): array
{
    $seen = [];
    $places = [];
    foreach ($elements as $e) {
        $tags = $e['tags'] ?? [];
        $name = $tags['name'] ?? null;
        if ($name === null) {
            continue;
        }
        $key = strtolower($name);
        if (isset($seen[$key])) {
            continue;
        }
        $seen[$key] = true;
        $plat = $e['lat'] ?? $e['center']['lat'] ?? null;
        $plon = $e['lon'] ?? $e['center']['lon'] ?? null;
        if ($plat === null) {
            continue;
        }
        $meters = bw_haversine_m($lat, $lon, $plat, $plon);
        $addr = trim(($tags['addr:housenumber'] ?? '') . ' ' . ($tags['addr:street'] ?? ''));
        $places[] = [
            'name' => $name,
            'kind' => bw_classify($tags),
            'lat' => $plat,
            'lon' => $plon,
            'address' => $addr,
            'phone' => $tags['phone'] ?? $tags['contact:phone'] ?? null,
            'website' => $tags['website'] ?? $tags['contact:website'] ?? null,
            'meters' => round($meters),
            'bearing' => round(bw_bearing($lat, $lon, $plat, $plon)),
            'walk_min' => (int)round($meters * DETOUR / METERS_PER_MIN),
            'walk_source' => 'estimate',
        ];
    }
    return $places;
}

function bw_ors_times(array &$places, float $lat, float $lon): void
{
    if (ORS_KEY === '' || count($places) === 0) {
        return;
    }
    $locs = [[$lon, $lat]];
    foreach ($places as $p) {
        $locs[] = [$p['lon'], $p['lat']];
    }
    $ch = curl_init('https://api.openrouteservice.org/v2/matrix/foot-walking');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_HTTPHEADER => ['Authorization: ' . ORS_KEY, 'Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode([
            'locations' => $locs,
            'sources' => [0],
            'metrics' => ['duration', 'distance'],
        ]),
    ]);
    $m = json_decode((string)curl_exec($ch), true);
    curl_close($ch);
    if (!isset($m['durations'][0])) {
        return;
    }
    foreach ($places as $i => &$p) {
        $sec = $m['durations'][0][$i + 1] ?? null;
        if ($sec !== null) {
            $p['walk_min'] = (int)round($sec / 60);
            $p['walk_source'] = 'route';
        }
    }
    unset($p);
}

function bw_google_places(float $lat, float $lon, string $query): ?array
{
    if (GOOGLE_KEY === '') {
        return null;
    }
    $ch = curl_init('https://places.googleapis.com/v1/places:searchNearby');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_CONNECTTIMEOUT => 4,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'X-Goog-Api-Key: ' . GOOGLE_KEY,
            'X-Goog-FieldMask: places.displayName,places.formattedAddress,places.location,'
                . 'places.nationalPhoneNumber,places.websiteUri',
        ],
        CURLOPT_POSTFIELDS => json_encode([
            'includedTypes' => ['hospital', 'doctor'],
            'maxResultCount' => 20,
            'rankPreference' => 'DISTANCE',
            'locationRestriction' => [
                'circle' => [
                    'center' => ['latitude' => $lat, 'longitude' => $lon],
                    'radius' => SEARCH_RADIUS_METERS,
                ],
            ],
        ]),
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($body === false || $code >= 400) {
        error_log('Google Places failed: HTTP ' . $code);
        return null;
    }
    $data = json_decode($body, true);
    if (!is_array($data) || isset($data['error'])) return null;
    $data['places'] = $data['places'] ?? [];

    $places = [];
    foreach ($data['places'] as $g) {
        $plat = $g['location']['latitude'];
        $plon = $g['location']['longitude'];
        $meters = bw_haversine_m($lat, $lon, $plat, $plon);
        $places[] = [
            'name' => $g['displayName']['text'] ?? 'Screening site',
            'kind' => 'healthcare',
            'lat' => $plat,
            'lon' => $plon,
            'address' => $g['formattedAddress'] ?? '',
            'phone' => $g['nationalPhoneNumber'] ?? null,
            'website' => $g['websiteUri'] ?? null,
            'meters' => round($meters),
            'bearing' => round(bw_bearing($lat, $lon, $plat, $plon)),
            'walk_min' => (int)round($meters * DETOUR / METERS_PER_MIN),
            'walk_source' => 'estimate',
        ];
    }
    return $places;
}

/* Place search words for each survey group. Only these keys are allowed. */
function bw_place_query(string $type): string
{
    if ($type === 'lung') {
        return 'lung cancer screening low-dose CT';
    }
    if ($type === 'primary') {
        return 'primary care clinic';
    }
    $data = json_decode(file_get_contents(__DIR__ . '/../data/wa_cancers.json'), true);
    if (isset($data['groups'][$type])) {
        return $data['groups'][$type]['place_query'];
    }
    return 'lung cancer screening low-dose CT';
}

function bw_demo_places(float $lat, float $lon, string $type): array
{
    $rows = json_decode(file_get_contents(__DIR__ . '/../data/demo_places.json'), true);
    if ($type !== 'lung') {
        $names = [
            'primary' => 'Primary Care',
            'breast' => 'Breast Imaging Center',
            'colorectal' => 'Digestive Health Clinic',
            'urinary' => 'Urology Clinic',
            'skin' => 'Dermatology Clinic',
            'blood' => 'Hematology and Oncology',
            'liver_pancreas' => 'Liver and Digestive Clinic',
        ];
        $label = $names[$type] ?? 'Clinic';
        $offsets = [[450, 300], [-700, 520], [980, -640], [-1500, -1100], [2300, 1700]];
        $rows = [];
        foreach ($offsets as $i => $o) {
            $rows[] = [
                'name' => 'Sample ' . $label . ' ' . chr(65 + $i),
                'kind' => 'ct',
                'address' => 'Sample data',
                'phone' => '(555) 010-01' . str_pad((string)($i + 10), 2, '0', STR_PAD_LEFT),
                'dn' => $o[0],
                'de' => $o[1],
            ];
        }
    }
    $places = [];
    foreach ($rows as $r) {
        if (isset($r['lat'])) {
            $plat = $r['lat'];
            $plon = $r['lon'];
        } else {
            $plat = $lat + $r['dn'] / 111320;
            $plon = $lon + $r['de'] / (111320 * cos(deg2rad($lat)));
        }
        $meters = bw_haversine_m($lat, $lon, $plat, $plon);
        $places[] = [
            'name' => $r['name'],
            'kind' => $r['kind'],
            'lat' => $plat,
            'lon' => $plon,
            'address' => $r['address'],
            'phone' => $r['phone'] ?? null,
            'website' => $r['website'] ?? null,
            'verified' => $r['verified'] ?? false,
            'meters' => round($meters),
            'bearing' => round(bw_bearing($lat, $lon, $plat, $plon)),
            'walk_min' => (int)round($meters * DETOUR / METERS_PER_MIN),
            'walk_source' => 'estimate',
        ];
    }
    return $places;
}

// Reject missing, invalid or out-of-range coordinates before paid calls.
$rawLat = filter_var($_GET['lat'] ?? null, FILTER_VALIDATE_FLOAT);
$rawLon = filter_var($_GET['lon'] ?? null, FILTER_VALIDATE_FLOAT);
if ($rawLat === false || $rawLat === null || $rawLon === false || $rawLon === null ||
    !is_finite($rawLat) || !is_finite($rawLon) || abs($rawLat) > 90 || abs($rawLon) > 180) {
    bw_json(['error' => 'Provide a valid location or ZIP code.', 'places' => []], 400); exit;
}
$lat = (float)$rawLat; $lon = (float)$rawLon;
if (GOOGLE_KEY === '') { bw_json(['error' => 'Google Places is not configured on the server.', 'places' => []], 503); exit; }
if (!bw_rate_ok('google', GOOGLE_MAX_PER_HOUR)) { bw_json(['error' => 'Search limit reached. Please try again later.', 'places' => []], 429); exit; }
$places = bw_google_places($lat, $lon, 'healthcare');
if ($places === null) { bw_json(['error' => 'Google Places could not complete this search. Check Places API (New), billing and server-key restrictions.', 'places' => []], 502); exit; }
// Independently enforce the radius, deduplicate listings and sort by straight-line distance.
$seen = [];
$places = array_values(array_filter($places, function ($p) use (&$seen, $lat, $lon) {
    $meters = bw_haversine_m($lat, $lon, $p['lat'], $p['lon']);
    $key = strtolower($p['name'] . '|' . $p['address']);
    if ($meters > SEARCH_RADIUS_METERS || isset($seen[$key])) return false;
    $seen[$key] = true;
    return true;
}));
usort($places, fn($a, $b) => bw_haversine_m($lat,$lon,$a['lat'],$a['lon']) <=> bw_haversine_m($lat,$lon,$b['lat'],$b['lon']));
$places = array_slice($places, 0, 5);
foreach ($places as &$pl) {
    $pl['miles'] = round(bw_haversine_m($lat,$lon,$pl['lat'],$pl['lon']) / 1609.344, 2);
    $pl['drive_min'] = max(2, (int)round($pl['meters'] * 1.4 / 500));
}
unset($pl);
bw_json(['sample' => false, 'source' => 'google', 'origin' => ['lat' => $lat, 'lon' => $lon],
    'radius_miles' => 10, 'radius_meters' => SEARCH_RADIUS_METERS, 'distance_basis' => 'straight_line',
    'type' => 'healthcare', 'places' => $places]);
