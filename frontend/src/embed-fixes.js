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
.embed-popout-frame{width:min(100%,420px)!important;height:min(746px,70vh)!important;max-height:70vh!important;aspect-ratio:9 / 16!important;margin:0 auto!important;overflow:hidden!important;border-radius:10px!important;background:#000!important;position:relative!important}
.embed-popout-frame .embed{width:100%!important;height:100%!important;display:block!important}
.frost-embed-preview{position:absolute!important;inset:0!important;z-index:4!important;display:flex!important;flex-direction:column!important;justify-content:flex-end!important;overflow:hidden!important;border-radius:inherit!important;background:#111!important;cursor:pointer!important;color:#fff!important;text-align:left!important;border:0!important;padding:0!important;font:inherit!important}
.frost-embed-preview img{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;object-fit:cover!important;display:block!important}
.frost-embed-preview::after{content:'';position:absolute!important;inset:0!important;background:linear-gradient(180deg,transparent 35%,rgba(0,0,0,.78) 100%)!important;pointer-events:none!important}
.frost-embed-preview-copy{position:relative!important;z-index:2!important;padding:18px!important;display:flex!important;align-items:flex-end!important;justify-content:space-between!important;gap:12px!important}
.frost-embed-preview-title{font-weight:700!important;font-size:15px!important;line-height:1.25!important;text-shadow:0 1px 3px rgba(0,0,0,.7)!important}
.frost-embed-preview-provider{font-size:12px!important;opacity:.8!important;margin-top:4px!important}
.frost-embed-play{flex:0 0 auto!important;width:48px!important;height:48px!important;border-radius:50%!important;display:grid!important;place-items:center!important;background:rgba(255,255,255,.94)!important;color:#111!important;font-size:21px!important;box-shadow:0 6px 24px rgba(0,0,0,.35)!important}
.frost-embed-loading{position:absolute!important;inset:0!important;z-index:3!important;display:grid!important;place-items:center!important;background:#111!important;color:#fff!important;font-size:13px!important}
.embed-shell.frost-embed-loaded .frost-embed-preview,.embed-popout-frame.frost-embed-loaded .frost-embed-preview{display:none!important}
.embed-shell:not(.frost-embed-loaded) .embed,.embed-popout-frame:not(.frost-embed-loaded) .embed{opacity:0!important}
@media(max-width:600px){
 .embed-shell{width:min(100%,calc(100vw - 40px))!important;height:min(calc((100vw - 40px) * 1.7778),calc(100vh - 150px))!important;min-height:0!important;aspect-ratio:9 / 16!important}
 .embed-popout{left:8px!important;bottom:8px!important;width:calc(100vw - 16px)!important}
 .embed-popout-frame{width:min(100%,calc(100vw - 32px))!important;height:min(calc((100vw - 32px) * 1.7778),62vh)!important;max-height:62vh!important;aspect-ratio:9 / 16!important}
}
`;
document.head.appendChild(style);

/* Local first, universal fallback second. Unknown providers are resolved only once and cached. */
function parseEmbedLocally(input){
 const raw=String(input||'').trim();
 const iframe=raw.match(/<iframe[\s\S]*?<\/iframe>/i)?.[0];
 if(iframe){
  const src=iframe.match(/src=["']([^"']+)["']/i)?.[1];
  if(!src)throw Error('Iframe has no safe source');
  if(!/^https?:\/\//i.test(src))throw Error('Iframe has no safe source');
  return{type:'embed',provider:'custom',url:src,embedUrl:src,html:iframe,sandbox:true};
 }
 const u=new URL(raw);
 if(!['http:','https:'].includes(u.protocol))throw Error('Unsupported URL');
 const host=u.hostname.toLowerCase().replace(/^www\./,'');
 if(host==='youtube.com'||host==='youtu.be'||host==='m.youtube.com'){
  let id=u.searchParams.get('v');
  if(host==='youtu.be')id=u.pathname.slice(1);
  if(u.pathname.startsWith('/shorts/'))id=u.pathname.split('/')[2];
  if(!id)throw Error('Invalid YouTube URL');
  const encoded=encodeURIComponent(id);
  return{type:'embed',provider:'youtube',url:raw,embedUrl:`https://www.youtube.com/embed/${encoded}`,thumbnail:`https://i.ytimg.com/vi/${encoded}/hqdefault.jpg`,title:'YouTube video'};
 }
 if(host==='vimeo.com')return{type:'embed',provider:'vimeo',url:raw,embedUrl:raw.replace('https://vimeo.com/','https://player.vimeo.com/video/'),title:'Vimeo video'};
 if(host==='open.spotify.com')return{type:'embed',provider:'spotify',url:raw,embedUrl:raw.replace('/track/','/embed/track/').replace('/playlist/','/embed/playlist/'),title:'Spotify'};
 return{type:'embed',provider:'link',url:raw,embedUrl:null,title:'Link'};
}

const originalFetch=window.fetch.bind(window);
const embedMetaCache=new Map();
const embedResolveCache=new Map();
const EMBED_RESOLVE_TIMEOUT=5000;
function cacheEmbedMeta(embed){
 if(!embed?.url)return;
 const keys=[embed.url,embed.embedUrl].filter(Boolean);
 for(const key of keys)embedMetaCache.set(key,embed);
}
function extractIframeSrc(html){
 const src=String(html||'').match(/<iframe[\s\S]*?src=["']([^"']+)["'][\s\S]*?>/i)?.[1];
 return src&&/^https?:\/\//i.test(src)?src:'';
}
function providerFromName(name){
 const n=String(name||'').toLowerCase();
 if(n.includes('youtube'))return'youtube';
 if(n.includes('vimeo'))return'vimeo';
 if(n.includes('spotify'))return'spotify';
 return 'custom';
}
async function resolveWithNoembed(embed){
 if(!embed?.url||embed.provider!=='link')return embed;
 const key=embed.url;
 const cached=embedResolveCache.get(key);
 if(cached)return cached;
 const promise=(async()=>{
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),EMBED_RESOLVE_TIMEOUT);
  try{
   const r=await originalFetch('https://noembed.com/embed?url='+encodeURIComponent(key),{headers:{Accept:'application/json'},signal:controller.signal});
   if(!r.ok)return embed;
   const data=await r.json();
   const src=extractIframeSrc(data.html);
   if(!src)return{...embed,title:data.title||embed.title,description:data.description||'',thumbnail:data.thumbnail_url||null,provider:'link'};
   const resolved={...embed,provider:providerFromName(data.provider_name),embedUrl:src,html:data.html,title:data.title||embed.title,description:data.description||'',thumbnail:data.thumbnail_url||null,sandbox:true};
   cacheEmbedMeta(resolved);
   return resolved;
  }catch{return embed}
  finally{clearTimeout(timer)}
 })();
 embedResolveCache.set(key,promise);
 return promise;
}
async function resolveEmbed(input){
 let embed;
 try{embed=parseEmbedLocally(input)}catch(e){throw e}
 cacheEmbedMeta(embed);
 return embed.provider==='link'?resolveWithNoembed(embed):embed;
}

