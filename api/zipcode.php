<?php
require __DIR__.'/lib.php';require __DIR__.'/config.php';require __DIR__.'/store.php';
$zip=(string)($_GET['zip']??'');
if(!preg_match('/^\d{5}$/',$zip)){bw_json(['error'=>'Enter a five-digit US ZIP code'],422);exit;}
if(GOOGLE_KEY===''||!extension_loaded('curl')){bw_json(['error'=>'ZIP lookup unavailable. Choose your county or use location.'],503);exit;}
if(!bw_rate_ok('zipcode',30)){bw_json(['error'=>'Too many ZIP lookups. Try later.'],429);exit;}
$ch=curl_init('https://maps.googleapis.com/maps/api/geocode/json?'.http_build_query(['components'=>'postal_code:'.$zip.'|country:US','key'=>GOOGLE_KEY]));
curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>10,CURLOPT_CONNECTTIMEOUT=>3]);$body=curl_exec($ch);curl_close($ch);
$r=json_decode((string)$body,true);
if(($r['status']??'')!=='OK'){bw_json(['error'=>'ZIP lookup failed. Enable Geocoding API for this key, or use county/location.'],503);exit;}
$g=$r['results'][0];bw_json(['lat'=>$g['geometry']['location']['lat'],'lon'=>$g['geometry']['location']['lng'],'label'=>$g['formatted_address'],'approximate'=>true]);
