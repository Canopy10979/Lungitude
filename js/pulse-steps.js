// One option per panel, with explicit Back/Next navigation.
(()=>{
 const main=document.querySelector('main'),cards=[...main.querySelectorAll(':scope > .pulse-card')];
 if(cards.length<3)return;
 const panels=cards.slice(0,3),nav=document.createElement('nav');nav.className='step-tabs';nav.setAttribute('aria-label','Pulse measurement options');
 const labels=['1 · Wrist count','2 · Fingertip camera','3 · Neck camera'];let selected=0;
 const buttons=labels.map((label,i)=>{const b=document.createElement('button');b.type='button';b.className='button';b.textContent=label;b.onclick=()=>show(i);nav.append(b);return b;});
 panels.forEach((panel,i)=>{panel.id=panel.id||'pulse-option-'+(i+1);const actions=document.createElement('div');actions.className='step-actions';if(i){const b=document.createElement('button');b.className='button';b.textContent='← Back';b.onclick=()=>show(i-1);actions.append(b);}if(i<2){const b=document.createElement('button');b.className='button primary';b.textContent='Next →';b.onclick=()=>show(i+1);actions.append(b);}panel.append(actions);});
 panels[0].before(nav);
 function show(i){
  if(i!==selected)window.dispatchEvent(new CustomEvent('lungitude-pulse-start',{detail:{mode:'navigation'}}));
  selected=i;panels.forEach((p,j)=>{p.hidden=i!==j;p.classList.remove('step-enter');if(i===j){void p.offsetWidth;p.classList.add('step-enter');}});buttons.forEach((b,j)=>{b.setAttribute('aria-current',i===j?'step':'false');b.setAttribute('aria-controls',panels[j].id);});
 }
 document.querySelector('a[href="#neck-check"]')?.addEventListener('click',()=>show(2));
 if(location.hash==='#neck-check')selected=2;else if(location.hash==='#fingertip-check')selected=1;
 show(selected);
})();
