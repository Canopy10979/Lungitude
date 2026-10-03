<?php
/*
 * Lungitude risk engine.
 *
 * PLCOm2012: Tammemagi et al., NEJM 2013; 368:728-736.
 * Coefficients checked against the Merck Manual PLCOm2012 calculator.
 * Screening cutoff 1.51% over 6 years: Tammemagi et al., PLoS Med 2014.
 * USPSTF 2021: age 50-80, >= 20 pack-years, current smoker or quit <= 15 years ago.
 * Medicare (CMS NCD 210.14, 2022): age 50-77, same smoking rules.
 */

const PLCO_THRESHOLD = 0.0151;

/* Finger measurement quality limits. */
const PDR_MIN = 0.6;          // below this, the taps were wrong
const PDR_MAX = 1.6;          // above this, the taps were wrong
const PDR_SPREAD_MAX = 0.05;  // 3 trials must agree within this range
const PDR_TRIALS_WANTED = 3;

/*
 * Pulse and oxygen. These are lung-health signals, not cancer signs.
 * Blood oxygen comes from a clip-on pulse oximeter that the user types in.
 * A phone camera cannot measure blood oxygen reliably.
 */
const SPO2_LOW = 92;      // at rest, 92% or lower: see a doctor soon
const SPO2_NORMAL = 95;   // 95% or higher is the usual range
const HR_FAST = 100;
const HR_SLOW = 50;

const RACE_COEF = [
    'white' => 0.0,
    'black' => 0.3944778,
    'hispanic' => -0.7434744,
    'asian' => -0.466585,
    'aian' => 0.0,
    'nhpi' => 1.027152,
    'unknown' => 0.0,
];

function bw_bmi(float $heightIn, float $weightLb): float
{
    if ($heightIn <= 0) {
        return 0.0;
    }
    return 703.0 * $weightLb / ($heightIn * $heightIn);
}

function bw_pack_years(float $cigsPerDay, float $yearsSmoked): float
{
    return ($cigsPerDay / 20.0) * $yearsSmoked;
}

/*
 * Returns every PLCOm2012 term separately, so the UI can explain
 * which factors raise or lower the number.
 */
function bw_plco_terms(array $p): array
{
    $bmi = bw_bmi($p['height_in'], $p['weight_lb']);
    $cpd = max(1.0, (float)$p['cigs_per_day']);
    $yearsQuit = $p['current_smoker'] ? 0.0 : (float)$p['years_quit'];

    return [
        'age' => 0.0778868 * ($p['age'] - 62),
        'race' => RACE_COEF[$p['race']] ?? 0.0,
        'education' => -0.0812744 * ($p['education'] - 4),
        'bmi' => -0.0274194 * ($bmi - 27),
        'copd' => 0.3553063 * ($p['copd'] ? 1 : 0),
        'personal_cancer' => 0.4589971 * ($p['personal_cancer'] ? 1 : 0),
        'family_lung_cancer' => 0.587185 * ($p['family_lung_cancer'] ? 1 : 0),
        'current_smoker' => 0.2597431 * ($p['current_smoker'] ? 1 : 0),
        'intensity' => -1.822606 * ((10.0 / $cpd) - 0.4021541613),
        'duration' => 0.0317321 * ($p['years_smoked'] - 27),
        'years_quit' => -0.0308572 * ($yearsQuit - 10),
    ];
}

function bw_plco(array $p): float
{
    $logit = -4.532506 + array_sum(bw_plco_terms($p));
    return exp($logit) / (1 + exp($logit));
}

function bw_criteria(array $p, int $maxAge): array
{
    $packYears = bw_pack_years($p['cigs_per_day'], $p['years_smoked']);
    $ageOk = $p['age'] >= 50 && $p['age'] <= $maxAge;
    $packOk = $packYears >= 20;
    $quitOk = $p['current_smoker'] || $p['years_quit'] <= 15;

    return [
        'age' => $ageOk,
        'pack_years' => $packOk,
        'quit_window' => $quitOk,
        'eligible' => $ageOk && $packOk && $quitOk,
    ];
}

