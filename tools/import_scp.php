<?php
/*
 * Import NCI State Cancer Profiles county CSV exports (data/scp/*.csv)
 * into data/wa_county_rates.json. See data/scp/README.txt.
 *
 *     php tools/import_scp.php
 *
 * The export has title lines, a header row with "FIPS", data rows,
 * then footnotes. Rates can be "*" (too few cases to show) or have
 * notes like " #". We keep only clean numbers.
 */
const KEYS = ['lung', 'breast', 'colorectal', 'prostate', 'bladder', 'kidney',
    'melanoma', 'leukemia', 'nhl', 'pancreas', 'liver'];

function scp_number(string $v): ?float
{
    $v = trim(str_replace([',', '#', '¶', '§'], '', $v));
    if ($v === '' || !is_numeric($v)) {
        return null;
    }
    return (float)$v;
}

function scp_parse(string $file): array
{
    $lines = preg_split('/\r\n|\n|\r/', file_get_contents($file));
    $years = null;
    $header = null;
    $rows = [];
    foreach ($lines as $line) {
        if ($header === null) {
            if ($years === null && preg_match('/\b(19|20)\d{2}\s*-\s*(19|20)\d{2}\b/', $line, $m)) {
                $years = preg_replace('/\s+/', '', $m[0]);
            }
            $cells = str_getcsv($line);
            if (in_array('FIPS', array_map('trim', $cells), true)) {
                $header = array_map('trim', $cells);
            }
            continue;
        }
        if (trim($line) === '') {
            break;
        }
        $rows[] = str_getcsv($line);
    }
    if ($header === null) {
        throw new RuntimeException("No header row with FIPS in $file");
    }
    $iFips = array_search('FIPS', $header, true);
    $iRate = null;
    $iCount = null;
    foreach ($header as $i => $h) {
        if ($iRate === null && stripos($h, 'Incidence Rate') !== false) {
            $iRate = $i;
        }
        if ($iCount === null && stripos($h, 'Average Annual Count') !== false) {
            $iCount = $i;
        }
    }
    if ($iRate === null) {
        throw new RuntimeException("No incidence rate column in $file");
    }
    $out = ['years' => $years, 'rows' => []];
    foreach ($rows as $r) {
        if (!isset($r[$iFips])) {
            continue;
        }
        $fips = str_pad(trim($r[$iFips]), 5, '0', STR_PAD_LEFT);
        $name = trim(preg_replace('/\(\d+\)/', '', $r[0]));
        $out['rows'][$fips] = [
            'name' => $name,
            'rate' => scp_number($r[$iRate] ?? ''),
            'count' => $iCount === null ? null : scp_number($r[$iCount] ?? ''),
        ];
    }
    return $out;
}

$dir = $argv[1] ?? __DIR__ . '/../data/scp';
$outFile = $argv[2] ?? __DIR__ . '/../data/wa_county_rates.json';
$result = [
    'source' => 'NCI State Cancer Profiles, age-adjusted incidence per 100,000, county exports',
    'years' => [],
    'state' => [],
    'us' => [],
    'counties' => [],
];
$found = 0;
foreach (KEYS as $key) {
    $file = "$dir/$key.csv";
    if (!is_readable($file)) {
        echo "skip  $key.csv (not found)\n";
        continue;
    }
    $p = scp_parse($file);
    $result['years'][$key] = $p['years'];
    $n = 0;
    foreach ($p['rows'] as $fips => $row) {
        /* PHP turns numeric string keys like "53033" into integers. */
        $fips = str_pad((string)$fips, 5, '0', STR_PAD_LEFT);
        if ($fips === '53000') {
            $result['state'][$key] = $row;
            continue;
        }
        if ($fips === '00000') {
            $result['us'][$key] = $row;
            continue;
        }
        if (substr($fips, 0, 2) !== '53') {
            continue;
        }
        $result['counties'][$fips]['name'] = $row['name'];
        $result['counties'][$fips][$key] = ['rate' => $row['rate'], 'count' => $row['count']];
        $n++;
    }
    echo "ok    $key.csv: $n counties" . ($p['years'] ? " ({$p['years']})" : '') . "\n";
    $found++;
}
if ($found === 0) {
    fwrite(STDERR, "No files imported. See data/scp/README.txt.\n");
    exit(1);
}
file_put_contents($outFile, json_encode($result, JSON_PRETTY_PRINT));
echo "Saved $outFile\n";
