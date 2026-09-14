const DEFAULT_RATIO='9:16';
const style=document.createElement('style');
style.textContent=`
.embed-ratios{display:none!important}
.embed-shell{display:block!important;position:relative!important;width:min(100%,420px)!important;max-width:100%!important;height:min(746px,calc(100vh - 180px))!important;min-height:480px!important;aspect-ratio:9 / 16!important;margin:10px auto!important;overflow:hidden!important;border:1px solid #52c7ea2e!important;border-radius:13px!important;background:#000!important}
.embed-shell .embed{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;display:block!important;border:0!important;opacity:1!important;pointer-events:auto!important}
.embed-actions{z-index:5!important;opacity:1!important;pointer-events:auto!important}
.embed-popout{left:14px!important;bottom:14px!important;width:min(672px,calc(100vw - 28px))!important;z-index:200!important}
.embed-popout-frame{width:min(100%,420px)!important;height:min(746px,70vh)!important;max-height:70vh!important;aspect-ratio:9 / 16!important;margin:0 auto!important;overflow:hidden!important;border-radius:10px!important;background:#000!important;position:relative!important}
.embed-popout-frame .embed{width:100%!important;height:100%!important;display:block!important;opacity:1!important;pointer-events:auto!important}
@media(max-width:600px){.embed-shell{width:min(100%,calc(100vw - 40px))!important;height:min(calc((100vw - 40px) * 1.7778),calc(100vh - 150px))!important;min-height:0!important;aspect-ratio:9 / 16!important}.embed-popout{left:8px!important;bottom:8px!important;width:calc(100vw - 16px)!important}.embed-popout-frame{width:min(100%,calc(100vw - 32px))!important;height:min(calc((100vw - 32px) * 1.7778),62vh)!important;max-height:62vh!important;aspect-ratio:9 / 16!important}}
`;
document.head.appendChild(style);

function parseEmbedLocally(input){
 const raw=String(input||'').trim();
 const iframe=raw.match(/<iframe[\s\S]*?<\/iframe>/i)?.[0];
 if(iframe){
  const src=iframe.match(/src=["']([^"']+)["']/i)?.[1];
  if(!src||!/^https?:\/\//i.test(src))throw Error('Iframe has no safe source');
  return{type:'embed',provider:'custom',url:src,embedUrl:src,html:iframe,sandbox:true};
 }
 const u=new URL(raw);
 if(!['http:','https:'].includes(u.protocol))throw Error('Unsupported URL');
 const host=u.hostname.toLowerCase().replace(/^www\./,'');
 if(host==='youtube.com'||host==='youtu.be'||host==='m.youtube.com'){
  let id=u.searchParams.get('v');
  if(host==='youtu.be')id=u.pathname.slice(1).split('/')[0];
  if(u.pathname.startsWith('/shorts/'))id=u.pathname.split('/')[2];
  if(!id)throw Error('Invalid YouTube URL');
  const encoded=encodeURIComponent(id);
  return{type:'embed',provider:'youtube',url:raw,embedUrl:`https://www.youtube-nocookie.com/embed/${encoded}?rel=0&modestbranding=1&playsinline=1`,thumbnail:`https://i.ytimg.com/vi/${encoded}/hqdefault.jpg`,title:'YouTube video'};
 }
 if(host==='vimeo.com')return{type:'embed',provider:'vimeo',url:raw,embedUrl:raw.replace(/^https:\/\/vimeo\.com\//,'https://player.vimeo.com/video/'),title:'Vimeo video'};
 if(host==='open.spotify.com')return{type:'embed',provider:'spotify',url:raw,embedUrl:raw.replace('/track/','/embed/track/').replace('/playlist/','/embed/playlist/'),title:'Spotify'};
 return{type:'embed',provider:'link',url:raw,embedUrl:null,title:'Link'};
}

const embedMetaCache=new Map();
function cacheEmbedMeta(embed){if(!embed?.url)return;[embed.url,embed.embedUrl].filter(Boolean).forEach(key=>embedMetaCache.set(key,embed));}

function normalizeEmbedIframe(iframe){
 if(!iframe)return;
 const raw=iframe.getAttribute('src')||iframe.src||'';
 if(!raw||raw==='about:blank')return;
 try{
  const u=new URL(raw,location.href);
  const host=u.hostname.toLowerCase().replace(/^www\./,'');
  let id='';
  if(host==='youtube.com'||host==='m.youtube.com'||host==='youtube-nocookie.com'){
   if(u.pathname==='/watch')id=u.searchParams.get('v')||'';
   else{const p=u.pathname.split('/').filter(Boolean);if(p[0]==='embed'||p[0]==='shorts')id=p[1]||'';}
   if(id){
    const desired=`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&modestbranding=1&playsinline=1`;
    if(iframe.src!==desired)iframe.src=desired;
   }
  }else if(host==='youtu.be'){
   id=u.pathname.split('/').filter(Boolean)[0]||'';
   if(id){
    const desired=`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&modestbranding=1&playsinline=1`;
    if(iframe.src!==desired)iframe.src=desired;
   }
  }
 }catch{}
 iframe.style.opacity='1';
 iframe.style.pointerEvents='auto';
}

function scanEmbeds(root=document){
 root.querySelectorAll?.('.embed-shell iframe.embed,.embed-popout-frame iframe.embed').forEach(normalizeEmbedIframe);
}

scanEmbeds();
new MutationObserver(mutations=>{
 for(const m of mutations){
  for(const node of m.addedNodes){if(node.nodeType===1)scanEmbeds(node);}
 }
}).observe(document.documentElement,{subtree:true,childList:true});

window.FROSTLINK_EMBED_HELPER={parseEmbedLocally,cacheEmbedMeta};
