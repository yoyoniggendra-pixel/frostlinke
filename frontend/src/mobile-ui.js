/* FROSTLINK mobile navigation layer. UI-only: does not touch sockets, messages, or send logic. */
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

    let menu=chat.querySelector('[data-mobile-chat-menu]');
    if(!menu){
      menu=document.createElement('button');
      menu.type='button';
      menu.dataset.mobileChatMenu='1';
      menu.setAttribute('aria-label','Open chats');
      menu.title='Open chats';
      menu.textContent='☰';
      Object.assign(menu.style,{display:'none',width:'34px',height:'34px',borderRadius:'10px',fontSize:'18px',lineHeight:'1',flex:'none',color:'#9edff0',background:'#03192366'});
      chatHead.prepend(menu);
    }

    let back=chat.querySelector('[data-mobile-chat-back]');
    if(!back){
      back=document.createElement('button');
      back.type='button';
      back.dataset.mobileChatBack='1';
      back.setAttribute('aria-label','Back to chats');
      back.title='Back to chats';
      back.textContent='‹';
      Object.assign(back.style,{display:'none',width:'34px',height:'34px',borderRadius:'10px',fontSize:'25px',lineHeight:'1',flex:'none',color:'#9edff0',background:'#03192366'});
      chatHead.prepend(back);
    }

    let close=sideHead.querySelector('[data-mobile-sidebar-close]');
    if(!close){
      close=document.createElement('button');
      close.type='button';
      close.dataset.mobileSidebarClose='1';
      close.setAttribute('aria-label','Close chats');
      close.title='Close chats';
      close.textContent='‹';
      Object.assign(close.style,{display:'none',width:'34px',height:'34px',borderRadius:'10px',fontSize:'25px',lineHeight:'1',flex:'none',color:'#9edff0',background:'#03192366'});
      sideHead.appendChild(close);
    }

    const openChats=()=>{workspace.classList.remove('mobile-chat-open');sessionStorage.removeItem('frostlink-mobile-chat-open');sync()};
    const openChat=()=>{workspace.classList.add('mobile-chat-open');sessionStorage.setItem('frostlink-mobile-chat-open','1');sync()};
    const sync=()=>{
      const mobile=isMobile();
      const chatOpen=workspace.classList.contains('mobile-chat-open');
      menu.style.display=mobile&&!chatOpen?'grid':'none';
      back.style.display=mobile&&chatOpen?'grid':'none';
      close.style.display=mobile&&!chatOpen?'grid':'none';
      menu.setAttribute('aria-hidden',mobile&&chatOpen?'true':'false');
    };

    if(!workspace.dataset.mobileBound){
      workspace.dataset.mobileBound='1';
      menu.addEventListener('click',openChats);
      back.addEventListener('click',openChats);
      close.addEventListener('click',openChats);
      sidebar.addEventListener('click',e=>{
        if(e.target.closest('.conversation'))setTimeout(openChat,0);
      });
      window.addEventListener('resize',sync,{passive:true});
      if(isMobile()&&sessionStorage.getItem('frostlink-mobile-chat-open')==='1')workspace.classList.add('mobile-chat-open');
    }
    sync();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
  new MutationObserver(setup).observe(document.documentElement,{childList:true,subtree:true});
})();
