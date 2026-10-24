<?php

/* Lungitude router: PHP endpoint or shared server helper. */
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));

$blocked = [
    '#^/(ml|tests|tools|\.git)(/|$)#',
    '#^/data/scp(/|$)#',
    '#^/api/(secrets|config|lib|geo|store|db)(\.example)?\.php$#',
    '#/\.#',
    '#\.(sqlite|db|pt|pth|onnx|zip|env|csv|tcia|h5|py|md)$#i',
];

foreach ($blocked as $pattern) {
    if (preg_match($pattern, $path) || str_contains($path, '..')) {
        http_response_code(404);
        header('Content-Type: text/plain; charset=utf-8');
        echo "Not found\n";
        return true;
    }
}

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('X-Frame-Options: DENY');
header('Permissions-Policy: camera=(self), microphone=(self), geolocation=(self)');
header(
    "Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; "
    . "style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; "
    . "frame-ancestors 'none'; base-uri 'self'"
);

/* Serve public static assets here so PHP's static handler cannot drop security headers. */
$relativePath = $path === '/' ? '/index.html' : $path;
$filename = realpath(__DIR__ . $relativePath);
if ($filename !== false && str_starts_with($filename, __DIR__ . DIRECTORY_SEPARATOR) && is_file($filename)) {
    $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    if ($extension === 'php') {
        return false;
    }
    $types = [
        'html' => 'text/html; charset=utf-8',
        'js' => 'text/javascript; charset=utf-8',
        'css' => 'text/css; charset=utf-8',
        'json' => 'application/json',
        'webmanifest' => 'application/manifest+json',
        'svg' => 'image/svg+xml',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
    ];
    if (isset($types[$extension])) {
        header('Content-Type: ' . $types[$extension]);
        if ($extension === 'html') {
            header('Cache-Control: no-cache');
        }
        readfile($filename);
        return true;
    }
}
http_response_code(404);
header('Content-Type: text/plain; charset=utf-8');
echo "Not found\n";
return true;
