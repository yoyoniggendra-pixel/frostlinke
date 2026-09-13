const EMBED_RATIOS=['9:16','16:9','4:5','1:1'];
let selectedRatio='16:9';
const style=document.createElement('style');
style.textContent=`
.embed-ratios{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px!important;position:relative!important;z-index:100!important;margin:0 0 14px!important;padding:10px!important;border:1px solid #52c7ea55!important;border-radius:14px!important;background:#03131df2!important;visibility:visible!important;opacity:1!important}
.embed-ratios>span{grid-column:1/-1!important;font-size:10px!important;font-weight:700!important;letter-spacing:.08em!important;text-transform:uppercase!important;color:#9bcbd8!important}
.embed-ratios button{display:flex!important;align-items:center!important;justify-content:center!important;min-height:44px!important;padding:8px 10px!important;border:1px solid #52c7ea55!important;border-radius:10px!important;background:#061b27!important;color:#a9cbd5!important;font:600 11px system-ui!important;cursor:pointer!important;pointer-events:auto!important;touch-action:manipulation!important}
.embed-ratios button.active,.embed-ratios button[aria-checked="true"]{background:#0d718f!important;border-color:#58d7ff!important;color:#fff!important}
.embed-shell{display:block!important;position:relative!important;width:min(100%,420px)!important;max-width:100%!important;height:236px!important;min-height:236px!important;aspect-ratio:auto!important;margin:10px auto!important;overflow:hidden!important;border-radius:13px!important;background:#000!important}
.embed-shell .embed{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;display:block!important;border:0!important}
.embed-actions{z-index:5!important}
.embed-popout{left:14px!important;bottom:14px!important;width:min(672px,calc(100vw - 28px))!important;z-index:200!important}
.embed-popout-frame{width:100%!important;max-height:70vh!important;overflow:hidden!important;border-radius:10px!important}
.embed-popout-frame .embed{width:100%!important;height:100%!important;display:block!important}
@media(max-width:600px){.embed-ratios{grid-template-columns:repeat(2,minmax(0,1fr))!important}.embed-shell{width:min(100%,340px)!important;height:190px!important;min-height:190px!important}.embed-actions{opacity:1!important;pointer-events:auto!important}.embed-popout{left:8px!important;bottom:8px!important;width:calc(100vw - 16px)!important}.embed-popout-frame{max-height:62vh!important}}
`;
document.head.appendChild(style);

function getEmbedModal(){return [...document.querySelectorAll('.modal')].find(m=>/embed preview/i.test(m.querySelector('h3')?.textContent||''))||null}
function wire(){
 const modal=getEmbedModal();if(!modal)return;
 const picker=modal.querySelector('.embed-ratios');
 if(!picker)return;
 const shell=modal.querySelector('.embed-shell');
 picker.querySelectorAll('button').forEach(b=>{
  if(b.dataset.fxWired==='1')return;
  b.dataset.fxWired='1';
  b.addEventListener('click',()=>{
   selectedRatio=b.textContent.trim();
   picker.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));
   if(shell){shell.dataset.aspectRatio=selectedRatio;shell.style.setProperty('--embed-ratio',selectedRatio.replace(':',' / '))}
  },{capture:true});
 });
}
new MutationObserver(wire).observe(document.body,{childList:true,subtree:true});
wire();
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
