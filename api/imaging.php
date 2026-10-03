<?php
require __DIR__.'/lib.php';
$action = $_GET['action'] ?? 'status';
if (!in_array($action,['status','features','infer','compare'],true)) {bw_json(['error'=>'Unsupported imaging action'],422);exit;}
if (!extension_loaded('curl')) {bw_json(['error'=>'Imaging connection unavailable'],503);exit;}
$ch=curl_init('http://127.0.0.1:8010/'.$action);
$opts=[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>2,CURLOPT_TIMEOUT=>30];
if ($action!=='status') {
 if ($_SERVER['REQUEST_METHOD']!=='POST') {bw_json(['error'=>'POST required'],405);exit;}
 $fields=[];
 foreach ($action==='compare'?['previous','current','mask_before','mask_after']:['image','mask'] as $name) {
  if ($name==='mask' && $action!=='features') continue;
  $f=$_FILES[$name]??null;
  if (!$f || $f['error']!==UPLOAD_ERR_OK || $f['size']>8000000) {bw_json(['error'=>'Provide an image up to 8 MB'],422);exit;}
  $fields[$name]=new CURLFile($f['tmp_name'],mime_content_type($f['tmp_name']),$name.'.png');
 }
 foreach(['consent','research','architecture','date_before','date_after','scale_before','scale_after'] as $name) $fields[$name]=(string)($_POST[$name]??'');
 $opts[CURLOPT_POST]=true;$opts[CURLOPT_POSTFIELDS]=$fields;
}
curl_setopt_array($ch,$opts);$body=curl_exec($ch);$code=curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);
if($body===false || $code===0) {bw_json(['error'=>'Imaging service is offline. Survey and care search remain available.'],503);exit;}
$out=json_decode($body,true);
if(!is_array($out)){bw_json(['error'=>'Invalid imaging service response'],502);exit;}
if($code>=400){bw_json(['error'=>$out['detail']??'Image analysis failed'],$code);exit;}
bw_json($out);
