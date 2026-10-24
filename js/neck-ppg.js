/* On-device, user-selected neck ROI. No uploads, stored video or disease inference. */
(()=>{'use strict';const $=id=>document.getElementById(id);if(!$('neck-enable'))return;
const video=$('neck-preview'),overlay=$('neck-roi'),ctx=overlay.getContext('2d'),sample=document.createElement('canvas');sample.width=sample.height=64;const sc=sample.getContext('2d',{willReadFrequently:true});
let stream=null,token=0,raf=null,roi=null,drag=null,recording=false,start=0,rows=[],attempted=0,bad=0,lastFrame=-Infinity,lastPlot=-Infinity,stable=0,previous=null,continuous=false,frameChecks=[],lastEstimate=-Infinity;
function text(id,value){if($(id).textContent!==value)$(id).textContent=value;}
const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
function controls(){$('neck-continuous').disabled=recording;$('neck-reset-roi').disabled=recording;$('neck-record').textContent=$('neck-continuous').checked?'Start live neck monitoring':'Measure for 60 seconds';$('neck-facing').disabled=!!stream;$('neck-enable').disabled=!!stream;$('neck-stop').disabled=!stream;$('neck-record').disabled=!stream||!roi||stable<20||!$('neck-skin-confirm').checked||recording;}
function closeCamera(){token++;if(raf!==null)cancelAnimationFrame(raf);raf=null;if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;video.pause();video.srcObject=null;$('neck-camera-placeholder').hidden=false;recording=false;stable=0;previous=null;$('neck-signal-glow').setAttribute('opacity','0');text('neck-signal-state','Camera stopped · illustration inactive');controls();}
function clearResult(){$('neck-summary').hidden=true;$('neck-bpm').textContent='—';$('neck-cycles').textContent='—';$('neck-progress').value=0;$('neck-live-bpm').textContent='—';draw(null);}
function stop(message='Stopped · no result produced',keep=false){const retained=keep&&!$('neck-summary').hidden;closeCamera();rows=[];frameChecks=[];if(!retained)clearResult();text('neck-status',retained?'Stopped · last estimate frozen; no ongoing monitoring':message);}
function outline(){ctx.clearRect(0,0,overlay.width,overlay.height);const r=drag?{x:Math.min(drag.x,drag.endX),y:Math.min(drag.y,drag.endY),w:Math.abs(drag.x-drag.endX),h:Math.abs(drag.y-drag.endY)}:roi;if(!r)return;ctx.strokeStyle='#83efcd';ctx.lineWidth=3;ctx.strokeRect(r.x,r.y,r.w,r.h);}
function point(e){const b=overlay.getBoundingClientRect();return {x:Math.max(0,Math.min(overlay.width,(e.clientX-b.left)*overlay.width/b.width)),y:Math.max(0,Math.min(overlay.height,(e.clientY-b.top)*overlay.height/b.height))};}
overlay.onpointerdown=e=>{if(!stream||recording)return;e.preventDefault();const p=point(e);drag={...p,endX:p.x,endY:p.y};overlay.setPointerCapture?.(e.pointerId);};
overlay.onpointermove=e=>{if(!drag)return;const p=point(e);drag.endX=p.x;drag.endY=p.y;outline();};
overlay.onpointerup=e=>{if(!drag)return;const p=point(e);roi={x:Math.min(drag.x,p.x),y:Math.min(drag.y,p.y),w:Math.abs(drag.x-p.x),h:Math.abs(drag.y-p.y)};drag=null;if(roi.w<30||roi.h<30){roi=null;text('neck-status','Select a larger visible patch of neck skin.');}else text('neck-status','Region selected. Confirm it contains neck skin; hold still for the lighting check.');stable=0;previous=null;outline();controls();if(roi)focusRegion();};
overlay.onpointercancel=()=>{drag=null;outline();};
$('neck-reset-roi').onclick=()=>{if(recording)return;roi=null;drag=null;stable=0;previous=null;outline();controls();};
async function focusRegion(){
 const attempt=token,track=stream?.getVideoTracks?.()[0];
 const caps=track?.getCapabilities?.()||{};
 if(!track?.applyConstraints||!caps.focusMode?.includes('continuous')){text('neck-focus','Browser-controlled focus. Automatic focus controls are unavailable; keep the selected skin region sharp. No artery is detected.');return;}
 const settings={focusMode:'continuous'};
 const supports=navigator.mediaDevices.getSupportedConstraints?.()||{};
 if(roi&&supports.pointsOfInterest)settings.pointsOfInterest=[{x:(roi.x+roi.w/2)/overlay.width,y:(roi.y+roi.h/2)/overlay.height}];
 try{await track.applyConstraints({advanced:[settings]});if(attempt!==token)return;const actual=track.getSettings?.()||{};text('neck-focus',actual.focusMode==='continuous'?'Camera reports continuous autofocus for the visible scene; this does not locate an artery.':'Continuous autofocus requested; the camera/browser determines its effect. No artery is detected.');}
 catch(e){if(attempt===token)text('neck-focus','Camera focus could not be controlled. Adjust distance until the selected skin region is sharp.');}
}
function observe(){sc.drawImage(video,roi.x,roi.y,roi.w,roi.h,0,0,64,64);const d=sc.getImageData(0,0,64,64).data;let r=0,g=0,b=0,clipped=0,motion=0;const gray=new Float32Array(d.length/4);for(let i=0,j=0;i<d.length;i+=4,j++){r+=d[i];g+=d[i+1];b+=d[i+2];const v=.2126*d[i]+.7152*d[i+1]+.0722*d[i+2];gray[j]=v;if(v<8||v>247)clipped++;if(previous)motion+=Math.abs(v-previous[j]);}const n=gray.length;previous=gray;const rgb=[r/n,g/n,b/n],brightness=.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];return {rgb,good:brightness>=20&&brightness<=235&&clipped/n<.2&&motion/n<8,brightness,motion:motion/n};}
function draw(result){const c=$('neck-wave'),g=c.getContext('2d'),w=c.width,h=c.height,L=65,R=20,T=20,B=45;g.clearRect(0,0,w,h);g.fillStyle='#0b1b28';g.fillRect(0,0,w,h);g.font='13px system-ui';g.fillStyle='#c3dce4';g.textAlign='right';for(const v of [-1,0,1]){const y=T+(1-v)/2*(h-T-B);g.strokeStyle='#365564';g.beginPath();g.moveTo(L,y);g.lineTo(w-R,y);g.stroke();g.fillText(String(v),L-10,y+4);}g.textAlign='center';for(let s=0;s<=6;s++){const x=L+s/6*(w-L-R);g.fillText(String(s-6),x,h-B+19);}g.fillText('Seconds before latest plotted sample',L+(w-L-R)/2,h-6);if(!result?.available){$('neck-signal-glow').setAttribute('opacity','0');text('neck-signal-state','Waiting for a measurable optical trace');g.fillText('Waiting for a stable optical signal',L+(w-L-R)/2,T+(h-T-B)/2);return;}const y=result.wave.slice(-result.rate*6),max=Math.max(1e-8,...y.map(Math.abs));g.beginPath();y.forEach((v,i)=>{const x=L+((i-y.length+1)/result.rate+6)/6*(w-L-R),py=T+(h-T-B)/2-v/max*((h-T-B)/2-5);if(i)g.lineTo(x,py);else g.moveTo(x,py);});g.strokeStyle='#79e0cf';g.lineWidth=2;g.stroke();const active=!!stream&&recording;const level=(y[y.length-1]/max+1)/2;$('neck-signal-glow').setAttribute('opacity',active?String(reducedMotion?.25:.15+.75*level):'0');text('neck-signal-state',active?'Live optical variation · not verified heartbeat events':'Trace frozen · illustration inactive');}
async function enable(){stop('Requesting camera permission…');if(!$('neck-consent').checked){text('neck-status','Confirm local camera-processing consent first.');return;}if(window.isSecureContext===false){text('neck-status','Camera access needs HTTPS, or localhost on this device. An HTTP network address is not a secure camera context.');return;}if(!navigator.mediaDevices?.getUserMedia){text('neck-status','This browser does not expose camera access. Open the page directly in a current browser using HTTPS or localhost.');return;}text('neck-camera-help','Requesting camera permission. Choose Allow in the browser prompt.');window.dispatchEvent(new CustomEvent('lungitude-pulse-start',{detail:{mode:'neck'}}));const attempt=token;$('neck-enable').disabled=true;$('neck-facing').disabled=true;$('neck-stop').disabled=false;roi=null;outline();try{const incoming=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:$('neck-facing').value},width:{ideal:640},height:{ideal:480},frameRate:{ideal:30}},audio:false});if(attempt!==token||!$('neck-consent').checked){incoming.getTracks().forEach(t=>t.stop());return;}stream=incoming;video.srcObject=stream;await video.play();if(attempt!==token)return;overlay.width=video.videoWidth||640;overlay.height=video.videoHeight||480;overlay.parentElement.style.aspectRatio=overlay.width+' / '+overlay.height;$('neck-camera-placeholder').hidden=true;text('neck-camera-help','Camera is on. Select a visible patch of neck skin in the live preview below.');controls();text('neck-status','Drag a rectangle over a visible patch of neck skin. This is a manual selection, not automatic anatomy detection.');focusRegion();lastFrame=-Infinity;raf=requestAnimationFrame(tick);}catch(e){if(attempt===token){const messages={NotAllowedError:'Camera permission was denied. Allow camera access in this site’s browser settings, then press Start neck camera again.',NotFoundError:'No camera was found. Connect a camera or try another device.',NotReadableError:'The camera could not start. Close other camera apps or tabs and try again.',OverconstrainedError:'The selected camera is unavailable. Choose the other camera and try again.',SecurityError:'Camera access is blocked by browser or site security settings.'};stop('Camera unavailable. '+(messages[e.name]||'Could not open the camera. Check permission, HTTPS or localhost, and camera availability.'));text('neck-camera-help','Camera did not start. See the message below and retry.');}}}
function showResult(result){
 draw(result);$('neck-summary').hidden=false;$('neck-live-bpm').textContent=String(result.bpm);
 $('neck-bpm').textContent=result.bpm+' bpm · experimental';
 $('neck-cycles').textContent=result.estimated_cycles+' estimated cycles in the '+result.duration_seconds.toFixed(1)+' s sampled window';
}
function tick(){
 if(!stream)return;
 if(document.hidden){stop('Stopped because the page was hidden. Start a new recording.');return;}
 const now=performance.now()/1000;
 if(recording&&Number.isFinite(lastFrame)&&now-lastFrame>2){stop('Camera frames were interrupted. No current estimate; retry.');return;}
 if(recording&&!continuous&&now-start>62){stop('Recording interrupted. No estimate produced; retake.');return;}
 if(now-lastFrame>=1/20&&video.readyState>=2&&roi){
  lastFrame=now;let q;try{q=observe();}catch(e){stop('Could not read camera pixels. Try again.');return;}
  text('neck-light',q.good?'Basic exposure/movement checks passed · not clinical image validation':'Improve diffuse lighting, avoid glare, or keep still');
  stable=q.good?stable+1:0;controls();
  if(recording){
   attempted++;if(q.good)rows.push([now,...q.rgb]);else{bad++;$('neck-summary').hidden=true;$('neck-live-bpm').textContent='—';draw(null);}
   frameChecks.push({t:now,good:q.good});
   if(continuous){while(rows.length&&rows[0][0]<now-60)rows.shift();while(frameChecks.length&&frameChecks[0].t<now-60)frameChecks.shift();}
   const elapsed=now-start;$('neck-progress').value=Math.min(60,elapsed);
   text('neck-status',continuous?(elapsed<60?'Live monitoring warm-up · '+Math.ceil(60-elapsed)+' seconds remaining':'Live monitoring · rolling 60-second window'):'Recording · '+Math.max(0,Math.ceil(60-elapsed))+' seconds remaining');
   if(q.good&&now-lastPlot>.25&&rows.length>=60){lastPlot=now;draw(NeckPPG.trace(rows.slice(-200)));}
   if(elapsed>=60&&(!continuous||now-lastEstimate>=5)){
    lastEstimate=now;
    const rejected=frameChecks.filter(f=>!f.good).length/Math.max(frameChecks.length,1);
    const result=rejected>.1?{available:false,reason:'Too many unstable or poorly exposed frames'}:NeckPPG.estimate(rows);
    if(!continuous){closeCamera();rows=[];frameChecks=[];}
    if(!result.available){$('neck-summary').hidden=true;$('neck-live-bpm').textContent='—';if(!continuous)clearResult();text('neck-status','Unable to estimate: '+result.reason+(continuous?'. Keep still; the rolling window needs stable data.':'. Retake or use the manual wrist count.'));}
    else{showResult(result);text('neck-status',continuous?'Live estimate · latest 60-second window. Not a diagnosis or a verified count of each heartbeat.':'Complete · camera stopped. Result is not a diagnosis or a count of individually verified heartbeats.');}
    if(!continuous)return;
   }
  }
 }
 raf=requestAnimationFrame(tick);
}
$('neck-facing').onchange=()=>{if(stream)stop('Camera selection changed. Press Start neck camera again.');};$('neck-enable').onclick=enable;$('neck-stop').onclick=()=>stop('Stopped · no result produced',true);$('neck-consent').onchange=()=>{if(!$('neck-consent').checked)stop('Consent withdrawn · camera stopped');};$('neck-skin-confirm').onchange=()=>{if(recording&&!$('neck-skin-confirm').checked)stop('Region confirmation withdrawn · recording cancelled');controls();};
$('neck-continuous').onchange=controls;
$('neck-record').onclick=()=>{if($('neck-record').disabled)return;clearResult();continuous=$('neck-continuous').checked;recording=true;frameChecks=[];lastEstimate=-Infinity;start=performance.now()/1000;rows=[];attempted=bad=0;lastPlot=-Infinity;controls();text('neck-status',continuous?'Live monitoring started. The first estimate needs 60 seconds.':'Recording for 60 seconds. Keep still and breathe naturally.');};
window.addEventListener('lungitude-pulse-start',e=>{if(e.detail?.mode!=='neck'&&(stream||$('neck-enable').disabled))stop('Another pulse mode started · neck camera stopped');});document.addEventListener('visibilitychange',()=>{if(document.hidden&&(stream||$('neck-enable').disabled))stop('Page hidden · camera stopped');});window.addEventListener('pagehide',()=>closeCamera());clearResult();controls();
})();
