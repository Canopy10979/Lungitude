<?php
/* Run: php tests/test_survey.php */
require __DIR__ . '/../api/survey.php';

$data = json_decode(file_get_contents(__DIR__ . '/../data/wa_cancers.json'), true);
$fail = 0;
function check(string $name, bool $ok): void
{
    global $fail;
    echo ($ok ? "PASS " : "FAIL ") . $name . "\n";
    if (!$ok) {
        $fail++;
    }
}

$none = bw_survey(['age' => 30, 'bmi' => 22, 'answers' => []], $data);
check('No yes answers: no match', count($none['matched']) === 0 && $none['result'] === 'No warning signs reported');
check('Age 30: cervical only', array_column($none['screenings_due'], 'key') === ['cervical']);
check('Age 30: free program shown', $none['free_screening'] !== null);

$col = bw_survey(['age' => 52, 'bmi' => 31.4, 'answers' => ['colorectal' => true]], $data);
check('Colorectal yes: matched and place type', $col['matched'][0]['key'] === 'colorectal' && $col['place_key'] === 'colorectal');
check('BMI 31.4 links to colorectal', $col['matched'][0]['bmi_linked'] === true && $col['bmi']['category'] === 'obesity');
check('WA colorectal 2026 cases = 3,300', $col['matched'][0]['cancers'][0]['new_2026'] === 3300);
check('Age 52 screenings: colorectal, breast, cervical, lung', array_column($col['screenings_due'], 'key') === ['colorectal', 'breast', 'cervical', 'lung']);

$skin = bw_survey(['age' => 40, 'bmi' => 31, 'answers' => ['skin' => true]], $data);
check('Melanoma is not BMI-linked', $skin['matched'][0]['bmi_linked'] === false);

$many = bw_survey(['age' => 70, 'bmi' => 24, 'answers' => ['lung' => true, 'blood' => true, 'skin' => true]], $data);
check('3 areas: primary care first', $many['many'] && $many['place_key'] === 'primary');
check('Order follows the survey', array_column($many['matched'], 'key') === ['lung', 'skin', 'blood']);
check('Age 70: no free program (21-64)', $many['free_screening'] === null);

$hw = bw_survey(['age' => 45, 'height_in' => 69, 'weight_lb' => 200, 'answers' => []], $data);
check('BMI from height and weight', abs($hw['bmi']['bmi'] - 29.5) < 0.1);

$bad = bw_survey(['age' => 45, 'bmi' => 400, 'answers' => ['lung' => 'yes']], $data);
check('Bad BMI ignored, string "yes" is not true', $bad['bmi'] === null && count($bad['matched']) === 0);

/* County data */
$tmp = sys_get_temp_dir() . '/lungitude_rates_test.json';
exec(PHP_BINARY . ' ' . escapeshellarg(__DIR__ . '/../tools/import_scp.php') . ' '
    . escapeshellarg(__DIR__ . '/fixtures/scp') . ' ' . escapeshellarg($tmp), $out, $code);
check('Importer runs on the fixture', $code === 0 && is_readable($tmp));
$imp = json_decode(file_get_contents($tmp), true);
check('Importer: King County rate 30.9 (note "#" removed)', $imp['counties']['53033']['colorectal']['rate'] === 30.9);
check('Importer: "*" becomes null', $imp['counties']['53023']['colorectal']['rate'] === null);
check('Importer: state row kept apart', $imp['state']['colorectal']['rate'] === 34.1 && !isset($imp['counties']['53000']));

$withCounty = bw_survey_county($col, ['fips' => '53033', 'county' => 'King County'], ['obesity' => 25.1],
    $imp['counties']['53033'], $imp['years']);
$cr = $withCounty['matched'][0]['cancers'][0]['county_rate'];
check('Survey: county rate attached to colorectal', $cr['rate'] === 30.9 && $cr['years'] === '2017-2021');
check('Survey: county is in WA', $withCounty['county']['in_wa'] === true);
$noCounty = bw_survey_county($col, null, null, null, []);
check('Survey: no location, no county', $noCounty['county'] === null);
@unlink($tmp);

exit($fail > 0 ? 1 : 0);
