import {createClient} from '@supabase/supabase-js';

const supabase=createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY);
const API=import.meta.env.VITE_API_URL||'http://localhost:3001';
let currentConversationId=null,busy=false,lastUsername='';

async function token(){try{const{data}=await supabase.auth.getSession();return data.session?.access_token||''}catch{return ''}}
async function api(path){const t=await token();return fetch(API+path,{headers:{Authorization:`Bearer ${t}`}})}
function username(){return String(document.querySelector('.chat-head small')?.textContent||'').trim().replace(/^@/,'')}
function applyRead(messageIds){const ids=new Set((messageIds||[]).map(String));document.querySelectorAll('.messages .msg.mine[data-message-id]').forEach(el=>{if(!ids.has(String(el.dataset.messageId)))return;let s=el.querySelector('.frost-read-status');if(!s){s=document.createElement('span');s.className='frost-read-status';(el.querySelector('.meta')||el).appendChild(s)}s.textContent='✓✓';s.title='Read';s.classList.add('read')})}
async function sync(){if(busy)return;const name=username();if(!name)return;if(name===lastUsername&&currentConversationId)return;busy=true;lastUsername=name;try{const r=await api('/api/conversations');const j=await r.json().catch(()=>({}));const c=(j.conversations||[]).find(x=>x.other?.username===name);if(!c){currentConversationId=null;return}currentConversationId=c.id;const rs=await api(`/api/messages/read-status?conversation_id=${encodeURIComponent(c.id)}`);const data=await rs.json().catch(()=>({}));if(rs.ok)applyRead(data.message_ids||[])}catch{}finally{busy=false}}
function boot(){const obs=new MutationObserver(()=>{clearTimeout(window.__frostReadPersistenceTimer);window.__frostReadPersistenceTimer=setTimeout(()=>{sync();if(currentConversationId){const ids=[];document.querySelectorAll('.messages .msg.mine[data-message-id]').forEach(el=>ids.push(el.dataset.messageId));if(ids.length)syncStatusForCurrent() }},100)});obs.observe(document.body,{childList:true,subtree:true});setInterval(()=>{sync();syncStatusForCurrent()},3000);sync()}
async function syncStatusForCurrent(){if(!currentConversationId)return;try{const r=await api(`/api/messages/read-status?conversation_id=${encodeURIComponent(currentConversationId)}`);const data=await r.json().catch(()=>({}));if(r.ok)applyRead(data.message_ids||[])}catch{}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
