/* FROSTLINK mobile navigation. UI-only: does not touch sockets, messages, or send logic. */
(function(){
  const MOBILE='(max-width:760px)';
  const isMobile=()=>window.matchMedia(MOBILE).matches;

  function ensureButton(parent,selector,props){
    let el=parent.querySelector(selector);
    if(!el){
      el=document.createElement('button');
      el.type='button';
      Object.entries(props).forEach(([k,v])=>{
        if(k==='dataset')Object.assign(el.dataset,v);
        else if(k==='className')el.className=v;
        else if(k==='textContent')el.textContent=v;
        else if(k==='ariaLabel')el.setAttribute('aria-label',v);
        else if(k==='title')el.title=v;
      });
      parent.appendChild(el);
    }
    return el;
  }

  function setup(){
    const workspace=document.querySelector('.workspace');
    const sidebar=workspace?.querySelector('.sidebar');
    const chat=workspace?.querySelector('.chat');
    if(!workspace||!sidebar||!chat)return;

    const sideHead=sidebar.querySelector('.side-head');
    const chatHead=chat.querySelector('.chat-head');
    if(!sideHead||!chatHead)return;

    const menu=ensureButton(chatHead,'[data-mobile-chat-menu]',{
      dataset:{mobileChatMenu:'1'},className:'mobile-chat-menu',ariaLabel:'Open chats',title:'Open chats',textContent:'☰'
    });
    const back=ensureButton(chatHead,'[data-mobile-chat-back]',{
      dataset:{mobileChatBack:'1'},className:'mobile-chat-back',ariaLabel:'Back to chats',title:'Back to chats',textContent:'‹'
    });
    const close=ensureButton(sideHead,'[data-mobile-sidebar-close]',{
      dataset:{mobileSidebarClose:'1'},className:'mobile-sidebar-close',ariaLabel:'Close chats',title:'Close chats',textContent:'‹'
    });

    let shade=workspace.querySelector('[data-mobile-sidebar-shade]');
    if(!shade){
      shade=document.createElement('button');
      shade.type='button';
      shade.dataset.mobileSidebarShade='1';
      shade.className='mobile-sidebar-shade';
      shade.setAttribute('aria-label','Close chat list');
      workspace.appendChild(shade);
    }

    const sync=()=>{
      const mobile=isMobile();
      const open=mobile&&workspace.classList.contains('mobile-sidebar-open');
      if(!mobile)workspace.classList.remove('mobile-sidebar-open');
      menu.hidden=!mobile||open;
      back.hidden=!mobile||!open;
      close.hidden=!mobile||!open;
      shade.hidden=!mobile||!open;
      sidebar.setAttribute('aria-hidden',mobile&&!open?'true':'false');
    };

    const setOpen=open=>{
      if(!isMobile()){
        workspace.classList.remove('mobile-sidebar-open');
        sync();
        return;
      }
      workspace.classList.toggle('mobile-sidebar-open',!!open);
      try{sessionStorage.setItem('frostlink-mobile-sidebar-open',open?'1':'0')}catch{}
      sync();
    };

    if(!workspace.dataset.mobileDelegated){
      workspace.dataset.mobileDelegated='1';
      workspace.addEventListener('click',e=>{
        const target=e.target;
        if(target.closest('[data-mobile-chat-menu]')){
          e.preventDefault();e.stopPropagation();setOpen(true);return;
        }
        if(target.closest('[data-mobile-chat-back]')||target.closest('[data-mobile-sidebar-close]')||target.closest('[data-mobile-sidebar-shade]')){
          e.preventDefault();e.stopPropagation();setOpen(false);return;
        }
        const conversation=target.closest('.conversation');
        if(conversation&&sidebar.contains(conversation)&&isMobile())requestAnimationFrame(()=>setOpen(false));
      },true);
    }

    if(!window.__frostlinkMobileResizeBound){
      window.__frostlinkMobileResizeBound=true;
      window.addEventListener('resize',()=>setup(),{passive:true});
    }

    if(!window.__frostlinkMobileEscapeBound){
      window.__frostlinkMobileEscapeBound=true;
      document.addEventListener('keydown',e=>{
        if(e.key!=='Escape'||!isMobile())return;
        const ws=document.querySelector('.workspace');
        if(ws?.classList.contains('mobile-sidebar-open')){
          e.preventDefault();
          ws.classList.remove('mobile-sidebar-open');
          try{sessionStorage.setItem('frostlink-mobile-sidebar-open','0')}catch{}
          setup();
        }
      });
    }

    let saved='0';
    try{saved=sessionStorage.getItem('frostlink-mobile-sidebar-open')||'0'}catch{}
    if(isMobile()&&saved==='1')workspace.classList.add('mobile-sidebar-open');
    else if(isMobile())workspace.classList.remove('mobile-sidebar-open');
    sync();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
  new MutationObserver(setup).observe(document.documentElement,{childList:true,subtree:true});
})();
