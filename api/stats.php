<?php
/*
 * GET: summary of the accuracy study, for study.html and the demo video.
 * Returns totals only. No single row is returned.
 */
require __DIR__ . '/lib.php';
require __DIR__ . '/db.php';

function bw_median(array $v): ?float
{
    if (count($v) === 0) {
        return null;
    }
    sort($v);
    $n = count($v);
    if ($n % 2 === 1) {
        return $v[intdiv($n, 2)];
    }
    return ($v[$n / 2 - 1] + $v[$n / 2]) / 2;
}

$rows = bw_db()->query('SELECT * FROM measurements')->fetchAll(PDO::FETCH_ASSOC);

$people = count($rows);
$repeatRows = 0;
$spreads = [];
$withinLimit = 0;
$unsteady = 0;
$medians = [];
$fets = [];
$aboveOne = 0;
$windowClosed = 0;
$ageBands = [];
$tiers = [];

foreach ($rows as $r) {
    $trials = json_decode($r['pdr_trials'], true) ?: [];
    if (count($trials) >= PDR_TRIALS_WANTED) {
        $repeatRows++;
        $spreads[] = (float)$r['pdr_spread'];
        if ((float)$r['pdr_spread'] <= PDR_SPREAD_MAX) {
            $withinLimit++;
        }
    }
    if ($r['pdr_status'] === 'unsteady') {
        $unsteady++;
    }
    if ($r['pdr_status'] === 'ok' && $r['pdr_median'] !== null) {
        $medians[] = (float)$r['pdr_median'];
        if ((float)$r['pdr_median'] > 1.0) {
            $aboveOne++;
        }
    }
    if ($r['fet'] !== null) {
        $fets[] = (float)$r['fet'];
    }
    if ((int)$r['schamroth_closed'] === 1) {
        $windowClosed++;
    }
    $ageBands[$r['age_band']] = ($ageBands[$r['age_band']] ?? 0) + 1;
    $tiers[$r['tier']] = ($tiers[$r['tier']] ?? 0) + 1;
}

/* Histogram of PDR medians in 0.05 bins from 0.70 to 1.25. */
$bins = [];
for ($lo = 0.70; $lo < 1.249; $lo += 0.05) {
    $bins[] = ['from' => round($lo, 2), 'to' => round($lo + 0.05, 2), 'count' => 0];
}
foreach ($medians as $m) {
    $i = (int)floor(($m - 0.70) / 0.05);
    $i = max(0, min(count($bins) - 1, $i));
    $bins[$i]['count']++;
}
ksort($ageBands);

bw_json([
    'people' => $people,
    'repeatability' => [
        'people_with_3_trials' => $repeatRows,
        'median_spread' => bw_median($spreads),
        'within_limit' => $withinLimit,
        'limit' => PDR_SPREAD_MAX,
        'unsteady' => $unsteady,
    ],
    'pdr' => [
        'measured' => count($medians),
        'median' => bw_median($medians),
        'above_1' => $aboveOne,
        'histogram' => $bins,
    ],
    'fet_median' => bw_median($fets),
    'window_closed' => $windowClosed,
    'age_bands' => $ageBands,
    'tiers' => $tiers,
]);
