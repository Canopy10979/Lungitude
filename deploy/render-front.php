<?php
$requested = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/');
if (preg_match('#^/(deploy|models)(/|$)#', $requested)) {
    http_response_code(404); exit('Not found');
}
if (str_ends_with($requested, '.php') && !preg_match('#^/api/[a-z_]+\\.php$#', $requested)) {
    http_response_code(404); exit('Not found');
}
$handled = require dirname(__DIR__) . '/router.php';
if ($handled === false) {
    $target = realpath(dirname(__DIR__) . $requested);
    if ($target && str_starts_with($target, dirname(__DIR__) . '/api/')) {
        $_SERVER['SCRIPT_FILENAME'] = $target;
        $_SERVER['SCRIPT_NAME'] = $requested;
        require $target;
    } else { http_response_code(404); }
}
