
let model=null;
const ready=(async()=>{
 const {FilesetResolver,PoseLandmarker}=await import('../assets/pose/vision_bundle.mjs');
 const files=await FilesetResolver.forVisionTasks(new URL('../assets/pose/wasm',self.location.href).href);
 model=await PoseLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:new URL('../assets/pose/pose_landmarker_lite.task',self.location.href).href,delegate:'CPU'},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.6,minTrackingConfidence:.6});
 postMessage({ready:true});
})();
self.onmessage=async e=>{
 const {frame,time}=e.data;
 try{
  await ready;
  const points=model.detectForVideo(frame,time).landmarks?.[0];
  if(!points||[9,10,11,12].some(i=>(points[i].visibility??0)<.65)){postMessage({region:null});return;}
  const mouth={x:(points[9].x+points[10].x)/2,y:(points[9].y+points[10].y)/2};
  const shoulders={x:(points[11].x+points[12].x)/2,y:(points[11].y+points[12].y)/2};
  const gap=shoulders.y-mouth.y,width=Math.abs(points[11].x-points[12].x)*.22;
  if(gap<.035||width<.035){postMessage({region:null});return;}
  const w=Math.min(.25,width),h=Math.min(.2,gap*.48),cx=(mouth.x+shoulders.x)/2;
  const x=Math.max(0,Math.min(1-w,cx-w/2)),y=Math.max(0,Math.min(1-h,mouth.y+gap*.38));
  postMessage({region:{x,y,w,h}});
 }catch(error){postMessage({error:String(error.message||error)});}finally{frame.close();}
};
