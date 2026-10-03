<?php
$path=rawurldecode(parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH));
if(preg_match('#^/(ml|tests|tools|\.git)(/|$)#',$path)||preg_match('#/(secrets(?:\.example)?|config|db|store|lib|geo)\.php$#',$path)||preg_match('/\.(sqlite|db|pt|py|csv|zip|env)$/i',$path)||str_contains($path,'..')){http_response_code(404);echo 'Not found';return true;}
return false;
