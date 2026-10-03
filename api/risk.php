<?php
require __DIR__ . '/lib.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    bw_json(['error' => 'POST only'], 405);
    exit;
}

$raw = json_decode(file_get_contents('php://input'), true);
if (!is_array($raw)) {
    bw_json(['error' => 'Body must be JSON'], 400);
    exit;
}

$p = bw_input($raw);
if ($p['age'] < 18 || $p['age'] > 100) {
    bw_json(['error' => 'Age must be between 18 and 100'], 422);
    exit;
}
if ($p['height_in'] < 48 || $p['weight_lb'] < 60) {
    bw_json(['error' => 'Check height and weight'], 422);
    exit;
}

bw_json(bw_assess($p));
