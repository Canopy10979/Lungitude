<?php
/*
 * Study database: SQLite file, no server, no packages.
 * Stores numbers only. No name, no photo, no audio, no location,
 * no IP address, and the date only (no time of day).
 */
const BW_DB_FILE = __DIR__ . '/../data/study.sqlite';

function bw_db(): PDO
{
    $db = new PDO('sqlite:' . BW_DB_FILE);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->exec('CREATE TABLE IF NOT EXISTS measurements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        day TEXT NOT NULL,
        age_band TEXT NOT NULL,
        smoking_status TEXT NOT NULL,
        pdr_trials TEXT NOT NULL,
        pdr_median REAL,
        pdr_spread REAL,
        pdr_status TEXT NOT NULL,
        fet REAL,
        schamroth_closed INTEGER NOT NULL,
        hr REAL,
        spo2 REAL,
        tier TEXT NOT NULL,
        app_version TEXT NOT NULL
    )');
    return $db;
}

function bw_age_band(int $age): string
{
    if ($age < 50) {
        return 'under 50';
    }
    if ($age >= 80) {
        return '80+';
    }
    $lo = intdiv($age, 10) * 10;
    return $lo . '-' . ($lo + 9);
}
