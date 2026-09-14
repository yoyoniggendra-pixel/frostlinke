function normalizeYouTubeFrame(iframe){
  if(!iframe)return;
  const original=iframe.dataset.frostOriginalSrc||iframe.getAttribute('src')||'';
  if(!original||original==='about:blank')return;
  try{
    const u=new URL(original,window.location.origin);
    const host=u.hostname.toLowerCase().replace(/^www\./,'');
    if(host==='youtube.com'||host==='m.youtube.com'||host==='youtu.be'||host==='youtube-nocookie.com'){
      let id='';
      if(host==='youtu.be')id=u.pathname.split('/').filter(Boolean)[0]||'';
      else if(u.pathname==='/watch')id=u.searchParams.get('v')||'';
      else {const parts=u.pathname.split('/').filter(Boolean);if(parts[0]==='shorts'||parts[0]==='embed')id=parts[1]||'';}
      if(id){
        const player=new URL(`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`);
        player.searchParams.set('rel','0');
        player.searchParams.set('modestbranding','1');
        player.searchParams.set('playsinline','1');
        iframe.src=player.toString();
      }
    }else if(iframe.src==='about:blank')iframe.src=original;
    iframe.style.opacity='1';
    iframe.style.pointerEvents='auto';
  }catch{}
}

function activateDirectPlayers(root=document){
  root.querySelectorAll?.('.embed-shell iframe.embed,.embed-popout-frame iframe.embed').forEach(iframe=>{
    const preview=iframe.closest('.embed-shell,.embed-popout-frame')?.querySelector('.frost-embed-preview');
    if(preview)preview.remove();
    normalizeYouTubeFrame(iframe);
  });
}

activateDirectPlayers();
new MutationObserver(()=>activateDirectPlayers()).observe(document.documentElement,{subtree:true,childList:true});
