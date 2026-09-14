/* FROSTLINK mobile navigation layer. Does not touch sockets or message state. */
(function(){
  const MOBILE='(max-width: 760px)';
  function isMobile(){return window.matchMedia(MOBILE).matches}
  function setup(){
    const workspace=document.querySelector('.workspace');
    const sidebar=document.querySelector('.sidebar');
    const chat=document.querySelector('.chat');
    if(!workspace||!sidebar||!chat)return;
    let back=chat.querySelector('[data-mobile-chat-back]');
    if(!back){
      back=document.createElement('button'); back.type='button'; back.dataset.mobileChatBack='1'; back.setAttribute('aria-label','Back to chats'); back.title='Back to chats'; back.textContent='‹';
      Object.assign(back.style,{display:'none',width:'34px',height:'34px',borderRadius:'10px',fontSize:'25px',lineHeight:'1',flex:'none',color:'#9edff0',background:'#03192366'});
      const head=chat.querySelector('.chat-head'); if(head) head.prepend(back);
      back.addEventListener('click',()=>{workspace.classList.remove('mobile-chat-open');sessionStorage.removeItem('frostlink-mobile-chat-open');showState();});
    }
    function showState(){back.style.display=isMobile()&&workspace.classList.contains('mobile-chat-open')?'grid':'none'}
    if(!workspace.dataset.mobileBound){
      workspace.dataset.mobileBound='1';
      sidebar.addEventListener('click',e=>{
        if(e.target.closest('.conversation')){workspace.classList.add('mobile-chat-open');sessionStorage.setItem('frostlink-mobile-chat-open','1');setTimeout(showState,0)}
      });
      window.addEventListener('resize',showState,{passive:true});
    }
    showState();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
  new MutationObserver(setup).observe(document.documentElement,{childList:true,subtree:true});
})();
