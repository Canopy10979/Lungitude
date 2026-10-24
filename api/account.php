<?php
header('Cache-Control: no-store');
header('Content-Type: application/json');
$action=$_GET['action']??'me';
$allowed=['me','register','login','profile','context','logout','delete'];
function account_error($message,$code){http_response_code($code);echo json_encode(['error'=>$message]);exit;}
if(!in_array($action,$allowed,true))account_error('Request not supported.',404);
if($action!=='me'&&$_SERVER['REQUEST_METHOD']!=='POST')account_error('Please submit the form.',405);
if(isset($_SERVER['HTTP_ORIGIN'])){$origin=parse_url($_SERVER['HTTP_ORIGIN']);$authority=($origin['host']??'').(isset($origin['port'])?':'.$origin['port']:'');if(strcasecmp($authority,$_SERVER['HTTP_HOST'])!==0)account_error('Please open this form from Lungitude.',403);}
if(!extension_loaded('curl'))account_error('Sign-in is temporarily unavailable. Please try again later.',503);
$ch=curl_init('http://127.0.0.1:8010/account/'.$action);
$opts=[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>2,CURLOPT_TIMEOUT=>15,CURLOPT_HEADERFUNCTION=>function($ch,$line){if(stripos($line,'Set-Cookie:')===0)header(trim($line),false);return strlen($line);}];
if(isset($_COOKIE['lungitude_session'])&&preg_match('/^[A-Za-z0-9_-]{30,100}$/',$_COOKIE['lungitude_session']))$opts[CURLOPT_COOKIE]='lungitude_session='.$_COOKIE['lungitude_session'];
if($action!=='me'){$fields=[];foreach(['email','password','profile','csrf'] as $name)if(isset($_POST[$name]))$fields[$name]=(string)$_POST[$name];$opts[CURLOPT_POST]=true;$opts[CURLOPT_POSTFIELDS]=http_build_query($fields);}
curl_setopt_array($ch,$opts);$body=curl_exec($ch);$code=curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);
if($body===false||!$code)account_error('This step is temporarily unavailable. Please try again shortly.',503);
$out=json_decode($body,true);
if(!is_array($out))account_error('We could not complete this step. Please try again.',502);
if($code>=400){$messages=[401=>'Please sign in again, or check your email and password.',403=>'Please sign in again to continue.',409=>'Unable to create this account. Try signing in.',422=>'Please review the required fields and try again.',429=>'Too many attempts. Please wait before trying again.'];account_error($messages[$code]??'This step is temporarily unavailable. Please try again later.',$code);}
echo json_encode($out);
