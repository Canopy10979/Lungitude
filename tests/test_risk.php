<?php
/* Run: php tests/test_risk.php */
require __DIR__ . '/../api/lib.php';

$fail = 0;
function check(string $name, bool $ok): void
{
    global $fail;
    echo ($ok ? "PASS " : "FAIL ") . $name . "\n";
    if (!$ok) {
        $fail++;
    }
}

$base = bw_input([
    'age' => 62, 'height_in' => 69, 'weight_lb' => 182, 'education' => 4, 'race' => 'white',
    'smoking_status' => 'current', 'cigs_per_day' => 20, 'years_smoked' => 27, 'years_quit' => 0,
]);

/* Hand calculation for the reference person (BMI ~26.9, all other terms ~0):
   logit = -4.532506 + 0.2597431 - 1.822606*(0.5 - 0.4021541613) + 0.0308572*10 */
$bmi = bw_bmi(69, 182);
$expected = -4.532506 + 0.2597431 - 1.822606 * (0.5 - 0.4021541613) + 0.308572 - 0.0274194 * ($bmi - 27);
$expected = exp($expected) / (1 + exp($expected));
$base['current_smoker'] = true;
check('PLCO matches hand calculation', abs(bw_plco($base) - $expected) < 1e-9);

$a = bw_assess($base);
check('Reference smoker is above 1.51%', $a['risk'] > PLCO_THRESHOLD);
check('27 pack-years is USPSTF eligible', $a['uspstf']['eligible'] === true);
check('Quit-now what-if is lower than keep-smoking', $a['what_if']['quit_now_in_5y'] < $a['what_if']['keep_smoking_in_5y']);

$never = bw_assess(bw_input(['age' => 55, 'height_in' => 66, 'weight_lb' => 150, 'smoking_status' => 'never']));
check('Never smoker: model not applied', $never['risk'] === null && $never['tier'] === 'not_in_scope');

$old = bw_assess(bw_input(['age' => 79, 'height_in' => 66, 'weight_lb' => 150, 'smoking_status' => 'former',
    'cigs_per_day' => 20, 'years_smoked' => 40, 'years_quit' => 5]));
check('Age 79: USPSTF yes, Medicare no', $old['uspstf']['eligible'] && !$old['medicare']['eligible']);

$quitLong = bw_assess(bw_input(['age' => 65, 'height_in' => 66, 'weight_lb' => 150, 'smoking_status' => 'former',
    'cigs_per_day' => 20, 'years_smoked' => 30, 'years_quit' => 20]));
check('Quit 20 years ago: not USPSTF eligible', !$quitLong['uspstf']['eligible']);

$club = bw_assess(bw_input(['age' => 45, 'height_in' => 66, 'weight_lb' => 150, 'smoking_status' => 'never', 'pdr' => 1.08]));
check('PDR 1.08 is a red flag', $club['tier'] === 'see_doctor_now' && $club['hands']['clubbing_sign']);

$breath = bw_assess(bw_input(['age' => 63, 'height_in' => 69, 'weight_lb' => 172, 'smoking_status' => 'former',
    'cigs_per_day' => 20, 'years_smoked' => 38, 'years_quit' => 4, 'fet' => 7.4]));
check('Long FET gives COPD what-if', isset($breath['what_if']['if_copd_confirmed']));

$t = bw_pdr_from_trials([0.93, 0.95, 0.92]);
check('3 agreeing trials: median and repeatable', $t['status'] === 'ok' && abs($t['pdr'] - 0.93) < 1e-9 && $t['repeatable']);
$t = bw_pdr_from_trials([1.02, 1.09, 0.97]);
check('Spread 0.12: unsteady, not used', $t['status'] === 'unsteady');
$u = bw_assess(bw_input(['age' => 60, 'height_in' => 66, 'weight_lb' => 150, 'smoking_status' => 'never', 'pdr_trials' => [1.02, 1.09, 0.97]]));
check('Unsteady trials do not raise a clubbing flag', !$u['hands']['clubbing_sign']);
$t = bw_pdr_from_trials([2.5, 0.3]);
check('Impossible ratios: retake', $t['status'] === 'retake' && $t['rejected'] === 2);
$t = bw_pdr_from_trials([2.5, 0.98, 1.0, 0.99]);
check('One bad trial dropped, rest used', $t['status'] === 'ok' && $t['rejected'] === 1 && count($t['trials']) === 3);

printf("Demo person risk: %.2f%%\n", $breath['risk'] * 100);
exit($fail > 0 ? 1 : 0);
