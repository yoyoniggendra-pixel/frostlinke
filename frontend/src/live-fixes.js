import { createClient } from '@supabase/supabase-js';

const supabase=createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY);
let installed=false;
async function loadBg(){try{const r=indexedDB.open('frostlink-local',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('kv'))r.result.createObjectStore('kv')};r.onsuccess=()=>{const q=r.result.transaction('kv','readonly').objectStore('kv').get('background');q.onsuccess=()=>{if(!q.result)return;const u=URL.createObjectURL(q.result),app=document.querySelector('.app');if(app){app.style.backgroundImage=`linear-gradient(#0007,#0007),url(${u})`;app.style.backgroundSize='cover';app.style.backgroundPosition='center';app.style.backgroundAttachment='fixed'}}}}catch{}}
function persistTheme(){const app=document.querySelector('.app');if(!app)return;const saved=localStorage.getItem('frostlink-theme-bg');if(saved){app.classList.remove('bg-aurora','bg-midnight','bg-ice');app.classList.add('bg-'+saved)}if(installed)return;installed=true;new MutationObserver(()=>{const cls=[...app.classList].find(x=>x.startsWith('bg-'));if(cls)localStorage.setItem('frostlink-theme-bg',cls.slice(3))}).observe(app,{attributes:true,attributeFilter:['class']})}
function boot(){const wait=()=>{if(document.querySelector('.app')){persistTheme();loadBg()}else setTimeout(wait,250)};wait()}
boot();
