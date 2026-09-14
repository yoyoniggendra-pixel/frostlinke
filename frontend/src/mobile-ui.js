/* FROSTLINK mobile navigation layer. UI-only: does not touch sockets, messages, or send logic. */
(function(){
const M='(max-width: 760px)',mobile=()=>matchMedia(M).matches;
function setup(){
 const w=document.querySelector('.workspace'),s=document.querySelector('.sidebar'),c=document.querySelector('.chat');
 if(!w||!s||!c)return;
 const sh=s.querySelector('.side-head'),ch=c.querySelector('.chat-head');if(!sh||!ch)return;
 let menu=ch.querySelector('[data-mobile-chat-menu]'),back=ch.querySelector('[data-mobile-chat-back]'),close=sh.querySelector('[data-mobile-sidebar-close]');
 const make=(cls,text,label)=>{const b=document.createElement('button');b.type='button';b.className=cls;b.textContent=text;b.setAttribute('aria-label',label);b.title=label;return b};
 if(!menu){menu=make('mobile-chat-menu','☰','Open chats');menu.dataset.mobileChatMenu='1';ch.prepend(menu)}
 if(!back){back=make('mobile-chat-back','‹','Back to chats');back.dataset.mobileChatBack='1';ch.prepend(back)}
 if(!close){close=make('mobile-sidebar-close','‹','Close chats');close.dataset.mobileSidebarClose='1';sh.appendChild(close)}
 const open=()=>{if(mobile()){w.classList.remove('mobile-chat-open');sessionStorage.removeItem('frostlink-mobile-chat-open')}sync()};
 const hide=()=>{if(mobile()){w.classList.add('mobile-chat-open');sessionStorage.setItem('frostlink-mobile-chat-open','1')}sync()};
 const sync=()=>{const m=mobile(),o=w.classList.contains('mobile-chat-open');menu.hidden=!m||o;back.hidden=!m||!o;close.hidden=!m||o;s.style.pointerEvents=m&&o?'none':'auto';menu.style.pointerEvents='auto';back.style.pointerEvents='auto';close.style.pointerEvents='auto'};
 if(!w.dataset.mobileBound){
  w.dataset.mobileBound='1';
  menu.addEventListener('click',open);back.addEventListener('click',open);close.addEventListener('click',open);
  s.addEventListener('click',e=>{if(e.target.closest('.conversation')&&mobile())requestAnimationFrame(()=>requestAnimationFrame(hide))});
  window.addEventListener('resize',sync,{passive:true});
 }
 if(mobile()&&document.querySelector('.conversation.active'))w.classList.add('mobile-chat-open');
 sync();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
new MutationObserver(setup).observe(document.documentElement,{childList:true,subtree:true});
})();
