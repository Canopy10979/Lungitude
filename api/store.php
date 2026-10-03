<?php
/*
 * Small key-value cache and rate limiter in SQLite (data/cache.sqlite).
 * Used to avoid paying Google twice for the same search, and to stop
 * one visitor from running up the bill. Needs the pdo_sqlite extension.
 */
const BW_CACHE_FILE = __DIR__ . '/../data/cache.sqlite';

function bw_store(): ?PDO
{
    static $db = null;
    static $failed = false;
    if ($db !== null || $failed) {
        return $db;
    }
    try {
        $db = new PDO('sqlite:' . BW_CACHE_FILE);
        $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $db->exec('CREATE TABLE IF NOT EXISTS cache (k TEXT PRIMARY KEY, v TEXT NOT NULL, expires INTEGER NOT NULL)');
        $db->exec('CREATE TABLE IF NOT EXISTS hits (bucket TEXT PRIMARY KEY, n INTEGER NOT NULL, expires INTEGER NOT NULL)');
    } catch (Throwable $e) {
        error_log('Cache disabled: ' . $e->getMessage());
        $db = null;
        $failed = true;
    }
    return $db;
}

function bw_cache_get(string $key)
{
    $db = bw_store();
    if ($db === null) {
        return null;
    }
    $stmt = $db->prepare('SELECT v FROM cache WHERE k = ? AND expires > ?');
    $stmt->execute([$key, time()]);
    $v = $stmt->fetchColumn();
    if ($v === false) {
        return null;
    }
    return json_decode($v, true);
}

function bw_cache_set(string $key, $value, int $ttlSeconds): void
{
    $db = bw_store();
    if ($db === null) {
        return;
    }
    $stmt = $db->prepare('INSERT OR REPLACE INTO cache (k, v, expires) VALUES (?, ?, ?)');
    $stmt->execute([$key, json_encode($value), time() + $ttlSeconds]);
    if (random_int(1, 50) === 1) {
        $db->prepare('DELETE FROM cache WHERE expires <= ?')->execute([time()]);
        $db->prepare('DELETE FROM hits WHERE expires <= ?')->execute([time()]);
    }
}

/*
 * Returns true if this visitor may make one more paid call in this hour.
 * The IP address is hashed with a secret, so the database never holds it.
 */
function bw_rate_ok(string $what, int $maxPerHour): bool
{
    $db = bw_store();
    if ($db === null) {
        return true;
    }
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'cli';
    $salt = defined('GOOGLE_KEY') ? GOOGLE_KEY : 'lungitude';
    $hour = intdiv(time(), 3600);
    $bucket = $what . ':' . $hour . ':' . substr(hash('sha256', $salt . $ip), 0, 16);
    $db->prepare('INSERT OR IGNORE INTO hits (bucket, n, expires) VALUES (?, 0, ?)')
        ->execute([$bucket, ($hour + 2) * 3600]);
    $db->prepare('UPDATE hits SET n = n + 1 WHERE bucket = ?')->execute([$bucket]);
    $stmt = $db->prepare('SELECT n FROM hits WHERE bucket = ?');
    $stmt->execute([$bucket]);
    return (int)$stmt->fetchColumn() <= $maxPerHour;
}
