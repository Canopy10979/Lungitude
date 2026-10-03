<?php
/*
 * POST: add one person's numbers to the accuracy study.
 * The browser sends this only after the person ticks the consent box.
 */
require __DIR__ . '/lib.php';
require __DIR__ . '/db.php';

const APP_VERSION = '1.1';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    bw_json(['error' => 'POST only'], 405);
    exit;
}

$body = file_get_contents('php://input');
if (strlen($body) > 4096) {
    bw_json(['error' => 'Too large'], 413);
    exit;
}

$raw = json_decode($body, true);
if (!is_array($raw) || ($raw['consent'] ?? false) !== true) {
    bw_json(['error' => 'Consent is required'], 400);
    exit;
}

$p = bw_input($raw);
if ($p['age'] < 18 || $p['age'] > 100) {
    bw_json(['error' => 'Age must be between 18 and 100'], 422);
    exit;
}
if ($p['pdr_status'] === 'none' && $p['fet'] === null && $p['hr'] === null && $p['spo2'] === null) {
    bw_json(['error' => 'There are no measurements to save'], 422);
    exit;
}

$a = bw_assess($p);

try {
    $db = bw_db();
    $stmt = $db->prepare('INSERT INTO measurements
        (day, age_band, smoking_status, pdr_trials, pdr_median, pdr_spread, pdr_status,
         fet, schamroth_closed, hr, spo2, tier, app_version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([
        gmdate('Y-m-d'),
        bw_age_band($p['age']),
        $p['smoking_status'],
        json_encode($p['pdr_trials']),
        $p['pdr'],
        $p['pdr_spread'],
        $p['pdr_status'],
        $p['fet'],
        $p['schamroth_closed'] ? 1 : 0,
        $a['vitals']['hr'],
        $p['spo2'],
        $a['tier'],
        APP_VERSION,
    ]);
    bw_json(['saved' => true, 'id' => (int)$db->lastInsertId()]);
} catch (PDOException $e) {
    error_log('Study log failed: ' . $e->getMessage());
    bw_json(['error' => 'Could not save. Check that the data folder is writable.'], 500);
}