/*
 * Forced expiratory time from the microphone. A long forced exhale
 * is a bedside sign of airflow blockage. It is a prompt to get
 * spirometry, not a diagnosis.
 */
function bw_breath_signal(?float $fet): array
{
    if ($fet === null || $fet <= 0) {
        return ['level' => 'none', 'fet' => null];
    }
    $level = 'typical';
    if ($fet >= 6) {
        $level = 'long';
    }
    if ($fet >= 9) {
        $level = 'very_long';
    }
    return ['level' => $level, 'fet' => round($fet, 1)];
}

function bw_assess(array $p): array
{
    $everSmoker = $p['smoking_status'] !== 'never' && $p['cigs_per_day'] > 0;
    $p['current_smoker'] = $p['smoking_status'] === 'current';

    $redFlags = array_values(array_filter([
        $p['cough_blood'] ? 'coughing up blood' : null,
        $p['weight_loss'] ? 'weight loss you cannot explain' : null,
        $p['hoarse'] ? 'a hoarse voice for more than 3 weeks' : null,
        $p['long_cough'] ? 'a cough that has lasted more than 8 weeks' : null,
        bw_clubbing($p) ? 'signs of finger clubbing' : null,
        $p['spo2'] !== null && $p['spo2'] <= SPO2_LOW
            ? 'a blood oxygen reading of ' . $p['spo2'] . '% at rest'
            : null,
    ]));

    $out = [
        'ever_smoker' => $everSmoker,
        'bmi' => round(bw_bmi($p['height_in'], $p['weight_lb']), 1),
        'pack_years' => round(bw_pack_years($p['cigs_per_day'], $p['years_smoked']), 1),
        'red_flags' => $redFlags,
        'breath' => bw_breath_signal($p['fet'] ?? null),
        'hands' => [
            'pdr' => $p['pdr'] === null ? null : round($p['pdr'], 2),
            'pdr_status' => $p['pdr_status'],
            'pdr_spread' => $p['pdr_spread'],
            'pdr_trials' => $p['pdr_trials'],
            'pdr_repeatable' => $p['pdr_repeatable'],
            'schamroth_closed' => $p['schamroth_closed'],
            'clubbing_sign' => bw_clubbing($p),
            'nail_pallor' => $p['nail_pallor'],
        ],
        'vitals' => bw_vitals($p),
        'risk' => null,
        'drivers' => [],
        'uspstf' => bw_criteria($p, 80),
        'medicare' => bw_criteria($p, 77),
        'what_if' => [],
    ];

    if ($everSmoker) {
        $risk = bw_plco($p);
        $out['risk'] = $risk;
        $out['above_threshold'] = $risk >= PLCO_THRESHOLD;
        $out['drivers'] = bw_drivers($p);

        if ($p['current_smoker']) {
            $q = $p;
            $q['smoking_status'] = 'former';
            $q['current_smoker'] = false;
            $q['years_quit'] = 5;
            $q['age'] = $p['age'] + 5;
            $out['what_if']['quit_now_in_5y'] = bw_plco($q);
            $s = $p;
            $s['age'] = $p['age'] + 5;
            $s['years_smoked'] = $p['years_smoked'] + 5;
            $out['what_if']['keep_smoking_in_5y'] = bw_plco($s);
        }
        if (!$p['copd'] && in_array($out['breath']['level'], ['long', 'very_long'], true)) {
            $c = $p;
            $c['copd'] = true;
            $out['what_if']['if_copd_confirmed'] = bw_plco($c);
        }
    }

    $out['tier'] = bw_tier($out);
    return $out;
}

/*
 * Finger clubbing. Phalangeal depth ratio = finger depth at the nail fold
 * divided by depth at the last finger joint. Above 1.0 is a clubbing sign.
 * Schamroth window: no diamond-shaped gap when two nails press together.
 */
/*
 * Turns 1 to 5 finger measurements into one trusted value.
 *   ok       median of the valid trials (repeatable when 3+ agree)
 *   retake   no trial was in the possible range (wrong taps)
 *   unsteady trials disagree by more than PDR_SPREAD_MAX
 *   none     no measurement
 */