function youtubeIdFromEmbed(src){
 const m=String(src||'').match(/youtube\.com\/embed\/([^?&#/]+)/i);
 return m?.[1]||'';
}
function makePreview(shell,iframe){
 if(!shell||!iframe||shell.dataset.frostPreviewReady==='1')return;
 const src=iframe.getAttribute('src')||iframe.src||'';
 if(!src||src==='about:blank'||iframe.dataset.frostLoaded==='1')return;
 shell.dataset.frostPreviewReady='1';
 const cached=embedMetaCache.get(src)||embedMetaCache.get(iframe.getAttribute('src')||'');
 const provider=cached?.provider&&cached.provider!=='link'?cached.provider:iframe.title==='youtube'||/youtube\.com\/embed\//i.test(src)?'youtube':/vimeo\.com\/video\//i.test(src)?'vimeo':/spotify\.com\/embed\//i.test(src)?'spotify':'custom';
 const card=document.createElement('button');
 card.type='button';
 card.className='frost-embed-preview';
 const copy=document.createElement('span');
 copy.className='frost-embed-preview-copy';
 const text=document.createElement('span');
 const title=document.createElement('span');
 title.className='frost-embed-preview-title';
 title.textContent=cached?.title|| (provider==='youtube'?'YouTube video':provider==='vimeo'?'Vimeo video':provider==='spotify'?'Spotify':'Embedded content');
 const label=document.createElement('span');
 label.className='frost-embed-preview-provider';
 label.textContent=provider==='youtube'?'Video preview':provider==='vimeo'?'Video preview':provider==='spotify'?'Media preview':cached?.provider==='custom'?'Rich preview':'Link preview';
 text.append(title,label);
 const play=document.createElement('span');
 play.className='frost-embed-play';
 play.textContent='▶';
 copy.append(text,play);
 const thumbnail=cached?.thumbnail||(provider==='youtube'?(()=>{const id=youtubeIdFromEmbed(src);return id?`https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`:''})():'');
 if(thumbnail){const img=document.createElement('img');img.src=thumbnail;img.alt='';img.loading='lazy';card.appendChild(img)}
 card.appendChild(copy);
 shell.appendChild(card);
 iframe.dataset.frostOriginalSrc=src;
 iframe.src='about:blank';
 card.addEventListener('click',async()=>{
  shell.classList.add('frost-embed-loaded');
  iframe.dataset.frostLoaded='1';
  iframe.style.opacity='1';
  iframe.src=iframe.dataset.frostOriginalSrc||src;
  card.remove();
 },{once:true});
 if(!cached&&provider==='custom'){
  const loading=resolveWithNoembed({type:'embed',provider:'link',url:src,embedUrl:src,title:'Embedded content'});
  loading.then(meta=>{if(meta&&meta!==embedMetaCache.get(src)){cacheEmbedMeta(meta);const current=card.isConnected; if(current){const cachedMeta=embedMetaCache.get(src);if(cachedMeta?.thumbnail&&!card.querySelector('img')){const img=document.createElement('img');img.src=cachedMeta.thumbnail;img.alt='';img.loading='lazy';card.prepend(img)}if(cachedMeta?.title)title.textContent=cachedMeta.title;label.textContent=cachedMeta?.provider==='custom'?'Rich preview':'Media preview'}}}});
 }
}
function scanEmbeds(root=document){
 root.querySelectorAll?.('.embed-shell,.embed-popout-frame').forEach(shell=>makePreview(shell,shell.querySelector('iframe.embed')));
}
scanEmbeds();
new MutationObserver(mutations=>{for(const m of mutations){for(const node of m.addedNodes){if(node.nodeType===1){scanEmbeds(node);if(node.matches?.('.embed-shell,.embed-popout-frame'))makePreview(node,node.querySelector('iframe.embed'))}}}}).observe(document.documentElement,{subtree:true,childList:true});

window.fetch=async(input,init={})=>{
 try{
  const url=typeof input==='string'?input:(input?.url||'');
  const method=init?.method?.toUpperCase()||'GET';
  if(url.endsWith('/api/embeds/parse')&&method==='POST'&&typeof init.body==='string'){
   const body=JSON.parse(init.body);
   const embed=await resolveEmbed(body?.input);
   return new Response(JSON.stringify({embed}),{status:200,headers:{'Content-Type':'application/json'}});
  }
  if(url.includes('/api/conversations/')&&url.endsWith('/messages')&&method==='POST'&&typeof init.body==='string'){
   const body=JSON.parse(init.body);
   if(body?.type==='embed'&&body.payload&&typeof body.payload==='object'){
    body.payload={...body.payload,aspectRatio:DEFAULT_RATIO};
    init={...init,body:JSON.stringify(body)};
   }
  }
 }catch(e){
  const url=typeof input==='string'?input:(input?.url||'');
  if(url.endsWith('/api/embeds/parse'))return new Response(JSON.stringify({error:e.message||'Invalid embed'}),{status:400,headers:{'Content-Type':'application/json'}});
 }
 return originalFetch(input,init);
};
