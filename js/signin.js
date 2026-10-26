/* Optional account UI shared across tools. Sessions use server-set HttpOnly cookies. */
(()=>{'use strict';
const header=document.querySelector('body > header');if(!header)return;
let user=null,csrf='',mode='login',busy=false,providerConfig=null;
const account=document.createElement('button');account.type='button';account.className='account-chip';account.textContent='Sign in';account.setAttribute('aria-haspopup','dialog');header.append(account);
const dialog=document.createElement('dialog');dialog.className='signin-dialog';dialog.setAttribute('aria-labelledby','signin-title');
dialog.innerHTML=`<div class="signin-heading"><h2 id="signin-title">Welcome to Lungitude</h2><button type="button" id="signin-close" class="button">Close</button></div><div id="signin-guest"><p>Sign in to continue with your account, or keep exploring without an account.</p><div id="signin-google"></div><p id="signin-provider-status" role="status"></p><p class="signin-divider">or use email</p><form id="signin-form"><label id="signin-name-label" hidden>Your name<input id="signin-name" autocomplete="name" maxlength="80"></label><label>Email<input id="signin-email" type="email" autocomplete="email" maxlength="254" required></label><label>Password<input id="signin-password" type="password" autocomplete="current-password" minlength="10" maxlength="128" required></label><p class="fine">Use your Lungitude password, or choose Google above.</p><div class="signin-actions"><button class="button primary" id="signin-submit" type="submit">Sign in</button><button class="button" id="signin-switch" type="button">Create account</button></div></form><button class="button subtle" id="signin-skip" type="button">Continue without signing in</button></div><div id="signin-member" hidden><p id="signin-welcome"></p><a class="button primary" href="survey.html">Continue to questionnaire →</a><button id="signin-link-google" type="button" class="button">Link Google sign-in</button><div id="signin-google-link"></div><button id="signin-logout" type="button" class="button">Sign out</button></div><p id="signin-status" role="status"></p>`;
document.body.append(dialog);const $=id=>document.getElementById(id);
async function request(action,fields){const options={credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(20000)};if(fields){options.method='POST';options.body=new URLSearchParams(fields);}const r=await fetch('api/account.php?action='+action,options),data=await r.json();if(!r.ok)throw new Error(data.error||'Sign-in could not be completed.');return data;}
function render(){account.textContent=user?user.name:'Sign in';account.title=user?'Your account':'Sign in or create an account';$('signin-guest').hidden=!!user;$('signin-member').hidden=!user;if(user)$('signin-welcome').textContent='You are signed in as '+user.name+'. Continue the questionnaire at your own pace.';}
function accept(data){user=data.user||{name:'My account'};csrf=data.csrf;window.dispatchEvent(new CustomEvent('lungitude-auth-change',{detail:{user}}));$('signin-password').value='';$('signin-status').textContent='Signed in successfully.';render();}
let googleScript=null;
async function setupGoogle(target='signin-google',link=false){
 const output=$(link?'signin-status':'signin-provider-status');output.textContent='Loading Google sign-in…';
 try{
  providerConfig=await request('oauth_config');const config=providerConfig.providers?.google;
  if(!config?.enabled){output.textContent='Google sign-in is not configured. You can use email.';return;}
  if(!googleScript)googleScript=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.onload=resolve;script.onerror=()=>reject(new Error('Google sign-in could not load. Please use email or try again.'));document.head.append(script);});
  await googleScript;
  google.accounts.id.initialize({client_id:config.client_id,nonce:providerConfig.nonce,auto_select:false,ux_mode:'popup',callback:async response=>{
   if(busy)return;busy=true;output.textContent='Verifying your Google sign-in…';
   try{accept(await request('oauth',{provider:'google',credential:response.credential,state:providerConfig.state,...(link?{link:'yes',csrf}: {})}));output.textContent='';}catch(error){output.textContent=error.message+' Close and reopen Sign in to retry.';}finally{busy=false;}
  }});
  $(target).replaceChildren();google.accounts.id.renderButton($(target),{theme:'outline',size:'large',shape:'pill',text:'continue_with',width:Math.max(200,Math.min(260,$(target).clientWidth||240))});output.textContent='';
 }catch(error){output.textContent=error.message||'Google sign-in is unavailable. Use email.';googleScript=null;}
}
account.onclick=()=>{render();$('signin-status').textContent='';dialog.showModal();if(!user)setupGoogle();};
$('signin-close').onclick=$('signin-skip').onclick=()=>dialog.close();
$('signin-switch').onclick=()=>{mode=mode==='login'?'register':'login';$('signin-name-label').hidden=mode!=='register';$('signin-name').required=mode==='register';$('signin-submit').textContent=mode==='register'?'Create account':'Sign in';$('signin-switch').textContent=mode==='register'?'Already have an account?':'Create account';$('signin-password').autocomplete=mode==='register'?'new-password':'current-password';$('signin-status').textContent='';};
$('signin-form').onsubmit=async event=>{event.preventDefault();if(busy||!$('signin-form').reportValidity())return;busy=true;$('signin-submit').disabled=true;$('signin-status').textContent=mode==='register'?'Creating your account…':'Signing in…';try{accept(await request(mode,{name:$('signin-name').value.trim(),email:$('signin-email').value,password:$('signin-password').value}));}catch(error){$('signin-status').textContent=error.message;}finally{busy=false;$('signin-submit').disabled=false;}};
$('signin-link-google').onclick=()=>setupGoogle('signin-google-link',true);
$('signin-logout').onclick=async()=>{if(busy)return;busy=true;try{await request('logout',{csrf});user=null;csrf='';window.dispatchEvent(new CustomEvent('lungitude-auth-change',{detail:{user:null}}));render();$('signin-status').textContent='Signed out.';setupGoogle();}catch(error){$('signin-status').textContent=error.message;}finally{busy=false;}};
request('me').then(accept).catch(()=>render());render();
})();
