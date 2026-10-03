/* Local-only camera capture. No diagnosis, inference, storage, or network requests. */
(function(){
'use strict';
const byId=id=>document.getElementById(id), video=byId('camera'), status=byId('status');
let stream=null, recorder=null, timer=null, interval=null, previous=null, samples=0, url=null, starting=false, photoUrl=null, frameId=null, lastDraw=0, recordingStarted=0;
const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;
const ctx=canvas.getContext('2d',{willReadFrequently:true});
const defaults=()=>[{x:.30,y:.32,size:.25},{x:.70,y:.32,size:.25},{x:.50,y:.70,size:.25}];
let regions=defaults();
const boxes=[...document.querySelectorAll('.roi')];
const zooms=[0,1,2].map(i=>byId('zoom-'+i).getContext('2d'));
function place(region,x,y){const margin=region.size/2;region.x=Math.max(margin,Math.min(1-margin,x));region.y=Math.max(margin,Math.min(1-margin,y));}
function positionBoxes(){regions.forEach((r,i)=>{const b=boxes[i];b.style.left=((r.x-r.size/2)*100)+'%';b.style.top=((r.y-r.size/2)*100)+'%';b.style.width=(r.size*100)+'%';b.style.height=(r.size*100)+'%';});}
function clock(){if(!recordingStarted)return;const seconds=Math.min(10,Math.floor((performance.now()-recordingStarted)/1000));byId('record-clock').textContent='00:'+String(seconds).padStart(2,'0')+' / 00:10';byId('camera-badge').textContent='REC · 00:'+String(seconds).padStart(2,'0');}
function liveFrames(now){
 if(!stream)return;
 if(video.readyState>=2&&now-lastDraw>=66){
  regions.forEach((r,i)=>{const w=r.size*video.videoWidth,h=r.size*video.videoHeight;zooms[i].drawImage(video,(r.x-r.size/2)*video.videoWidth,(r.y-r.size/2)*video.videoHeight,w,h,0,0,240,240);});lastDraw=now;clock();
 }
 frameId=requestAnimationFrame(liveFrames);
}
function endRecordingUI(){recordingStarted=0;byId('finish-recording').disabled=true;byId('camera-badge').classList.remove('recording');byId('camera-badge').textContent='LIVE PREVIEW';}
function clearLive(){cancelAnimationFrame(frameId);frameId=null;byId('region-layer').hidden=true;byId('zoom-grid').hidden=true;byId('camera-badge').hidden=true;zooms.forEach(c=>c.clearRect(0,0,240,240));endRecordingUI();}
byId('region-select').addEventListener('change',()=>{byId('region-size').value=Math.round(regions[Number(byId('region-select').value)].size*100);});
byId('region-size').addEventListener('input',()=>{const r=regions[Number(byId('region-select').value)];r.size=Number(byId('region-size').value)/100;place(r,r.x,r.y);positionBoxes();});
byId('reset-regions').addEventListener('click',()=>{regions=defaults();byId('region-size').value=25;positionBoxes();});
video.addEventListener('click',e=>{if(!stream)return;const b=video.getBoundingClientRect();place(regions[Number(byId('region-select').value)],(e.clientX-b.left)/b.width,(e.clientY-b.top)/b.height);positionBoxes();});
video.addEventListener('keydown',e=>{if(!stream)return;const shifts={ArrowLeft:[-.02,0],ArrowRight:[.02,0],ArrowUp:[0,-.02],ArrowDown:[0,.02]};if(!shifts[e.key])return;e.preventDefault();const r=regions[Number(byId('region-select').value)],d=shifts[e.key];place(r,r.x+d[0],r.y+d[1]);positionBoxes();});
byId('finish-recording').addEventListener('click',()=>{if(recorder?.state==='recording')recorder.stop();});
positionBoxes();
function revoke(){if(url){URL.revokeObjectURL(url);url=null;}byId('download').hidden=true;byId('download').removeAttribute('href');byId('clip-preview').pause();byId('clip-preview').removeAttribute('src');byId('clip-preview').hidden=true;}
function quality(){
 if(!stream||!video.videoWidth)return;
 const side=Math.min(video.videoWidth,video.videoHeight);
 ctx.drawImage(video,(video.videoWidth-side)/2,(video.videoHeight-side)/2,side,side,0,0,64,64);
 const pixels=ctx.getImageData(0,0,64,64).data, gray=new Float32Array(4096);let mean=0,diff=0;
 for(let i=0;i<gray.length;i++){gray[i]=.299*pixels[i*4]+.587*pixels[i*4+1]+.114*pixels[i*4+2];mean+=gray[i];if(previous)diff+=Math.abs(gray[i]-previous[i]);}
 mean/=gray.length;diff/=gray.length;samples++;
 byId('light').textContent='Lighting: '+(mean<35?'try more light':mean>220?'reduce glare':'within capture range');
 byId('motion').textContent='Motion: '+(!previous?'checking':diff>15?'hold steadier':'low frame change');
 byId('samples').textContent='Frames checked: '+samples;previous=gray;
}
function stop(){
 clearTimeout(timer);clearInterval(interval);clearLive();
 if(recorder&&recorder.state==='recording')recorder.stop();
 if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;previous=null;
 byId('start').disabled=false;byId('stop').disabled=true;byId('record').disabled=true;byId('snapshot').disabled=true;status.textContent='Camera is off.';
}
byId('start').addEventListener('click',async()=>{
 if(starting||stream)return;
 if(!byId('consent').checked){status.textContent='Confirm consent before enabling the camera.';return;}
 if(!navigator.mediaDevices?.getUserMedia){status.textContent='Camera access requires HTTPS or localhost and a supported browser.';return;}
 starting=true;byId('start').disabled=true;
 try{
  const incoming=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:byId('facing').value},width:{ideal:1280},height:{ideal:720}},audio:false});
  if(!byId('consent').checked){incoming.getTracks().forEach(t=>t.stop());return;}
  stream=incoming;video.srcObject=stream;await video.play();byId('region-layer').hidden=false;byId('zoom-grid').hidden=false;byId('camera-badge').hidden=false;lastDraw=0;frameId=requestAnimationFrame(liveFrames);samples=0;previous=null;interval=setInterval(quality,500);
  byId('stop').disabled=false;byId('snapshot').disabled=false;byId('record').disabled=!window.MediaRecorder;status.textContent='Preview active. Center the lesion and hold steady.';
 }catch(e){stop();status.textContent='Could not enable camera. Check permission and camera availability.';}
 finally{starting=false;if(!stream)byId('start').disabled=false;}
});
byId('record').addEventListener('click',()=>{
 if(!stream||!byId('consent').checked||recorder?.state==='recording')return;
 revoke();let chunks=[];
 try{
  const mime=['video/webm;codecs=vp8','video/webm','video/mp4'].find(x=>MediaRecorder.isTypeSupported(x));
  recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);
  const active=recorder;
  active.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  active.onerror=()=>{endRecordingUI();clearTimeout(timer);byId('record').disabled=!stream;status.textContent='Recording failed. Try again.';};
  active.onstop=()=>{
   endRecordingUI();clearTimeout(timer);byId('record').disabled=!stream;
   if(!byId('consent').checked||!chunks.length){chunks=[];return;}
   const blob=new Blob(chunks,{type:active.mimeType});chunks=[];url=URL.createObjectURL(blob);
   const link=byId('download');link.href=url;link.download='lungitude-research.'+(active.mimeType.includes('mp4')?'mp4':'webm');link.hidden=false;byId('clip-preview').src=url;byId('clip-preview').hidden=false;byId('capture-preview').hidden=false;
   status.textContent=stream?'Recording ready. Download it or record again.':'Camera off. Recording ready to download.';
  };
  active.start();recordingStarted=performance.now();byId('finish-recording').disabled=false;byId('camera-badge').classList.add('recording');clock();byId('record').disabled=true;status.textContent='Recording for 10 seconds…';
  timer=setTimeout(()=>{if(active.state==='recording')active.stop();},10000);
 }catch(e){endRecordingUI();byId('record').disabled=!stream;status.textContent='Recording is not supported by this browser.';}
});
function clearPhoto(){if(photoUrl)URL.revokeObjectURL(photoUrl);photoUrl=null;byId('photo-download').hidden=true;byId('photo-download').removeAttribute('href');byId('photo-preview').removeAttribute('src');byId('photo-preview').hidden=true;}
byId('snapshot').addEventListener('click',()=>{
 if(!stream||!byId('consent').checked||!video.videoWidth)return;
 const image=document.createElement('canvas');image.width=video.videoWidth;image.height=video.videoHeight;image.getContext('2d').drawImage(video,0,0);
 image.toBlob(blob=>{if(!blob||!byId('consent').checked)return;clearPhoto();photoUrl=URL.createObjectURL(blob);byId('photo-preview').src=photoUrl;byId('photo-preview').hidden=false;byId('capture-preview').hidden=false;const a=byId('photo-download');a.href=photoUrl;a.download='lungitude-capture.png';a.hidden=false;status.textContent='Photo ready. Download it for the imaging lab.';},'image/png');
});
byId('facing').addEventListener('change',()=>{stop();status.textContent='Camera changed. Enable camera to restart.';});
byId('stop').addEventListener('click',stop);
byId('consent').addEventListener('change',()=>{if(!byId('consent').checked){stop();revoke();clearPhoto();byId('capture-preview').hidden=true;}});
window.addEventListener('pagehide',()=>{stop();revoke();clearPhoto();byId('capture-preview').hidden=true;});
})();
