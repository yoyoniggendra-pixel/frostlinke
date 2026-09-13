import {createClient} from '@supabase/supabase-js';
import {io} from 'socket.io-client';

const supabase=createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY);
const API=import.meta.env.VITE_API_URL||'http://localhost:3001';

let socket=null;
let audio=null;
let current=null;
let muted=false;
let activeConversationId=null;
let connected=false;

const style=document.createElement('style');
style.textContent=`
.fx-sync-music{position:fixed;z-index:5000;left:50%;bottom:18px;transform:translateX(-50%);display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid #6bdcff35;border-radius:14px;background:#061522ee;box-shadow:0 12px 45px #0009;color:#eafaff;font:12px system-ui;backdrop-filter:blur(14px);max-width:min(520px,calc(100vw - 24px))}
.fx-sync-music .fx-sync-title{max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fx-sync-music button{border:1px solid #6bdcff30;background:#073246;color:#eafaff;border-radius:9px;padding:7px 9px;cursor:pointer}
.fx-sync-music button:hover{background:#0a4860}
.fx-sync-music .fx-sync-dot{width:7px;height:7px;border-radius:50%;background:#57e0a0;box-shadow:0 0 10px #57e0a0;flex:0 0 auto}
.fx-sync-music .fx-sync-muted{opacity:.65}
`;
document.head.appendChild(style);

const bar=document.createElement('div');
bar.className='fx-sync-music';
bar.innerHTML=`<span class="fx-sync-dot"></span><span class="fx-sync-title">No shared music</span><button class="fx-sync-toggle">Mute</button><button class="fx-sync-enable" hidden>Enable</button>`;
document.body.appendChild(bar);
const titleEl=bar.querySelector('.fx-sync-title');
const toggleEl=bar.querySelector('.fx-sync-toggle');
const enableEl=bar.querySelector('.fx-sync-enable');

function setTitle(text){titleEl.textContent=text}
function ensureAudio(){
  if(audio)return audio;
  audio=new Audio();
  audio.preload='auto';
  audio.addEventListener('ended',()=>{
    if(current?.repeat){
      audio.currentTime=0;
      if(!muted)audio.play().catch(()=>showEnable());
    }else if(current){
      current=null;
      setTitle('No shared music');
    }
  });
  return audio;
}
function showEnable(){enableEl.hidden=false}
function hideEnable(){enableEl.hidden=true}
function setMuted(value){
  muted=!!value;
  if(audio)audio.muted=muted;
  toggleEl.textContent=muted?'Unmute':'Mute';
  toggleEl.classList.toggle('fx-sync-muted',muted);
}
async function playCurrent(){
  if(!audio||!current)return;
  audio.muted=muted;
  try{await audio.play();hideEnable()}catch{showEnable()}
}
function stopLocal(){
  if(audio){audio.pause();audio.removeAttribute('src');audio.load()}
  current=null;
  hideEnable();
  setTitle('No shared music');
}
function applyStart(c){
  if(!c?.url||!c.conversation_id)return;
  const now=Date.now();
  const position=Math.max(0,Number(c.currentTime)||0)+Math.max(0,now-(Number(c.serverNow)||now))/1000;
  const same=current&&current.url===c.url&&current.conversationId===c.conversation_id;
  if(same){
    const drift=Math.abs((audio?.currentTime||0)-position);
    if(drift>.75&&audio)audio.currentTime=position;
    return;
  }
  const a=ensureAudio();
  current={conversationId:c.conversation_id,url:c.url,name:c.name||'Shared music',repeat:!!c.repeat};
  a.loop=false;
  a.src=c.url;
  a.currentTime=position;
  a.muted=muted;
  setTitle(`${current.name}${muted?' (muted)':''}`);
  playCurrent();
}
function applyStop(c){
  if(!current)return;
  if(!c?.conversation_id||current.conversationId===c.conversation_id)stopLocal();
}
async function connect(){
  const s=(await supabase.auth.getSession()).data.session;
  if(!s)return;
  if(socket){socket.disconnect();socket=null}
  socket=io(API,{auth:{accessToken:s.access_token},transports:['websocket','polling'],reconnection:true,reconnectionAttempts:Infinity,reconnectionDelay:500,reconnectionDelayMax:4000});
  socket.on('connect',()=>{connected=true;if(activeConversationId)socket.emit('join-conversation',activeConversationId)});
  socket.on('disconnect',()=>{connected=false});
  socket.on('music:sync',c=>{if(c?.action==='start')applyStart(c);else if(c?.action==='stop')applyStop(c)});
}
function detectConversation(){
  const el=document.querySelector('.conversation.active');
  const id=el?.dataset?.conversationId||el?.getAttribute('data-conversation-id')||null;
  return id;
}
async function discoverConversationByHeader(){
  const h=document.querySelector('.chat-head h2')?.textContent?.trim();
  if(!h)return null;
  try{
    const s=(await supabase.auth.getSession()).data.session;
    if(!s)return null;
    const r=await fetch(`${API}/api/conversations`,{headers:{Authorization:`Bearer ${s.access_token}`}});
    const j=await r.json();
    return (j.conversations||[]).find(c=>(c.other?.display_name||c.other?.username||c.title||'Conversation')===h)?.id||null;
  }catch{return null}
}
async function syncConversation(){
  let id=detectConversation();
  if(!id)id=await discoverConversationByHeader();
  if(id===activeConversationId)return;
  if(socket&&activeConversationId)socket.emit('leave-conversation',activeConversationId);
  activeConversationId=id;
  if(socket&&id)socket.emit('join-conversation',id);
}

toggleEl.onclick=()=>setMuted(!muted);
enableEl.onclick=()=>playCurrent();
setMuted(false);

supabase.auth.onAuthStateChange((event)=>{
  if(event==='SIGNED_OUT'){if(socket)socket.disconnect();socket=null;stopLocal();activeConversationId=null;return}
  if(event==='SIGNED_IN'||event==='TOKEN_REFRESHED')connect().catch(()=>{});
});

connect().catch(()=>{});
setInterval(()=>{if(connected)syncConversation().catch(()=>{})},500);
window.addEventListener('beforeunload',()=>socket?.disconnect());
