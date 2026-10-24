<?php
require __DIR__.'/lib.php';
$action = $_GET['action'] ?? 'status';
if (!in_array($action,['status','features','infer','infer_all','infer_live','compare','breast_status','breast_infer'],true)) {bw_json(['error'=>'Unsupported imaging action'],422);exit;}
if (!extension_loaded('curl')) {bw_json(['error'=>'Analysis is temporarily unavailable. Please try again later.'],503);exit;}
$endpoint=['breast_status'=>'breast/status','breast_infer'=>'breast/infer'][$action]??$action;
$ch=curl_init('http://127.0.0.1:8010/'.$endpoint);
$opts=[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>2,CURLOPT_TIMEOUT=>90];
if (!in_array($action,['status','breast_status'],true)) {
 if ($_SERVER['REQUEST_METHOD']!=='POST') {bw_json(['error'=>'POST required'],405);exit;}
 $fields=[];
 foreach ($action==='breast_infer'?[]:($action==='compare'?['previous','current','mask_before','mask_after']:['image','mask']) as $name) {
  if ($name==='mask' && $action!=='features') continue;
  $f=$_FILES[$name]??null;
  if (!$f || $f['error']!==UPLOAD_ERR_OK || $f['size']>8000000) {bw_json(['error'=>'Provide an image up to 8 MB'],422);exit;}
  $fields[$name]=new CURLFile($f['tmp_name'],mime_content_type($f['tmp_name']),$name.'.png');
 }
 foreach(['measurements','consent','research','architecture','date_before','date_after','scale_before','scale_after'] as $name) $fields[$name]=(string)($_POST[$name]??'');
 $opts[CURLOPT_POST]=true;$opts[CURLOPT_POSTFIELDS]=$fields;
}
curl_setopt_array($ch,$opts);$body=curl_exec($ch);$code=curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);
if($body===false || $code===0) {bw_json(['error'=>'Analysis is temporarily unavailable. You can still capture and save images.'],503);exit;}
$out=json_decode($body,true);
if(!is_array($out)){bw_json(['error'=>'We could not complete the analysis. Please try again later.'],502);exit;}
if($code>=400){error_log('[Lungitude imaging] action='.$action.' upstream_status='.$code);$message=$code===413?'This image is too large. Please choose a smaller image.':($code===422?'We could not use this input. Please review it and try again.':'Analysis is temporarily unavailable. Please try again later.');bw_json(['error'=>$message],$code);exit;}
bw_json($out);
