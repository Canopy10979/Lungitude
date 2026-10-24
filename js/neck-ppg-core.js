/* Research POS-style RGB pulse extraction. No diagnosis, anatomy or clinical confidence. */
(function(root){'use strict';
const average=a=>a.reduce((s,x)=>s+x,0)/a.length;
const deviation=a=>{const m=average(a);return Math.sqrt(average(a.map(x=>(x-m)**2)));};
function spectrum(x,fs){
 const mean=average(x),window=x.map((v,i)=>(v-mean)*(.5-.5*Math.cos(2*Math.PI*i/(x.length-1))));
 const bins=[];for(let bpm=42;bpm<=180;bpm++){const f=bpm/60;let re=0,im=0;for(let i=0;i<window.length;i++){const a=2*Math.PI*f*i/fs;re+=window[i]*Math.cos(a);im-=window[i]*Math.sin(a);}bins.push(re*re+im*im);}
 const peak=bins.indexOf(Math.max(...bins));let near=0,total=0;for(let i=0;i<bins.length;i++){total+=bins[i];if(Math.abs(i-peak)<=6)near+=bins[i];}
 return {bpm:42+peak,concentration:near/Math.max(total,1e-20)};
}
function estimate(samples,minSeconds=59,options={}){
 const fail=reason=>({available:false,reason});
 if(!Array.isArray(samples)||samples.length<(options.traceOnly?60:160)||samples.some(a=>!Array.isArray(a)||a.length!==4||a.some(v=>!Number.isFinite(v))))return fail('Not enough valid RGB samples');
 const t=samples.map(a=>a[0]),duration=t.at(-1)-t[0];if(duration<minSeconds)return fail('A full stable recording is required');
 const dt=t.slice(1).map((x,i)=>x-t[i]);if(dt.some(x=>x<=0||x>.25))return fail('Dropped frames or non-increasing timestamps');
 const meanDt=average(dt),fps=1/meanDt;if(fps<12||fps>65||deviation(dt)/meanDt>.35)return fail('Sampling is too irregular');
 if(samples.some(a=>a.slice(1).some(v=>v<10||v>245)))return fail('Poor exposure in the selected region');
 const fs=20,n=Math.floor(duration*fs)+1,colors=[];let j=0;
 for(let i=0;i<n;i++){const at=t[0]+i/fs;while(j<samples.length-2&&t[j+1]<at)j++;const f=(at-t[j])/(t[j+1]-t[j]);colors.push([1,2,3].map(k=>samples[j][k]+f*(samples[j+1][k]-samples[j][k])));}
 const size=32,wave=Array(n).fill(0),weights=Array(n).fill(0);
 // Overlapping 1.6 s temporal windows, normalized channel means, POS projection.
 for(let start=0;start+size<=n;start+=8){
  const part=colors.slice(start,start+size),means=[0,1,2].map(k=>average(part.map(v=>v[k])));
  const normal=part.map(v=>v.map((x,k)=>x/means[k]-1));
  const a=normal.map(v=>v[1]-v[2]),b=normal.map(v=>-2*v[0]+v[1]+v[2]);
  const alpha=deviation(a)/Math.max(deviation(b),1e-12);const h=a.map((v,k)=>v+alpha*b[k]),m=average(h);
  for(let k=0;k<size;k++){const taper=.5-.5*Math.cos(2*Math.PI*k/(size-1));wave[start+k]+=(h[k]-m)*taper;weights[start+k]+=taper;}
 }
 for(let i=0;i<n;i++)wave[i]/=Math.max(weights[i],1e-12);
 const usable=wave.slice(size,n-size);if(usable.length<(options.traceOnly?8:80)||deviation(usable)<1e-7)return fail('No measurable color-pulse component');
 if(options.traceOnly)return {available:true,wave:usable,rate:fs,notice:'Optical variation, not independently confirmed heartbeats'};
 const result=spectrum(usable,fs);if(result.concentration<.55)return fail('No stable dominant pulse-band component');
 if(duration>=minSeconds&&duration>30){const midpoint=Math.floor(usable.length/2);const a=spectrum(usable.slice(0,midpoint),fs),b=spectrum(usable.slice(midpoint),fs);if(a.concentration<.45||b.concentration<.45||Math.abs(a.bpm-b.bpm)>10)return fail('Pulse-band estimate changed too much during recording');}
 return {available:true,bpm:result.bpm,estimated_cycles:Math.round(result.bpm*duration/60),duration_seconds:duration,concentration:result.concentration,wave:usable,rate:fs,notice:'Experimental RGB estimate. Motion or lighting can mimic pulse. Not a beat-by-beat count, diagnosis, or clinical confidence score.'};
}
if(typeof module!=='undefined')module.exports={estimate,trace:samples=>estimate(samples,4,{traceOnly:true})};else root.NeckPPG={estimate,trace:samples=>estimate(samples,4,{traceOnly:true})};
})(globalThis);
