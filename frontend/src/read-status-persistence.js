import {createClient} from '@supabase/supabase-js';
import {io} from 'socket.io-client';

const supabase=createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY);
const API=import.meta.env.VITE_API_URL||'http://localhost:3001';
let currentConversationId=null,busy=false,lastUsername='',socket=null,open=true,markTimer=null,lastMarkedConversation=null;

async function token(){try{const{data}=await supabase.auth.getSession();return data.session?.access_token||''}catch{return ''}}
async function api(path,opt={}){const t=await token();return fetch(API+path,{...opt,headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json',...(opt.headers||{})}})}
function username(){return String(document.querySelector('.chat-head small')?.textContent||'').trim().replace(/^@/,'')}
function messagesEl(){return document.querySelector('.messages')}
function nearBottom(){const e=messagesEl();return !!e&&(e.scrollHeight-e.scrollTop-e.clientHeight<180)}
function applyRead(messageIds){const ids=new Set((messageIds||[]).map(String));document.querySelectorAll('.messages .msg.mine[data-message-id]').forEach(el=>{if(!ids.has(String(el.dataset.messageId)))return;let s=el.querySelector('.frost-read-status');if(!s){s=document.createElement('span');s.className='frost-read-status';(el.querySelector('.meta')||el).appendChild(s)}s.textContent='✓✓';s.title='Read';s.classList.add('read')})}
function applyRealtimeRead(p){if(!p?.message_id)return;applyRead([p.message_id])}
async function findConversation(){const name=username();if(!name)return null;try{const r=await api('/api/conversations');const j=await r.json().catch(()=>({}));return(j.conversations||[]).find(x=>x.other?.username===name)||null}catch{return null}}
async function sync(){if(busy)return;const name=username();if(!name){currentConversationId=null;open=false;return}open=true;if(name===lastUsername&&currentConversationId)return;busy=true;lastUsername=name;try{const c=await findConversation();if(!c){currentConversationId=null;return}currentConversationId=c.id;lastMarkedConversation=null;await syncStatusForCurrent();scheduleReadCheck()}finally{busy=false}}
async function syncStatusForCurrent(){if(!currentConversationId)return;try{const r=await api(`/api/messages/read-status?conversation_id=${encodeURIComponent(currentConversationId)}`);const data=await r.json().catch(()=>({}));if(r.ok)applyRead(data.message_ids||[])}catch{}}
function markVisibleIncomingRead(){if(!open||!currentConversationId||!nearBottom())return;const e=messagesEl();if(!e)return;const ids=[];e.querySelectorAll('.msg:not(.mine)[data-message-id]').forEach(el=>{if(el.dataset.messageId)ids.push(el.dataset.messageId)});if(!ids.length)return;if(lastMarkedConversation===currentConversationId)return;lastMarkedConversation=currentConversationId;for(const id of ids){try{socket?.emit('message:read',{message_id:id},result=>{if(result?.ok)applyRead([id])})}catch{}}}
function scheduleReadCheck(){clearTimeout(markTimer);markTimer=setTimeout(markVisibleIncomingRead,120)}
function attachScroll(){const e=messagesEl();if(!e||e.__frostReadBound)return;e.__frostReadBound=true;e.addEventListener('scroll',()=>{lastMarkedConversation=null;scheduleReadCheck()},{passive:true});scheduleReadCheck()}
function detectClosed(){const hasChat=!!document.querySelector('.chat-head');if(!hasChat){open=false;currentConversationId=null;lastUsername='';lastMarkedConversation=null;clearTimeout(markTimer);return}open=true;attachScroll();scheduleReadCheck()}
function connectSocket(){token().then(t=>{if(!t)return;socket=io(API,{auth:{accessToken:t},transports:['websocket','polling'],reconnection:true,reconnectionAttempts:Infinity,reconnectionDelay:500,reconnectionDelayMax:4000});socket.on('message:read',applyRealtimeRead);socket.on('connect',()=>{if(currentConversationId)socket.emit('join-conversation',currentConversationId)});socket.on('disconnect',()=>{});})}
function boot(){const obs=new MutationObserver(()=>{detectClosed();clearTimeout(window.__frostReadPersistenceTimer);window.__frostReadPersistenceTimer=setTimeout(()=>{sync();syncStatusForCurrent();scheduleReadCheck()},100)});obs.observe(document.body,{childList:true,subtree:true});setInterval(()=>{detectClosed();sync();syncStatusForCurrent();scheduleReadCheck()},3000);document.addEventListener('visibilitychange',()=>{/* intentionally do not mark messages read on tab return */});connectSocket();detectClosed();sync()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
