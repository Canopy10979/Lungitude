<?php
/* Google Places API (New), queried only by location and care search phrase. */
const SEARCH_RADIUS_METERS = 16093.44;
function bw_normalize_google_places(array $items, float $lat, float $lon): array {
    $places = []; $seen = [];
    foreach ($items as $g) {
        $plat = $g['location']['latitude'] ?? null;
        $plon = $g['location']['longitude'] ?? null;
        if (!is_numeric($plat) || !is_numeric($plon) || !is_finite((float)$plat) || !is_finite((float)$plon) || abs((float)$plat)>90 || abs((float)$plon)>180) continue;
        $meters = bw_haversine_m($lat, $lon, (float)$plat, (float)$plon);
        if ($meters > SEARCH_RADIUS_METERS) continue;
        $name = $g['displayName']['text'] ?? 'Healthcare listing';
        $address = $g['formattedAddress'] ?? '';
        $identity = $g['id'] ?? strtolower($name.'|'.$address);
        if (isset($seen[$identity])) continue;
        $seen[$identity] = true;
        $places[] = ['name'=>$name, 'kind'=>'healthcare', 'lat'=>(float)$plat, 'lon'=>(float)$plon,
            'address'=>$address, 'phone'=>$g['nationalPhoneNumber'] ?? null, 'website'=>$g['websiteUri'] ?? null,
            'meters'=>round($meters), 'miles'=>round($meters/1609.344,2),
            'bearing'=>round(bw_bearing($lat,$lon,(float)$plat,(float)$plon)),
            'walk_min'=>(int)round($meters*1.25/80), 'walk_source'=>'estimate',
            'drive_min'=>max(2,(int)round($meters*1.4/500)), 'maps_url'=>$g['googleMapsUri'] ?? null,
            'attributions'=>$g['attributions'] ?? []];
    }
    usort($places, fn($a,$b)=>$a['meters']<=>$b['meters']);
    return array_slice($places,0,5);
}
function bw_place_query(string $type): string {
    if ($type==='primary') return 'primary care clinic';
    if ($type==='lung') return 'lung cancer screening low-dose CT';
    $data=json_decode(file_get_contents(__DIR__.'/../data/wa_cancers.json'),true);
    return $data['groups'][$type]['place_query'] ?? 'primary care clinic';
}
function bw_google_places(float $lat,float $lon,string $query): ?array {
    $payload=json_encode(['textQuery'=>$query,'pageSize'=>20,'rankPreference'=>'DISTANCE',
        'locationBias'=>['circle'=>['center'=>['latitude'=>$lat,'longitude'=>$lon],'radius'=>SEARCH_RADIUS_METERS]]]);
    $headers=['Content-Type: application/json','X-Goog-Api-Key: '.GOOGLE_KEY,
        'X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.attributions'];
    $url='https://places.googleapis.com/v1/places:searchText'; $code=0;
    if (extension_loaded('curl')) {
        $ch=curl_init($url);
        $options=[CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>15,CURLOPT_CONNECTTIMEOUT=>4,CURLOPT_HTTPHEADER=>$headers,CURLOPT_POSTFIELDS=>$payload];
        // Windows PHP/OpenSSL does not have a CA bundle configured by default.
        // Use the operating system's trusted roots; retain peer/hostname verification.
        if (PHP_OS_FAMILY==='Windows' && defined('CURLSSLOPT_NATIVE_CA')) $options[CURLOPT_SSL_OPTIONS]=CURLSSLOPT_NATIVE_CA;
        curl_setopt_array($ch,$options);
        $body=curl_exec($ch);$code=curl_getinfo($ch,CURLINFO_HTTP_CODE);$GLOBALS['bw_places_transport_error']=curl_errno($ch);curl_close($ch);
    } else {
        $context=stream_context_create(['http'=>['method'=>'POST','header'=>implode("\r\n",$headers),'content'=>$payload,'timeout'=>15,'ignore_errors'=>true,'follow_location'=>0]]);
        $body=@file_get_contents($url,false,$context);
        foreach ($http_response_header ?? [] as $line) if(preg_match('#^HTTP/\S+ (\d{3})#',$line,$match)) $code=(int)$match[1];
    }
    if ($body===false || $code<200 || $code>=300) {
        $error=json_decode((string)$body,true)['error'] ?? [];
        $message=strtolower((string)($error['message'] ?? ''));
        $reason='places_search_failed';
        if (($GLOBALS['bw_places_transport_error'] ?? 0)===60) $reason='places_tls_error';
        elseif (str_contains($message,'billing')) $reason='places_billing_required';
        elseif (str_contains($message,'not been used') || str_contains($message,'disabled')) $reason='places_api_disabled';
        elseif (str_contains($message,'api key not valid') || str_contains($message,'invalid api key')) $reason='places_key_invalid';
        elseif (str_contains($message,'referer') || str_contains($message,'referrer')) $reason='places_key_referrer_restricted';
        elseif (str_contains($message,'ip address')) $reason='places_key_ip_restricted';
        elseif ($code===403) $reason='places_access_denied';
        $GLOBALS['bw_places_failure']=['code'=>$reason,'upstream_status'=>$code,'transport_code'=>$GLOBALS['bw_places_transport_error'] ?? 0,'provider_reasons'=>array_values(array_filter(array_column($error['details'] ?? [],'reason')))];
        error_log('[Lungitude Places] upstream_status='.$code.' reason='.$reason);return null;
    }
    $data=json_decode($body,true);
    if (!is_array($data) || isset($data['error']) || (isset($data['places'])&&!is_array($data['places']))) return null;
    return bw_normalize_google_places($data['places'] ?? [],$lat,$lon);
}
