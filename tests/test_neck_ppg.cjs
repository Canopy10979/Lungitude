const assert=require('node:assert/strict');const {estimate}=require('../js/neck-ppg-core.js');
function trace(bpm=72,mode='pulse'){return Array.from({length:1801},(_,i)=>{const t=i/30,p=Math.sin(2*Math.PI*bpm/60*t);if(mode==='common')return [t,120*(1+.01*p),110*(1+.01*p),90*(1+.01*p)];if(mode==='flat')return [t,120,110,90];return [t,120,110+1.5*p,90];});}
for(const bpm of [42,60,72,100,150,180]){const r=estimate(trace(bpm));assert.equal(r.available,true,`${bpm}: ${r.reason}`);assert.ok(Math.abs(r.bpm-bpm)<=2);assert.ok(Math.abs(r.estimated_cycles-bpm)<=2);}
assert.equal(estimate(trace(72,'flat')).available,false);assert.equal(estimate(trace(72,'common')).available,false);
const dropped=trace();dropped[100][0]=dropped[99][0];assert.equal(estimate(dropped).available,false);
assert.equal(estimate(trace().slice(0,300)).available,false);assert.equal(estimate(trace().map(v=>[v[0],250,250,250])).available,false);
console.log('PASS six synthetic neck rates, estimated cycles, flat/common illumination rejection, timing/duration/exposure guards');