function bw_pdr_from_trials(array $trials): array
{
    $all = array_values(array_filter($trials, 'is_numeric'));
    if (count($all) === 0) {
        return ['status' => 'none', 'pdr' => null, 'spread' => null, 'trials' => [], 'rejected' => 0];
    }
    $valid = array_values(array_filter($all, function ($v) {
        return $v >= PDR_MIN && $v <= PDR_MAX;
    }));
    $rejected = count($all) - count($valid);
    if (count($valid) === 0) {
        return ['status' => 'retake', 'pdr' => null, 'spread' => null, 'trials' => [], 'rejected' => $rejected];
    }
    sort($valid);
    $n = count($valid);
    $median = $n % 2 === 1
        ? $valid[intdiv($n, 2)]
        : ($valid[$n / 2 - 1] + $valid[$n / 2]) / 2;
    $spread = $valid[$n - 1] - $valid[0];
    $status = 'ok';
    if ($n >= 2 && $spread > PDR_SPREAD_MAX) {
        $status = 'unsteady';
    }
    return [
        'status' => $status,
        'pdr' => round($median, 3),
        'spread' => round($spread, 3),
        'trials' => array_map(function ($v) {
            return round($v, 3);
        }, $valid),
        'rejected' => $rejected,
        'repeatable' => $n >= PDR_TRIALS_WANTED && $status === 'ok',
    ];
}

function bw_clubbing(array $p): bool
{
    if ($p['pdr'] !== null && $p['pdr_status'] === 'ok' && $p['pdr'] > 1.0) {
        return true;
    }
    return $p['schamroth_closed'];
}

function bw_vitals(array $p): array
{
    $spo2Level = null;
    if ($p['spo2'] !== null) {
        $spo2Level = 'normal';
        if ($p['spo2'] < SPO2_NORMAL) {
            $spo2Level = 'borderline';
        }
        if ($p['spo2'] <= SPO2_LOW) {
            $spo2Level = 'low';
        }
    }
    $hrLevel = null;
    if ($p['hr_quality'] === null) {
        $p['hr'] = null;
        $p['perfusion'] = null;
    }
    if ($p['hr'] !== null) {
        $hrLevel = 'normal';
        if ($p['hr'] > HR_FAST) {
            $hrLevel = 'fast';
        }
        if ($p['hr'] < HR_SLOW) {
            $hrLevel = 'slow';
        }
    }
    return [
        'hr' => $p['hr'],
        'hr_level' => $hrLevel,
        'hr_quality' => $p['hr_quality'],
        'perfusion' => $p['perfusion'],
        'spo2' => $p['spo2'],
        'spo2_level' => $spo2Level,
    ];
}

function bw_drivers(array $p): array
{
    $labels = [
        'age' => 'Age',
        'race' => 'Background',
        'education' => 'Education',
        'bmi' => 'Body mass index',
        'copd' => 'COPD',
        'personal_cancer' => 'Past cancer',
        'family_lung_cancer' => 'Family history',
        'current_smoker' => 'Still smoking',
        'intensity' => 'Cigarettes per day',
        'duration' => 'Years smoked',
        'years_quit' => 'How recently you quit',
    ];
    $terms = bw_plco_terms($p);
    $rows = [];
    foreach ($terms as $key => $value) {
        if (abs($value) < 0.02) {
            continue;
        }
        $rows[] = ['key' => $key, 'label' => $labels[$key], 'effect' => round($value, 3)];
    }
    usort($rows, function ($a, $b) {
        return abs($b['effect']) <=> abs($a['effect']);
    });
    return array_slice($rows, 0, 5);
}

function bw_tier(array $a): string
{
    if (count($a['red_flags']) > 0) {
        return 'see_doctor_now';
    }
    if (!$a['ever_smoker']) {
        return 'not_in_scope';
    }
    if ($a['uspstf']['eligible'] || !empty($a['above_threshold'])) {
        return 'screen';
    }
    return 'not_yet';
}

/* A number inside [lo, hi], else null. Bad input never becomes a result. */
function bw_range($v, float $lo, float $hi): ?float
{
    if ($v === null || $v === '' || !is_numeric($v)) {
        return null;
    }
    $v = (float)$v;
    if ($v < $lo || $v > $hi) {
        return null;
    }
    return $v;
}

