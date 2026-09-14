const DEFAULT_RATIO='9:16';
const style=document.createElement('style');
style.textContent=`
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
  return{type:'embed',provider:'youtube',url:raw,embedUrl:`https://www.youtube.com/embed/${encoded}`,thumbnail:`https://i.ytimg.com/vi/${encoded}/hqdefault.jpg`,title:'YouTube video'};
 }
 if(host==='vimeo.com')return{type:'embed',provider:'vimeo',url:raw,embedUrl:raw.replace(/^https:\/\/vimeo\.com\//,'https://player.vimeo.com/video/'),title:'Vimeo video'};
 if(host==='open.spotify.com')return{type:'embed',provider:'spotify',url:raw,embedUrl:raw.replace('/track/','/embed/track/').replace('/playlist/','/embed/playlist/'),title:'Spotify'};
 return{type:'embed',provider:'link',url:raw,embedUrl:null,title:'Link'};
}

const embedMetaCache=new Map();
function cacheEmbedMeta(embed){if(!embed?.url)return;[embed.url,embed.embedUrl].filter(Boolean).forEach(key=>embedMetaCache.set(key,embed));}
function youtubeIdFromEmbed(src){return String(src||'').match(/youtube\.com\/embed\/([^?&#/]+)/i)?.[1]||'';}
function makePreview(shell,iframe){
 if(!shell||!iframe||shell.dataset.frostPreviewReady==='1')return;
 const src=iframe.getAttribute('src')||iframe.src||'';
 if(!src||src==='about:blank'||iframe.dataset.frostLoaded==='1')return;
 shell.dataset.frostPreviewReady='1';
 const cached=embedMetaCache.get(src);
 const provider=cached?.provider&&cached.provider!=='link'?cached.provider:iframe.title==='youtube'||/youtube\.com\/embed\//i.test(src)?'youtube':/vimeo\.com\/video\//i.test(src)?'vimeo':/spotify\.com\/embed\//i.test(src)?'spotify':'custom';
 const card=document.createElement('button');
 card.type='button';card.className='frost-embed-preview';
 const copy=document.createElement('span');copy.className='frost-embed-preview-copy';
 const text=document.createElement('span');
 const title=document.createElement('span');title.className='frost-embed-preview-title';
 title.textContent=cached?.title||(provider==='youtube'?'YouTube video':provider==='vimeo'?'Vimeo video':provider==='spotify'?'Spotify':'Embedded content');
 const label=document.createElement('span');label.className='frost-embed-preview-provider';label.textContent=provider==='spotify'?'Media preview':'Video preview';
 text.append(title,label);
 const play=document.createElement('span');play.className='frost-embed-play';play.textContent='▶';copy.append(text,play);card.appendChild(copy);
 const thumbnail=cached?.thumbnail||(provider==='youtube'?(()=>{const id=youtubeIdFromEmbed(src);return id?`https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`:''})():'');
 if(thumbnail){const img=document.createElement('img');img.src=thumbnail;img.alt='';img.loading='lazy';card.insertBefore(img,copy);}
 shell.appendChild(card);
 iframe.dataset.frostOriginalSrc=src;iframe.src='about:blank';
 card.addEventListener('click',()=>{shell.classList.add('frost-embed-loaded');iframe.dataset.frostLoaded='1';iframe.style.opacity='1';iframe.src=iframe.dataset.frostOriginalSrc||src;card.remove();},{once:true});
}
function scanEmbeds(root=document){root.querySelectorAll?.('.embed-shell,.embed-popout-frame').forEach(shell=>makePreview(shell,shell.querySelector('iframe.embed')));}
scanEmbeds();
new MutationObserver(mutations=>{for(const m of mutations){for(const node of m.addedNodes){if(node.nodeType===1)scanEmbeds(node);}}}).observe(document.documentElement,{subtree:true,childList:true});

window.FROSTLINK_EMBED_HELPER={parseEmbedLocally,cacheEmbedMeta};
