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
    if(!menu){menu=document.createElement('button');menu.type='button';menu.dataset.mobileChatMenu='1';menu.className='mobile-chat-menu';menu.setAttribute('aria-label','Open chats');menu.title='Open chats';menu.textContent='☰';chatHead.prepend(menu)}
    let back=chatHead.querySelector('[data-mobile-chat-back]');
    if(!back){back=document.createElement('button');back.type='button';back.dataset.mobileChatBack='1';back.className='mobile-chat-back';back.setAttribute('aria-label','Back to chats');back.title='Back to chats';back.textContent='‹';chatHead.prepend(back)}
    let close=sideHead.querySelector('[data-mobile-sidebar-close]');
    if(!close){close=document.createElement('button');close.type='button';close.dataset.mobileSidebarClose='1';close.className='mobile-sidebar-close';close.setAttribute('aria-label','Close chats');close.title='Close chats';close.textContent='‹';sideHead.appendChild(close)}
    let shade=workspace.querySelector('[data-mobile-sidebar-shade]');
    if(!shade){shade=document.createElement('button');shade.type='button';shade.dataset.mobileSidebarShade='1';shade.className='mobile-sidebar-shade';shade.setAttribute('aria-label','Close chat list');workspace.appendChild(shade)}

    const sync=()=>{const mobile=isMobile(),open=workspace.classList.contains('mobile-sidebar-open');menu.hidden=!mobile||open;back.hidden=!mobile||!open;close.hidden=!mobile||!open;shade.hidden=!mobile||!open;sidebar.setAttribute('aria-hidden',mobile&&!open?'true':'false')};
    const setOpen=open=>{if(!isMobile()){workspace.classList.remove('mobile-sidebar-open');sync();return}workspace.classList.toggle('mobile-sidebar-open',!!open);try{sessionStorage.setItem('frostlink-mobile-sidebar-open',open?'1':'0')}catch{}sync()};

    /* Delegate from the stable workspace so React can freely rerender/replace the header buttons. */
    if(!workspace.dataset.mobileDelegated){
      workspace.dataset.mobileDelegated='1';
      workspace.addEventListener('click',e=>{
        if(e.target.closest('[data-mobile-chat-menu]')){e.preventDefault();e.stopPropagation();setOpen(true);return}
        if(e.target.closest('[data-mobile-chat-back]')||e.target.closest('[data-mobile-sidebar-close]')||e.target.closest('[data-mobile-sidebar-shade]')){e.preventDefault();e.stopPropagation();setOpen(false);return}
        const conversation=e.target.closest('.conversation');
        if(conversation&&sidebar.contains(conversation)&&isMobile())requestAnimationFrame(()=>requestAnimationFrame(()=>setOpen(false)));
      });
      window.addEventListener('resize',sync,{passive:true});
    }
    let saved='0';try{saved=sessionStorage.getItem('frostlink-mobile-sidebar-open')||'0'}catch{}
    if(isMobile()&&saved==='1')workspace.classList.add('mobile-sidebar-open');
    sync();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
  new MutationObserver(setup).observe(document.documentElement,{childList:true,subtree:true});
})();
