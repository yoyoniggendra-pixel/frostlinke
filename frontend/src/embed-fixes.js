const DEFAULT_RATIO='9:16';
let selectedRatio=DEFAULT_RATIO;
const style=document.createElement('style');
style.textContent=`
/* Embeds are intentionally simple: no ratio chooser, no layout controls. */
.embed-ratios{display:none!important}
.embed-shell{display:block!important;position:relative!important;width:min(100%,420px)!important;max-width:100%!important;height:min(746px,calc(100vh - 180px))!important;min-height:480px!important;aspect-ratio:9 / 16!important;margin:10px auto!important;overflow:hidden!important;border:1px solid #52c7ea2e!important;border-radius:13px!important;background:#000!important}
.embed-shell .embed{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;display:block!important;border:0!important}
.embed-actions{z-index:5!important;opacity:1!important;pointer-events:auto!important}
.embed-popout{left:14px!important;bottom:14px!important;width:min(672px,calc(100vw - 28px))!important;z-index:200!important}
.embed-popout-frame{width:min(100%,420px)!important;height:min(746px,70vh)!important;max-height:70vh!important;aspect-ratio:9 / 16!important;margin:0 auto!important;overflow:hidden!important;border-radius:10px!important;background:#000!important}
.embed-popout-frame .embed{width:100%!important;height:100%!important;display:block!important}
@media(max-width:600px){
 .embed-shell{width:min(100%,calc(100vw - 40px))!important;height:min(calc((100vw - 40px) * 1.7778),calc(100vh - 150px))!important;min-height:0!important;aspect-ratio:9 / 16!important}
 .embed-popout{left:8px!important;bottom:8px!important;width:calc(100vw - 16px)!important}
 .embed-popout-frame{width:min(100%,calc(100vw - 32px))!important;height:min(calc((100vw - 32px) * 1.7778),62vh)!important;max-height:62vh!important;aspect-ratio:9 / 16!important}
}
`;
document.head.appendChild(style);

/* Keep the outgoing payload deterministic even though the UI no longer exposes ratio controls. */
const originalFetch=window.fetch.bind(window);
window.fetch=async(input,init={})=>{
 try{
  const url=typeof input==='string'?input:(input?.url||'');
  if(url.includes('/api/conversations/')&&url.endsWith('/messages')&&init?.method?.toUpperCase()==='POST'&&typeof init.body==='string'){
   const body=JSON.parse(init.body);
   if(body?.type==='embed'&&body.payload&&typeof body.payload==='object'){
    body.payload={...body.payload,aspectRatio:DEFAULT_RATIO};
    init={...init,body:JSON.stringify(body)};
   }
  }
 }catch{}
 return originalFetch(input,init);
};
