const EMBED_RATIOS=['9:16','16:9','4:5','1:1'];
let selectedRatio='16:9';

const style=document.createElement('style');
style.textContent=`
.embed-ratios{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px!important;align-items:stretch!important;position:relative!important;z-index:100!important;margin:0 0 14px!important;padding:10px!important;border:1px solid #52c7ea55!important;border-radius:14px!important;background:#03131df2!important;visibility:visible!important;opacity:1!important}
.embed-ratios>span{grid-column:1/-1!important;font-size:10px!important;font-weight:700!important;letter-spacing:.08em!important;text-transform:uppercase!important;color:#9bcbd8!important}
.embed-ratios button{display:flex!important;align-items:center!important;justify-content:center!important;min-height:44px!important;padding:8px 10px!important;border:1px solid #52c7ea55!important;border-radius:10px!important;background:#061b27!important;color:#a9cbd5!important;font:600 11px system-ui!important;cursor:pointer!important;pointer-events:auto!important;touch-action:manipulation!important}
.embed-ratios button.active,.embed-ratios button[aria-checked="true"]{background:#0d718f!important;border-color:#58d7ff!important;color:#fff!important;box-shadow:0 0 0 1px #58d7ff55!important}
.fx-embed-ratio-picker{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;position:relative;z-index:100;margin:0 0 14px;padding:10px;border:1px solid #52c7ea55;border-radius:14px;background:#03131df2}
.fx-embed-ratio-title{grid-column:1/-1;font:700 10px system-ui;letter-spacing:.08em;text-transform:uppercase;color:#9bcbd8}
.fx-embed-ratio-choice{min-height:44px;border:1px solid #52c7ea55;border-radius:10px;background:#061b27;color:#a9cbd5;font:600 11px system-ui;cursor:pointer;touch-action:manipulation}
.fx-embed-ratio-choice[aria-checked="true"]{background:#0d718f;color:#fff;border-color:#58d7ff}
.embed-shell{max-width:min(100%,420px)!important;max-height:70vh!important;margin:10px auto!important;overflow:hidden!important}
.embed-popout{left:14px!important;bottom:14px!important;width:min(420px,calc(100vw - 28px))!important;z-index:200!important}
@media(max-width:600px){.embed-ratios,.fx-embed-ratio-picker{grid-template-columns:repeat(2,minmax(0,1fr))!important}.embed-shell{max-width:min(100%,360px)!important;max-height:55vh!important}.embed-actions{opacity:1!important;pointer-events:auto!important}.embed-popout{left:8px!important;bottom:8px!important;width:calc(100vw - 16px)!important}}
`;
document.head.appendChild(style);

function getEmbedModal(){
  return [...document.querySelectorAll('.modal')].find(m=>{
    const h=m.querySelector('h3');
    return h&&/embed preview/i.test(h.textContent||'');
  })||null;
}

function makeFallbackPicker(modal){
  if(!modal||modal.querySelector('.embed-ratios,.fx-embed-ratio-picker'))return;
  const shell=modal.querySelector('.embed-shell');
  if(!shell)return;
  const picker=document.createElement('div');
  picker.className='fx-embed-ratio-picker';
  picker.setAttribute('role','radiogroup');
  picker.innerHTML='<div class="fx-embed-ratio-title">Choose format</div>'+EMBED_RATIOS.map(r=>`<button type="button" class="fx-embed-ratio-choice" role="radio" aria-checked="${r===selectedRatio}" data-ratio="${r}">${r}</button>`).join('');
  shell.parentNode.insertBefore(picker,shell);
  picker.addEventListener('click',e=>{
    const b=e.target.closest('[data-ratio]');
    if(!b)return;
    selectedRatio=b.dataset.ratio;
    picker.querySelectorAll('[data-ratio]').forEach(x=>x.setAttribute('aria-checked',String(x===b)));
    shell.style.aspectRatio=selectedRatio.replace(':',' / ');
    shell.style.setProperty('--embed-ratio',selectedRatio.replace(':',' / '));
  });
}

function wireReactPicker(modal){
  const picker=modal?.querySelector('.embed-ratios');
  if(!picker||picker.dataset.fxWired==='1')return;
  picker.dataset.fxWired='1';
  picker.querySelectorAll('button').forEach(button=>{
    button.addEventListener('click',()=>{
      selectedRatio=button.textContent.trim();
      picker.querySelectorAll('button').forEach(b=>b.setAttribute('aria-checked',String(b===button)));
      const shell=modal.querySelector('.embed-shell');
      if(shell){shell.style.aspectRatio=selectedRatio.replace(':',' / ');shell.style.setProperty('--embed-ratio',selectedRatio.replace(':',' / '));}
    },{capture:true});
  });
}

function scan(){
  const modal=getEmbedModal();
  if(!modal)return;
  const reactPicker=modal.querySelector('.embed-ratios');
  if(reactPicker)wireReactPicker(modal);
  else makeFallbackPicker(modal);
}

new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});
scan();

const originalFetch=window.fetch.bind(window);
window.fetch=async(input,init={})=>{
  try{
    const url=typeof input==='string'?input:(input?.url||'');
    if(url.includes('/api/conversations/')&&url.endsWith('/messages')&&init?.method?.toUpperCase()==='POST'&&typeof init.body==='string'){
      const body=JSON.parse(init.body);
      if(body?.type==='embed'&&body.payload&&typeof body.payload==='object'){
        body.payload={...body.payload,aspectRatio:selectedRatio||body.payload.aspectRatio||'16:9'};
        init={...init,body:JSON.stringify(body)};
      }
    }
  }catch{}
  return originalFetch(input,init);
};
