<?php
/*
 * POST: symptom survey -> warning-sign match, Washington data, screenings due.
 *
 * This is NOT a diagnosis. A "yes" means the person reported warning signs
 * that doctors list for a cancer type. Many common, harmless problems cause
 * the same signs. The output always sends the person to a doctor.
 *
 * The name is never sent here. It stays in the browser.
 */
require_once __DIR__ . '/lib.php';
require_once __DIR__ . '/geo.php';

const BW_MANY_GROUPS = 3;

function bw_bmi_info(?float $bmi): ?array
{
    if ($bmi === null) {
        return null;
    }
    $cat = 'healthy weight';
    if ($bmi < 18.5) {
        $cat = 'underweight';
    }
    if ($bmi >= 25) {
        $cat = 'overweight';
    }
    if ($bmi >= 30) {
        $cat = 'obesity';
    }
    return ['bmi' => round($bmi, 1), 'category' => $cat, 'cancer_link' => $bmi >= 25];
}

/*
 * Adds county data to the survey result. $county is
 * ['fips' => ..., 'county' => ...] or null. $rates comes from
 * bw_county_rates(); $stats from bw_county_stats().
 */
function bw_survey_county(array $result, ?array $county, ?array $stats, ?array $rates, array $years): array
{
    if ($county === null) {
        $result['county'] = null;
        return $result;
    }
    $result['county'] = [
        'fips' => $county['fips'],
        'name' => $county['county'],
        'in_wa' => substr($county['fips'], 0, 2) === '53',
        'stats' => $stats,
        'has_rates' => $rates !== null,
    ];
    foreach ($result['matched'] as &$m) {
        foreach ($m['cancers'] as &$c) {
            $key = $c['scp'] ?? null;
            $r = ($key !== null && $rates !== null) ? ($rates[$key] ?? null) : null;
            $c['county_rate'] = ($r !== null && $r['rate'] !== null)
                ? ['rate' => $r['rate'], 'count' => $r['count'], 'years' => $years[$key] ?? null]
                : null;
        }
        unset($c);
    }
    unset($m);
    return $result;
}

function bw_survey(array $raw, array $data): array
{
    $age = (int)($raw['age'] ?? 0);
    $bmi = bw_range($raw['bmi'] ?? null, 12, 80);
    if ($bmi === null && isset($raw['height_in'], $raw['weight_lb'])) {
        $bmi = bw_range(bw_bmi((float)$raw['height_in'], (float)$raw['weight_lb']), 12, 80);
    }
    $answers = is_array($raw['answers'] ?? null) ? $raw['answers'] : [];

    $matched = [];
    foreach ($data['order'] as $key) {
        if (($answers[$key] ?? false) !== true) {
            continue;
        }
        $g = $data['groups'][$key];
        $matched[] = [
            'key' => $key,
            'label' => $g['label'],
            'specialist' => $g['specialist'],
            'cancers' => $g['cancers'],
            'bmi_linked' => $age >= 20 && $g['bmi_linked'] && $bmi !== null && $bmi >= 25,
            'bmi_note' => $g['bmi_note'] ?? null,
            'smoking_linked' => $g['smoking_linked'],
            'urgent_sign' => $g['urgent_sign'] ?? null,
        ];
    }

    $many = count($matched) >= BW_MANY_GROUPS;
    $placeQuery = 'primary care doctor';
    $placeKey = 'primary';
    if (count($matched) > 0 && !$many) {
        $placeKey = $matched[0]['key'];
        $placeQuery = $data['groups'][$placeKey]['place_query'];
    }

    $screenings = [];
    foreach ($data['screenings'] as $s) {
        if ($age >= $s['from'] && $age <= $s['to']) {
            $screenings[] = $s;
        }
    }

    return [
        'age' => $age,
        'bmi' => $age >= 20 ? bw_bmi_info($bmi) : null,
        'matched' => $matched,
        'result' => count($matched) === 0
            ? 'No warning signs reported'
            : implode(', ', array_column($matched, 'label')),
        'many' => $many,
        'place_key' => $placeKey,
        'place_query' => $placeQuery,
        'screenings_due' => $screenings,
        'free_screening' => ($age >= 21 && $age <= 64) ? $data['free_screening'] : null,
        'wa_all_sites' => $data['wa_all_sites'],
        'sources' => $data['sources'],
    ];
}

if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') === 'survey.php') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        bw_json(['error' => 'POST only'], 405);
        exit;
    }
    $raw = json_decode(file_get_contents('php://input'), true);
    if (!is_array($raw)) {
        bw_json(['error' => 'Body must be JSON'], 400);
        exit;
    }
    $age = filter_var($raw['age'] ?? null, FILTER_VALIDATE_INT);
    if ($age === false || $age === null || $age < 0 || $age > 120) {
        bw_json(['error' => 'Enter a whole-number age from 0 to 120.'], 422);
        exit;
    }
    require __DIR__ . '/config.php';
    $data = json_decode(file_get_contents(__DIR__ . '/../data/wa_cancers.json'), true);
    $result = bw_survey($raw, $data);

    $county = null;
    $lat = bw_range($raw['lat'] ?? null, -90, 90);
    $lon = bw_range($raw['lon'] ?? null, -180, 180);
    if (($raw['demo'] ?? false) === true || FORCE_DEMO) {
        $county = BW_DEMO_COUNTY;
    } elseif (isset($raw['county_fips'])) {
        $counties = json_decode(file_get_contents(__DIR__ . '/../data/wa_counties.json'), true);
        $fips = (string)$raw['county_fips'];
        if (!isset($counties[$fips])) {
            bw_json(['error' => 'Choose a valid Washington county.'], 422);
            exit;
        }
        $county = ['fips' => $fips, 'county' => $counties[$fips], 'state_fips' => '53'];
    } elseif ($lat !== null && $lon !== null) {
        $county = bw_county_lookup($lat, $lon);
    }
    $stats = $county === null ? null : bw_county_stats($county['fips']);
    $rates = $county === null ? null : bw_county_rates($county['fips']);
    $ratesFile = __DIR__ . '/../data/wa_county_rates.json';
    $years = is_readable($ratesFile) ? (json_decode(file_get_contents($ratesFile), true)['years'] ?? []) : [];
    bw_json(bw_survey_county($result, $county, $stats, $rates, $years));
}
