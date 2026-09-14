/* FROSTLINK mobile navigation. UI-only: does not touch sockets, messages, or send logic. */
(function(){
  const MOBILE='(max-width: 760px)';
  const isMobile=()=>window.matchMedia(MOBILE).matches;

  function setup(){
    const workspace=document.querySelector('.workspace');
    const sidebar=document.querySelector('.sidebar');
    const chat=document.querySelector('.chat');
    if(!workspace||!sidebar||!chat)return;

    const sideHead=sidebar.querySelector('.side-head');
    const chatHead=chat.querySelector('.chat-head');
    if(!sideHead||!chatHead)return;

    let menu=chatHead.querySelector('[data-mobile-chat-menu]');
    if(!menu){
      menu=document.createElement('button');
      menu.type='button';
      menu.dataset.mobileChatMenu='1';
      menu.className='mobile-chat-menu';
      menu.setAttribute('aria-label','Open chats');
      menu.title='Open chats';
      menu.textContent='☰';
      chatHead.prepend(menu);
    }

    let back=chatHead.querySelector('[data-mobile-chat-back]');
    if(!back){
      back=document.createElement('button');
      back.type='button';
      back.dataset.mobileChatBack='1';
      back.className='mobile-chat-back';
      back.setAttribute('aria-label','Back to chats');
      back.title='Back to chats';
      back.textContent='‹';
      chatHead.prepend(back);
    }

    let close=sideHead.querySelector('[data-mobile-sidebar-close]');
    if(!close){
      close=document.createElement('button');
      close.type='button';
      close.dataset.mobileSidebarClose='1';
      close.className='mobile-sidebar-close';
      close.setAttribute('aria-label','Close chats');
      close.title='Close chats';
      close.textContent='‹';
      sideHead.appendChild(close);
    }

    let shade=workspace.querySelector('[data-mobile-sidebar-shade]');
    if(!shade){
      shade=document.createElement('button');
      shade.type='button';
      shade.dataset.mobileSidebarShade='1';
      shade.className='mobile-sidebar-shade';
      shade.setAttribute('aria-label','Close chat list');
      workspace.appendChild(shade);
    }

    const setOpen=(open)=>{
      if(!isMobile()){
        workspace.classList.remove('mobile-sidebar-open');
        return;
      }
      workspace.classList.toggle('mobile-sidebar-open',!!open);
      try{sessionStorage.setItem('frostlink-mobile-sidebar-open',open?'1':'0')}catch{}
      sync();
    };

    const sync=()=>{
      const mobile=isMobile();
      const open=workspace.classList.contains('mobile-sidebar-open');
      menu.hidden=!mobile||open;
      back.hidden=!mobile||!open;
      close.hidden=!mobile||!open;
      shade.hidden=!mobile||!open;
      sidebar.setAttribute('aria-hidden',mobile&&!open?'true':'false');
    };

    if(!workspace.dataset.mobileBound){
      workspace.dataset.mobileBound='1';

      menu.addEventListener('click',()=>setOpen(true));
      back.addEventListener('click',()=>setOpen(true));
      close.addEventListener('click',()=>setOpen(false));
      shade.addEventListener('click',()=>setOpen(false));

      sidebar.addEventListener('click',e=>{
        const conversation=e.target.closest('.conversation');
        if(!conversation||!isMobile())return;
        // Do not cancel React's conversation-selection click. Close only after
        // React has processed the selection so the new chat can render smoothly.
        requestAnimationFrame(()=>requestAnimationFrame(()=>setOpen(false)));
      });

      window.addEventListener('resize',sync,{passive:true});

      // Mobile starts with the chat list open. If a chat was already selected,
      // keep the chat visible after reload; the menu can reopen the list.
      let saved='0';
      try{saved=sessionStorage.getItem('frostlink-mobile-sidebar-open')||'0'}catch{}
      workspace.classList.toggle('mobile-sidebar-open',isMobile()&&saved==='1');
    }

    sync();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
  new MutationObserver(setup).observe(document.documentElement,{childList:true,subtree:true});
})();
