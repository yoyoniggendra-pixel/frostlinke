const EMBED_RATIOS=[['9:16','9 / 16'],['16:9','16 / 9'],['4:5','4 / 5'],['1:1','1 / 1']];
let selectedRatio='16:9';
let installedModal=null;

const style=document.createElement('style');
style.textContent=`
.fx-embed-ratio-picker{position:relative;z-index:20;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:0 0 14px;padding:10px;border:1px solid #52c7ea35;border-radius:14px;background:#03131de8}
.fx-embed-ratio-picker-title{grid-column:1/-1;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#9bcbd8}
.fx-embed-ratio-choice{appearance:none;border:1px solid #52c7ea38;background:#061b27;color:#a9cbd5;border-radius:10px;min-height:42px;padding:8px 6px;font:600 11px system-ui;cursor:pointer;touch-action:manipulation;transition:.15s ease}
.fx-embed-ratio-choice:hover{border-color:#58d7ff;background:#092838;color:#eafaff}
.fx-embed-ratio-choice[aria-checked="true"]{border-color:#58d7ff;background:#0d718f;color:#fff;box-shadow:0 0 0 1px #58d7ff55,0 5px 18px #00101866}
@media(max-width:520px){.fx-embed-ratio-picker{grid-template-columns:repeat(2,minmax(0,1fr));}.fx-embed-ratio-choice{min-height:46px}}
`;
document.head.appendChild(style);

function isEmbedModal(modal){
  return !!modal?.querySelector('.embed-shell iframe.embed, iframe.embed, .embed-shell');
}

function installPicker(modal){
  if(!modal||installedModal===modal||!isEmbedModal(modal))return;
  if(modal.querySelector('.fx-embed-ratio-picker')){installedModal=modal;return;}

  selectedRatio='16:9';
  const shell=modal.querySelector('.embed-shell, iframe.embed')?.closest('.embed-shell')||modal.querySelector('iframe.embed')?.parentElement;
  if(!shell)return;

  const picker=document.createElement('div');
  picker.className='fx-embed-ratio-picker';
  picker.setAttribute('role','radiogroup');
  picker.innerHTML='<div class="fx-embed-ratio-picker-title">Choose format</div>'+EMBED_RATIOS.map(([label])=>`<button type="button" class="fx-embed-ratio-choice" role="radio" aria-checked="${label==='16:9'}" data-ratio="${label}">${label}</button>`).join('');
  shell.parentNode.insertBefore(picker,shell);

  picker.addEventListener('click',e=>{
    const button=e.target.closest('.fx-embed-ratio-choice');
    if(!button)return;
    selectedRatio=button.dataset.ratio||'16:9';
    picker.querySelectorAll('.fx-embed-ratio-choice').forEach(b=>b.setAttribute('aria-checked',String(b===button)));
    shell.style.setProperty('--embed-ratio',selectedRatio.replace(':',' / '));
    shell.dataset.aspectRatio=selectedRatio;
  });
  installedModal=modal;
}

const observer=new MutationObserver(()=>{
  document.querySelectorAll('.modal').forEach(installPicker);
  if(!document.querySelector('.modal'))installedModal=null;
});
observer.observe(document.body,{childList:true,subtree:true});

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
