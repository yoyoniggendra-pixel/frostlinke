import { createClient } from '@supabase/supabase-js';
import { io } from 'socket.io-client';

const supabase=createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY);
let installed=false;
let realtimeSocket=null;
let conversations=[];
let activeConversationId=null;
let currentUserId=null;
let typingTimer=null;
let typingActive=false;
let videoAsFile=false;
const API=import.meta.env.VITE_API_URL||'http://localhost:3001';

async function token(){try{const {data}=await supabase.auth.getSession();currentUserId=data.session?.user?.id||null;return data.session?.access_token||''}catch{return ''}}
async function api(path,opt={}){const t=await token();return fetch(API+path,{...opt,headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json',...(opt.headers||{})}})}

async function loadConversations(){try{const r=await api('/api/conversations');const j=await r.json();conversations=j.conversations||[]}catch{conversations=[]}resolveActive()}
function resolveActive(){
  const small=document.querySelector('.chat-head small');
  const username=String(small?.textContent||'').trim().replace(/^@/,'');
  const c=conversations.find(x=>x.other?.username===username);
  if(c&&c.id!==activeConversationId){
    if(activeConversationId&&realtimeSocket)realtimeSocket.emit('leave-conversation',activeConversationId);
    activeConversationId=c.id;
    if(realtimeSocket?.connected)realtimeSocket.emit('join-conversation',c.id);
  }
}

function addTypingUi(){
  if(document.getElementById('frost-typing-indicator'))return;
  const chat=document.querySelector('.chat');if(!chat)return;
  const el=document.createElement('div');el.id='frost-typing-indicator';el.className='frost-typing-indicator';el.setAttribute('aria-live','polite');chat.appendChild(el);
  const style=document.createElement('style');style.textContent=`#frost-typing-indicator{position:absolute;left:18px;bottom:82px;z-index:8;min-height:20px;padding:5px 10px;border-radius:999px;background:rgba(8,16,30,.78);backdrop-filter:blur(10px);color:#bfe9ff;font-size:12px;pointer-events:none;opacity:0;transform:translateY(4px);transition:opacity .16s,transform .16s}.frost-typing-indicator.show{opacity:1;transform:none}.frost-read-status{margin-left:6px;font-size:11px;letter-spacing:.02em;color:#79b9ff}.frost-read-status.read{color:#56efbd}.frost-video-mode{display:inline-flex!important;align-items:center;justify-content:center;gap:4px;min-width:34px}.frost-video-mode.active{color:#56efbd!important}.frost-video-mode svg{display:none!important}`;document.head.appendChild(style)
}
function setTyping(text){const el=document.getElementById('frost-typing-indicator');if(!el)return;el.textContent=text||'';el.classList.toggle('show',Boolean(text))}

function installTyping(){
  const input=document.querySelector('.composer input,.composer textarea');if(!input||input.dataset.frostTyping)return;
  input.dataset.frostTyping='1';
  const emitStart=()=>{if(!activeConversationId||!realtimeSocket?.connected)return;if(!typingActive){typingActive=true;realtimeSocket.emit('typing:start',activeConversationId)}clearTimeout(typingTimer);typingTimer=setTimeout(emitStop,900)};
  const emitStop=()=>{clearTimeout(typingTimer);if(typingActive&&realtimeSocket?.connected)realtimeSocket.emit('typing:stop',activeConversationId);typingActive=false};
  input.addEventListener('input',()=>{if(!input.disabled)emitStart()});
  input.addEventListener('blur',emitStop);
  window.addEventListener('beforeunload',emitStop);
}

function addReadStatus(msgId,read=true){
  const el=document.querySelector(`.msg.mine[data-message-id="${CSS.escape(msgId)}"]`);if(!el)return;
  let status=el.querySelector('.frost-read-status');
  if(!status){status=document.createElement('span');status.className='frost-read-status';el.querySelector('.meta')?.appendChild(status)}
  status.textContent=read?'✓✓':'✓';status.title=read?'Read':'Sent';status.classList.toggle('read',read);
}
async function markIncomingRead(){
  if(!activeConversationId)return;
  const incoming=[...document.querySelectorAll(`.msg.theirs[data-message-id]`)];
  for(const el of incoming){const id=el.dataset.messageId;if(id&&!el.dataset.frostRead){el.dataset.frostRead='1';try{await api(`/api/messages/${encodeURIComponent(id)}/read`,{method:'POST',body:'{}'})}catch{}}}
}

function installMediaMode(){
  const btn=[...document.querySelectorAll('.composer button')].find(b=>b.getAttribute('title')==='Embed');
  if(btn&&!btn.dataset.frostMediaMode){
    btn.dataset.frostMediaMode='1';btn.classList.add('frost-video-mode');btn.setAttribute('title','Send video as a file');btn.setAttribute('aria-label','Send video as a file');btn.innerHTML='✓';
    btn.addEventListener('click',e=>{e.preventDefault();videoAsFile=!videoAsFile;window.__frostVideoAsFile=videoAsFile;btn.classList.toggle('active',videoAsFile);btn.setAttribute('aria-pressed',String(videoAsFile));btn.setAttribute('title',videoAsFile?'Video will send as a file':'Video will send as playable media')});
  }
}

function installFetchMode(){
  if(window.__frostFetchWrapped)return;window.__frostFetchWrapped=true;
  const nativeFetch=window.fetch.bind(window);
  window.fetch=async function(resource,options){
    const url=typeof resource==='string'?resource:resource?.url||'';
    if(window.__frostVideoAsFile&&/\/api\/conversations\/[^/]+\/messages$/.test(url)&&options?.method?.toUpperCase()==='POST'&&typeof options.body==='string'){
      try{const body=JSON.parse(options.body);if(body.type==='video'){body.type='file';body.payload={...(body.payload||{}),sendAsFile:true};options={...options,body:JSON.stringify(body)}}}catch{}
      window.__frostVideoAsFile=false;videoAsFile=false;
      const toggle=[...document.querySelectorAll('.composer button')].find(b=>b.dataset.frostMediaMode);toggle?.classList.remove('active');toggle?.setAttribute('aria-pressed','false');
    }
    return nativeFetch(resource,options)
  }
}

function installSocket(){
  if(realtimeSocket)return;
  token().then(t=>{if(!t)return;realtimeSocket=io(API,{auth:{accessToken:t},transports:['websocket','polling'],reconnection:true});
    realtimeSocket.auth.userId=currentUserId;
    realtimeSocket.on('connect',()=>{realtimeSocket.auth.userId=currentUserId;resolveActive();if(activeConversationId)realtimeSocket.emit('join-conversation',activeConversationId)});
    const handleTyping=x=>{if(x?.conversation_id===activeConversationId&&x.user_id!==currentUserId)setTyping(x.active?`${x.sender||'Someone'} is typing…`:'')};
    realtimeSocket.on('typing',handleTyping);
    realtimeSocket.on('typing:start',x=>handleTyping({...x,active:true}));
    realtimeSocket.on('typing:stop',x=>handleTyping({...x,active:false}));
    realtimeSocket.on('message:read',x=>{if(x?.message_id&&x.user_id!==currentUserId)addReadStatus(x.message_id,true)});
  }).catch(()=>{});
}

function persistTheme(){const app=document.querySelector('.app');if(!app)return;const saved=localStorage.getItem('frostlink-theme-bg');if(saved){app.classList.remove('bg-aurora','bg-midnight','bg-ice');app.classList.add('bg-'+saved)}if(installed)return;installed=true;new MutationObserver(()=>{const cls=[...app.classList].find(x=>x.startsWith('bg-'));if(cls)localStorage.setItem('frostlink-theme-bg',cls.slice(3))}).observe(app,{attributes:true,attributeFilter:['class']})}

function boot(){
  const wait=()=>{if(document.querySelector('.app')){persistTheme();addTypingUi();installSocket();installTyping();installMediaMode();installFetchMode();loadConversations();resolveActive();markIncomingRead()}else setTimeout(wait,250)};wait();
  const observer=new MutationObserver(()=>{addTypingUi();installTyping();installMediaMode();installFetchMode();resolveActive();markIncomingRead()});
  observer.observe(document.body,{childList:true,subtree:true});
}

boot();
