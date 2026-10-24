// Real provider UI setup with mocked SDK/network; no actual Google login claimed.
const vm=require('vm'),fs=require('fs'),assert=require('node:assert/strict');
function harness(failFirst=false){
 class Element{constructor(){this.hidden=false;this.value='';this.checked=false;this.disabled=false;this.textContent='';}reset(){}reportValidity(){return true;}replaceChildren(){}removeAttribute(){}dispatchEvent(){}focus(){}scrollIntoView(){}remove(){}}
 const e={};for(const m of fs.readFileSync('index.html','utf8').matchAll(/id="([^"]+)"/g))e[m[1]]=new Element();e['social-signin'].hidden=e['google-signin'].hidden=true;
 let attempts=0,renders=0,configuration,submitted;
 const google={accounts:{id:{initialize(config){configuration=config;},renderButton(container){assert.equal(e['social-signin'].hidden,false);assert.equal(container.hidden,false);renders++;},prompt(){throw Error('Must not prompt on page load');}}}};
 const context={document:{getElementById:id=>e[id],createElement:()=>new Element(),head:{append(script){attempts++;setImmediate(()=>{if(failFirst&&attempts===1)script.onerror();else script.onload();});}}},window:{},google,FormData,AbortSignal,Event,setTimeout,clearTimeout,console,confirm:()=>true,fetch:async (url,options)=>{if(url.includes('oauth_config'))return{ok:true,json:async()=>({providers:{google:{enabled:true,client_id:'test.apps.googleusercontent.com'}},nonce:'nonce',state:'state'})};if(options?.method==='POST'){submitted=Object.fromEntries(options.body);return{ok:true,json:async()=>({csrf:'existing-csrf',profile:null})};}return{ok:false,json:async()=>({error:'Sign in'})};}};
 vm.runInNewContext(fs.readFileSync('js/account.js','utf8'),context);
 return{e,get submitted(){return submitted;},get renders(){return renders;},get configuration(){return configuration;}};
}
const settle=async()=>{for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));};
(async()=>{let h=harness();await settle();assert.equal(h.renders,1);assert.equal(h.configuration.auto_select,false);assert.equal(h.configuration.ux_mode,'popup');assert.equal(h.e['google-signin'].hidden,false);
 h.e['account-email'].value='person@example.org';h.e['account-password'].value='unique-password-123';h.e['auth-form'].onsubmit({preventDefault(){}});await settle();assert.equal(h.e['profile-card'].hidden,false);assert.equal(h.e['link-google'].hidden,false);await h.e['link-google'].onclick();await settle();assert.equal(h.renders,2);h.configuration.callback({credential:'verified-token'});await settle();assert.equal(h.submitted.link,'yes');assert.equal(h.submitted.csrf,'existing-csrf');assert(h.e['google-link-status'].textContent.includes('Google is connected'));
 h=harness(true);await settle();assert.equal(h.renders,0);assert.equal(h.e['retry-social'].hidden,false);assert(h.e['social-status'].textContent.includes('Retry'));await h.e['retry-social'].onclick();await settle();assert.equal(h.renders,1);assert.equal(h.e['retry-social'].hidden,true);
 console.log('PASS: Google renders in visible containers without automatic prompts; failed SDK loading can be retried. Mock SDK only.');})().catch(error=>{console.error(error);process.exitCode=1;});
