// Pose inference runs in a worker. Camera frames stay on this device.
const video=document.getElementById('neck-preview');
const status=document.getElementById('neck-ai-status');
let worker=null,busy=false,interval=null,lastRegion=null;
function start(){
 if(!worker){
  worker=new Worker('js/neck-pose-worker.js');
  worker.onmessage=e=>{
   busy=false;
   if(e.data.error){status.textContent='AI framing unavailable. Select neck skin manually.';return;}
   if(e.data.ready){status.textContent='AI framing ready · place face and shoulders in view.';return;}
   if(!e.data.region){lastRegion=null;window.dispatchEvent(new Event('lungitude-neck-lost'));status.textContent='Face and shoulders not reliably located. Move into view or select neck skin manually.';return;}
   const r=e.data.region;
   lastRegion=lastRegion?Object.fromEntries(Object.keys(r).map(k=>[k,.7*lastRegion[k]+.3*r[k]])):r;
   window.dispatchEvent(new CustomEvent('lungitude-neck-region',{detail:lastRegion}));
   status.textContent='AI framing active · check the neck box, hold still, and confirm exposed neck skin.';
  };
  worker.onerror=()=>{busy=false;status.textContent='AI framing could not start. Select neck skin manually.';};
 }
 clearInterval(interval);
 interval=setInterval(async()=>{
  if(document.hidden||video.readyState<2||!video.srcObject?.active||busy)return;
  busy=true;
  try{const frame=await createImageBitmap(video);worker.postMessage({frame,time:performance.now()},[frame]);}catch{busy=false;}
 },250);
}
video.addEventListener('playing',start);
video.addEventListener('pause',()=>{clearInterval(interval);lastRegion=null;});
window.addEventListener('pagehide',()=>{clearInterval(interval);worker?.terminate();});
