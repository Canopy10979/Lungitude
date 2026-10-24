<?php
header('Cache-Control: no-store');
header('Content-Type: application/json');
$action=$_GET['action']??'me';
$allowed=['me','health','oauth_config','oauth','register','login','profile','context','logout','delete'];
function account_error($message,$code){http_response_code($code);echo json_encode(['error'=>$message]);exit;}
if(!in_array($action,$allowed,true))account_error('Request not supported.',404);
if(!in_array($action,['me','health','oauth_config'],true)&&$_SERVER['REQUEST_METHOD']!=='POST')account_error('Please submit the form.',405);
if(isset($_SERVER['HTTP_ORIGIN'])){$origin=parse_url($_SERVER['HTTP_ORIGIN']);$authority=($origin['host']??'').(isset($origin['port'])?':'.$origin['port']:'');if(strcasecmp($authority,$_SERVER['HTTP_HOST'])!==0)account_error('Please open this form from Lungitude.',403);}
$endpoint=['oauth_config'=>'oauth/config'][$action]??$action;
$url='http://127.0.0.1:8010/account/'.$endpoint;
$method=in_array($action,['me','health','oauth_config'],true)?'GET':'POST';
$fields=[];
foreach(['email','password','profile','csrf','provider','credential','state'] as $name)if(isset($_POST[$name]))$fields[$name]=(string)$_POST[$name];
$payload=http_build_query($fields);
$cookies=[];
foreach(['lungitude_session','lungitude_oauth'] as $cookie)if(isset($_COOKIE[$cookie])&&preg_match('/^[A-Za-z0-9_-]{30,100}$/',$_COOKIE[$cookie]))$cookies[]=$cookie.'='.$_COOKIE[$cookie];
$cookieHeader=implode('; ',$cookies);
$body=false;$code=0;
if(extension_loaded('curl')){
 $ch=curl_init($url);$opts=[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>2,CURLOPT_TIMEOUT=>15,CURLOPT_HEADERFUNCTION=>function($ch,$line){if(stripos($line,'Set-Cookie:')===0)header(trim($line),false);return strlen($line);}];
 if($cookieHeader)$opts[CURLOPT_COOKIE]=$cookieHeader;
 if($method==='POST'){$opts[CURLOPT_POST]=true;$opts[CURLOPT_POSTFIELDS]=$payload;}
 curl_setopt_array($ch,$opts);$body=curl_exec($ch);$code=curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);
}else{
 // Stock Windows PHP may not have curl enabled. Use its built-in HTTP stream.
 $headers="Content-Type: application/x-www-form-urlencoded\r\n";
 if($cookieHeader)$headers.="Cookie: ".$cookieHeader."\r\n";
 $context=stream_context_create(['http'=>['method'=>$method,'header'=>$headers,'content'=>$method==='POST'?$payload:'','timeout'=>15,'ignore_errors'=>true,'follow_location'=>0]]);
 $body=@file_get_contents($url,false,$context);
 foreach($http_response_header??[] as $line){if(preg_match('#^HTTP/\S+ (\d{3})#',$line,$matches))$code=(int)$matches[1];if(stripos($line,'Set-Cookie:')===0)header(trim($line),false);}
}
if($body===false||!$code){error_log('[Lungitude account] action='.$action.' transport_failed');account_error('This step is temporarily unavailable. Please try again shortly.',503);}
$out=json_decode($body,true);
if(!is_array($out))account_error('We could not complete this step. Please try again.',502);
if($code>=400){$messages=[401=>($action==='login'?'That email and password do not match. New to Lungitude? Choose Create account.':($action==='oauth'?'We could not verify this sign-in. Please try again.':'Your session ended. Please sign in to continue.')),403=>'Please sign in again to continue.',409=>'Unable to create this account. Try signing in.',422=>'Please review the required fields and try again.',429=>'Too many attempts. Please wait before trying again.'];account_error($messages[$code]??'This step is temporarily unavailable. Please try again later.',$code);}
echo json_encode($out);
