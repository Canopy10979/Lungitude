<?php
require __DIR__.'/lib.php';
header('Cache-Control: no-store');
$action = $_GET['action'] ?? 'status';
if (!in_array($action,['status','features','infer','infer_all','infer_live','compare','breast_status','breast_infer'],true)) {bw_json(['error'=>'Unsupported imaging action'],422);exit;}
$endpoint=['breast_status'=>'breast/status','breast_infer'=>'breast/infer'][$action]??$action;
$url='http://127.0.0.1:8010/'.$endpoint;
$method=in_array($action,['status','breast_status'],true)?'GET':'POST';
$fields=[];$uploads=[];
if ($method==='POST') {
 if ($_SERVER['REQUEST_METHOD']!=='POST') {bw_json(['error'=>'POST required'],405);exit;}
 foreach ($action==='breast_infer'?[]:($action==='compare'?['previous','current','mask_before','mask_after']:['image','mask']) as $name) {
  if ($name==='mask' && $action!=='features') continue;
  $f=$_FILES[$name]??null;
  if (!$f || $f['error']!==UPLOAD_ERR_OK || $f['size']>8000000 || !is_uploaded_file($f['tmp_name'])) {bw_json(['error'=>'Provide an image up to 8 MB'],422);exit;}
  $uploads[$name]=$f['tmp_name'];
 }
 foreach(['measurements','consent','research','architecture','date_before','date_after','scale_before','scale_after'] as $name) $fields[$name]=(string)($_POST[$name]??'');
}
$body=false;$code=0;
if(extension_loaded('curl')){
 $ch=curl_init($url);
 $opts=[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>2,CURLOPT_TIMEOUT=>90];
 if($method==='POST'){
  foreach($uploads as $name=>$path)$fields[$name]=new CURLFile($path,'application/octet-stream',$name.'.png');
  $opts[CURLOPT_POST]=true;$opts[CURLOPT_POSTFIELDS]=$fields;
 }
 curl_setopt_array($ch,$opts);$body=curl_exec($ch);$code=curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);
}else{
 // Stock PHP can forward images with HTTP streams; cURL/fileinfo are optional.
 $headers='';$payload='';
 if($method==='POST'){
  $boundary='lungitude-'.bin2hex(random_bytes(16));
  foreach($fields as $name=>$value)$payload.="--$boundary\r\nContent-Disposition: form-data; name=\"$name\"\r\n\r\n$value\r\n";
  foreach($uploads as $name=>$path){
   $bytes=@file_get_contents($path);
   if($bytes===false){bw_json(['error'=>'We could not read this image. Please take a new photo.'],422);exit;}
   $payload.="--$boundary\r\nContent-Disposition: form-data; name=\"$name\"; filename=\"$name.png\"\r\nContent-Type: application/octet-stream\r\n\r\n".$bytes."\r\n";
  }
  $payload.="--$boundary--\r\n";
  $headers="Content-Type: multipart/form-data; boundary=$boundary\r\n";
 }
 $context=stream_context_create(['http'=>['method'=>$method,'header'=>$headers,'content'=>$payload,'timeout'=>90,'ignore_errors'=>true,'follow_location'=>0]]);
 $body=@file_get_contents($url,false,$context);
 foreach($http_response_header??[] as $line)if(preg_match('#^HTTP/\S+ (\d{3})#',$line,$matches))$code=(int)$matches[1];
}
if($body===false || $code===0) {error_log('[Lungitude imaging] action='.$action.' transport_failed');bw_json(['error'=>'Analysis is temporarily unavailable. You can still capture and save images.'],503);exit;}
$out=json_decode($body,true);
if(!is_array($out)){bw_json(['error'=>'We could not complete the analysis. Please try again later.'],502);exit;}
if($code>=400){error_log('[Lungitude imaging] action='.$action.' upstream_status='.$code);$message=$code===413?'This image is too large. Please choose a smaller image.':($code===422?'We could not use this input. Please review it and try again.':'Analysis is temporarily unavailable. Please try again later.');bw_json(['error'=>$message],$code);exit;}
bw_json($out);
