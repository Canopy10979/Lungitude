const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=require('path').resolve(__dirname,'..')+'/';
function environment(mode){
 let now=0,queue=[],stops=0;const nodes=new Map(),events={};
 const context2d=new Proxy({getImageData(x,y,w=64,h=64){const data=new Uint8ClampedArray(w*h*4),a=Math.sin(2*Math.PI*1.2*now/1000);for(let i=0;i<data.length;i+=4){data[i]=mode==='finger'?170+4*a:140+a;data[i+1]=mode==='finger'?35:110+3*a;data[i+2]=mode==='finger'?30:90+.2*a;data[i+3]=255;}return {data};}}, {get:(o,k)=>o[k]||(()=>{})});
 function node(id){if(!nodes.has(id))nodes.set(id,{id,textContent:'',value:id==='neck-facing'?'user':0,hidden:true,disabled:false,checked:true,width:640,height:480,readyState:2,videoWidth:640,videoHeight:480,style:{},parentElement:{style:{}},getContext:()=>context2d,setAttribute(){},removeAttribute(){},addEventListener(k,f){this[k]=f;},pause(){},play:async()=>{},getBoundingClientRect:()=>({left:0,top:0,width:640,height:480})});return nodes.get(id);}
 const stream={active:true,getTracks:()=>[{stop(){stops++;},applyConstraints:async()=>{}}],getVideoTracks:()=>[{applyConstraints:async()=>{}}]};
 const win={matchMedia:()=>({matches:true}),addEventListener(k,f){(events[k]??=[]).push(f);},dispatchEvent(e){for(const f of events[e.type]||[])f(e);}};
 const BW={measures:{}},ctx={console,document:{getElementById:node,createElement:node,hidden:false,addEventListener(){}},window:win,BW,navigator:{mediaDevices:{getUserMedia:async()=>stream}},performance:{now:()=>now},requestAnimationFrame:f=>(queue.push(f),queue.length),cancelAnimationFrame:()=>{queue=[];},CustomEvent:class{constructor(type,o){this.type=type;this.detail=o?.detail;}},NeckPPG:require(root+'js/neck-ppg-core.js')};
 vm.createContext(ctx);
 return {ctx,node,win,advance(seconds){const end=now+seconds*1000;while(queue.length&&now<end){now+=mode==='finger'?1000/30:51;queue.shift()();}},stops:()=>stops};
}
(async()=>{
 const f=environment('finger');vm.runInContext(fs.readFileSync(root+'js/pulse-measure.js','utf8'),f.ctx);
 await f.node('pulse-start').click();f.advance(3);f.node('pulse-submit').onclick();assert(f.node('pulse-result').textContent.includes('Not enough'));f.advance(10);f.node('pulse-submit').onclick();assert.equal(f.node('pulse-summary').hidden,false);assert(Math.abs(f.ctx.BW.measures.pulse.hr-72)<=3);assert(f.stops()>0);console.log('PASS: fingertip rejects a short recording and submits a ~72 bpm synthetic signal before 25 seconds');
 await f.node('pulse-start').click();f.advance(26);assert(f.node('pulse-result').textContent.includes('Click Submit'));assert.equal(f.node('pulse-summary').hidden,true);f.node('pulse-submit').onclick();assert.equal(f.node('pulse-summary').hidden,false);console.log('PASS: fingertip time limit waits for explicit Submit');
 const n=environment('neck');vm.runInContext(fs.readFileSync(root+'js/neck-ppg.js','utf8'),n.ctx);await n.node('neck-enable').onclick();n.win.dispatchEvent({type:'lungitude-neck-region',detail:{x:.4,y:.4,w:.2,h:.2}});n.advance(4);n.node('neck-submit').onclick();assert(n.node('neck-status').textContent.includes('Not enough reliable'));n.advance(12);n.node('neck-submit').onclick();assert.equal(n.node('neck-summary').hidden,false);assert(Math.abs(parseInt(n.node('neck-bpm').textContent)-72)<=3);assert(n.stops()>0);console.log('PASS: neck auto-starts after confirmation, rejects short capture, then submits a ~72 bpm synthetic RGB signal');
 const core=require(root+'js/neck-ppg-core.js');assert.equal(core.estimate(Array.from({length:300},(_,i)=>[i/20,140,110,90]),8).available,false);console.log('PASS: constant RGB input does not fabricate a pulse');
})().catch(e=>{console.error(e);process.exitCode=1;});
