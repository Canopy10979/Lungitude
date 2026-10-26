<?php
require __DIR__.'/lib.php';
require __DIR__.'/config.php';
require __DIR__.'/store.php';
require __DIR__.'/places_client.php';
header('Cache-Control: no-store');
$lat=filter_var($_GET['lat'] ?? null,FILTER_VALIDATE_FLOAT);
$lon=filter_var($_GET['lon'] ?? null,FILTER_VALIDATE_FLOAT);
if ($lat===false || $lat===null || $lon===false || $lon===null || !is_finite($lat) || !is_finite($lon) || abs($lat)>90 || abs($lon)>180) {
    bw_json(['error'=>'Choose a location to find nearby care.','places'=>[]],400);exit;
}
if (trim(GOOGLE_KEY)==='') {
    bw_json(['error'=>'Google Maps places search is not connected yet.','code'=>'places_not_configured','source'=>'google','places'=>[]],503);exit;
}
if (!bw_rate_ok('google',30)) {
    bw_json(['error'=>'Please wait before searching again.','source'=>'google','places'=>[]],429);exit;
}
$type=(string)($_GET['type'] ?? 'primary');
$places=bw_google_places((float)$lat,(float)$lon,bw_place_query($type));
if ($places===null) {
    bw_json(['error'=>'Google Maps could not complete this search. Please try again.','code'=>$GLOBALS['bw_places_failure']['code'] ?? 'places_search_failed','diagnostic'=>$GLOBALS['bw_places_failure'] ?? null,'source'=>'google','places'=>[]],502);exit;
}
bw_json(['sample'=>false,'source'=>'google','origin'=>['lat'=>$lat,'lon'=>$lon],
    'radius_miles'=>10,'radius_meters'=>SEARCH_RADIUS_METERS,'distance_basis'=>'straight_line',
    'walk_limit_min'=>20,'type'=>'healthcare','places'=>$places]);
