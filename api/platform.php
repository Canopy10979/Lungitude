<?php
// Same-origin localhost proxy. Provider credentials remain in Python's environment.
header('Content-Type: application/json');header('Cache-Control: no-store');
function platform_reply($data,$code=200){http_response_code($code);echo json_encode($data);exit;}
$action=$_GET['action']??'status';$read=in_array($action,['status','activity','leaderboard'],true);
if(!in_array($action,['status','activity','leaderboard','profile','chat'],true))platform_reply(['error'=>'Unknown action'],404);
if(!$read && $_SERVER['REQUEST_METHOD']!=='POST')platform_reply(['error'=>'POST required'],405);
if(isset($_SERVER['HTTP_ORIGIN'])){$origin=parse_url($_SERVER['HTTP_ORIGIN']);$authority=($origin['host']??'').(isset($origin['port'])?':'.$origin['port']:'');if(strcasecmp($authority,$_SERVER['HTTP_HOST'])!==0)platform_reply(['error'=>'Open this from Lungitude'],403);}
$payload='';if(!$read){if(stripos($_SERVER['CONTENT_TYPE']??'','application/json')!==0)platform_reply(['error'=>'JSON required'],415);$payload=file_get_contents('php://input',false,null,0,32001);if(strlen($payload)>32000)platform_reply(['error'=>'Message is too large'],413);}
$headers="Content-Type: application/json\r\n";
if(isset($_COOKIE['lungitude_session'])&&preg_match('/^[A-Za-z0-9_-]{30,100}$/',$_COOKIE['lungitude_session']))$headers.='Cookie: lungitude_session='.$_COOKIE['lungitude_session']."\r\n";
$url='http://127.0.0.1:8010/platform/'.$action;$method=$read?'GET':'POST';$code=0;$body=false;
if(extension_loaded('curl')){$c=curl_init($url);curl_setopt_array($c,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>2,CURLOPT_TIMEOUT=>55,CURLOPT_CUSTOMREQUEST=>$method,CURLOPT_HTTPHEADER=>array_filter(explode("\r\n",trim($headers)))]);if(!$read)curl_setopt($c,CURLOPT_POSTFIELDS,$payload);$body=curl_exec($c);$code=curl_getinfo($c,CURLINFO_HTTP_CODE);curl_close($c);}else{$ctx=stream_context_create(['http'=>['method'=>$method,'header'=>$headers,'content'=>$payload,'timeout'=>55,'ignore_errors'=>true,'follow_location'=>0]]);$body=@file_get_contents($url,false,$ctx);foreach($http_response_header??[] as $line)if(preg_match('#^HTTP/\S+ (\d{3})#',$line,$m))$code=(int)$m[1];}
if($body===false||!$code)platform_reply(['error'=>'Local backend is offline. Start Uvicorn on port 8010.'],503);
$data=json_decode($body,true);if(!is_array($data))platform_reply(['error'=>'Invalid backend response'],502);
if($code>=400)platform_reply(['error'=>is_string($data['detail']??null)?$data['detail']:'The request could not be completed'],$code);
platform_reply($data,$code);