function bw_input(array $raw): array
{
    $bool = function ($v) {
        return $v === true || $v === 1 || $v === '1' || $v === 'true' || $v === 'on';
    };
    $trials = $raw['pdr_trials'] ?? [];
    if (!is_array($trials)) {
        $trials = [];
    }
    if (count($trials) === 0 && isset($raw['pdr']) && is_numeric($raw['pdr'])) {
        $trials = [(float)$raw['pdr']];
    }
    $pdr = bw_pdr_from_trials(array_slice($trials, 0, 5));
    return [
        'age' => (int)($raw['age'] ?? 0),
        'height_in' => (float)($raw['height_in'] ?? 0),
        'weight_lb' => (float)($raw['weight_lb'] ?? 0),
        'education' => max(1, min(6, (int)($raw['education'] ?? 4))),
        'race' => array_key_exists($raw['race'] ?? '', RACE_COEF) ? $raw['race'] : 'unknown',
        'smoking_status' => in_array($raw['smoking_status'] ?? '', ['never', 'former', 'current'], true)
            ? $raw['smoking_status']
            : 'never',
        'cigs_per_day' => max(0.0, (float)($raw['cigs_per_day'] ?? 0)),
        'years_smoked' => max(0.0, (float)($raw['years_smoked'] ?? 0)),
        'years_quit' => max(0.0, (float)($raw['years_quit'] ?? 0)),
        'copd' => $bool($raw['copd'] ?? false),
        'personal_cancer' => $bool($raw['personal_cancer'] ?? false),
        'family_lung_cancer' => $bool($raw['family_lung_cancer'] ?? false),
        'cough_blood' => $bool($raw['cough_blood'] ?? false),
        'weight_loss' => $bool($raw['weight_loss'] ?? false),
        'hoarse' => $bool($raw['hoarse'] ?? false),
        'long_cough' => $bool($raw['long_cough'] ?? false),
        'pdr' => $pdr['pdr'],
        'pdr_status' => $pdr['status'],
        'pdr_spread' => $pdr['spread'],
        'pdr_trials' => $pdr['trials'],
        'pdr_repeatable' => $pdr['repeatable'] ?? false,
        'schamroth_closed' => $bool($raw['schamroth_closed'] ?? false),
        'nail_pallor' => $bool($raw['nail_pallor'] ?? false),
        'hr' => bw_range($raw['hr'] ?? null, 30, 220),
        'hr_quality' => in_array($raw['hr_quality'] ?? '', ['good', 'fair'], true) ? $raw['hr_quality'] : null,
        'perfusion' => bw_range($raw['perfusion'] ?? null, 0, 20),
        'spo2' => bw_range($raw['spo2'] ?? null, 50, 100),
        'fet' => isset($raw['fet']) && $raw['fet'] !== null ? (float)$raw['fet'] : null,
    ];
}

function bw_json($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json');
    header('Cache-Control: no-store');
    echo json_encode($data);
}

function bw_http_get(string $url, int $timeout = 8): ?string
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_CONNECTTIMEOUT => 4,
        CURLOPT_USERAGENT => 'Lungitude/1.0 (hackathon prototype)',
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($body === false || $code >= 400) {
        return null;
    }
    return $body;
}

function bw_haversine_m(float $lat1, float $lon1, float $lat2, float $lon2): float
{
    $r = 6371000.0;
    $dLat = deg2rad($lat2 - $lat1);
    $dLon = deg2rad($lon2 - $lon1);
    $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon / 2) ** 2;
    return 2 * $r * asin(sqrt($a));
}

function bw_bearing(float $lat1, float $lon1, float $lat2, float $lon2): float
{
    $y = sin(deg2rad($lon2 - $lon1)) * cos(deg2rad($lat2));
    $x = cos(deg2rad($lat1)) * sin(deg2rad($lat2))
        - sin(deg2rad($lat1)) * cos(deg2rad($lat2)) * cos(deg2rad($lon2 - $lon1));
    return fmod(rad2deg(atan2($y, $x)) + 360, 360);
}
