<?php
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
    . "style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; "
    . "frame-ancestors 'none'; base-uri 'self'"
);

return false;
