import {createClient} from '@supabase/supabase-js';

const supabase=createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY);
const API=import.meta.env.VITE_API_URL||'http://localhost:3001';
const nativeFetch=window.fetch.bind(window);

async function getSession(){return(await supabase.auth.getSession()).data.session}
async function getActiveConversation(){
  const name=document.querySelector('.chat-head h2')?.textContent?.trim();
  if(!name)return null;
  const s=await getSession();
  if(!s)return null;
  const r=await nativeFetch(`${API}/api/conversations`,{headers:{Authorization:`Bearer ${s.access_token}`,'Content-Type':'application/json'}});
  const j=await r.json().catch(()=>({}));
  return (j.conversations||[]).find(c=>(c.other?.display_name||c.other?.username||c.title||'Conversation')===name)||null;
}
async function sendMyInstantsSound(btn){
  const url=btn.dataset.mp3;
  if(!url)throw Error('This sound has no playable MP3 URL.');
  const c=await getActiveConversation();
  if(!c)throw Error('Open a direct chat first.');
  const s=await getSession();
  if(!s)throw Error('Your session has expired. Please sign in again.');
  const r=await nativeFetch(`${API}/api/conversations/${c.id}/messages`,{
    method:'POST',
    headers:{Authorization:`Bearer ${s.access_token}`,'Content-Type':'application/json'},
    body:JSON.stringify({
      type:'sound',
      body:null,
      payload:{name:btn.dataset.title||'MyInstants sound',mime:'audio/mpeg',url,myinstants:true}
    })
  });
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(j.error||`Request failed (${r.status})`);
}
window.fetch=async(input,init={})=>{
  try{
    const raw=typeof input==='string'?input:input?.url;
    if(raw?.startsWith('https://myinstants-api.vercel.app/search')){
      const src=new URL(raw),proxy=new URL(`${API}/api/myinstants/search`);
      src.searchParams.forEach((value,key)=>proxy.searchParams.set(key,value));
      const s=await getSession();
      if(s){
        const headers=new Headers(init.headers||{});
        if(!headers.has('Authorization'))headers.set('Authorization',`Bearer ${s.access_token}`);
        if(!headers.has('Content-Type'))headers.set('Content-Type','application/json');
        return nativeFetch(proxy.toString(),{...init,headers});
      }
      return nativeFetch(proxy.toString(),init);
    }
  }catch(e){console.warn('MyInstants fetch proxy failed:',e)}
  return nativeFetch(input,init);
};

document.addEventListener('click',async e=>{
  const btn=e.target.closest?.('button');
  if(!btn)return;
  if(btn.closest('.gif-grid')){
    const oldTitle=btn.getAttribute('title');
    const hadTitle=btn.hasAttribute('title');
    btn.setAttribute('title','files');
    setTimeout(()=>{
      if(hadTitle)btn.setAttribute('title',oldTitle||'');
      else btn.removeAttribute('title');
    },0);
    return;
  }
  if(btn.closest('.fx-panel')&&btn.dataset.mp3){
    e.preventDefault();
    e.stopImmediatePropagation();
    try{await sendMyInstantsSound(btn);btn.closest('.fx-panel')?.remove()}catch(err){alert(err.message)}
  }
},true);
