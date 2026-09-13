import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import sanitizeHtml from 'sanitize-html';
import { createClient } from '@supabase/supabase-js';

const app = express();
const server = http.createServer(app);
const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
const io = new Server(server, { cors: { origin: allowedOrigin, methods: ['GET','POST'] } });
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: '2mb' }));
app.get('/health', (_, res) => res.json({ ok:true, service:'frostlink-api' }));

async function auth(req,res,next){
  const token=(req.headers.authorization||'').replace(/^Bearer\s+/,'');
  if(!token) return res.status(401).json({error:'Missing authorization token'});
  const {data,error}=await db.auth.getUser(token);
  if(error||!data.user) return res.status(401).json({error:'Invalid session'});
  req.user=data.user; next();
}
function cleanEmbedHtml(html){
  return sanitizeHtml(html,{allowedTags:['iframe','blockquote','a','div','p','span'],allowedAttributes:{iframe:['src','width','height','title','allow','allowfullscreen','loading','referrerpolicy'],a:['href','target','rel'],div:['class'],blockquote:['class','data-instgrm-permalink','data-instgrm-version'],span:['class']},allowedSchemes:['https','http']});
}
function parseEmbed(input){
  const raw=String(input||'').trim();
  const iframe=raw.match(/<iframe[\s\S]*?<\/iframe>/i)?.[0];
  if(iframe){
    const safe=cleanEmbedHtml(iframe);
    const src=safe.match(/src=["']([^"']+)["']/i)?.[1];
    if(!src) throw new Error('Iframe has no safe HTTPS source');
    const u=new URL(src); if(!['http:','https:'].includes(u.protocol)) throw new Error('Unsupported iframe protocol');
    return {type:'embed',provider:'custom',url:src,embedUrl:src,html:safe,sandbox:true};
  }
  const u=new URL(raw); if(!['http:','https:'].includes(u.protocol)) throw new Error('Unsupported URL');
  const host=u.hostname.toLowerCase().replace(/^www\./,'');
  if(host==='youtube.com'||host==='youtu.be'||host==='m.youtube.com'){
    let id=u.searchParams.get('v'); if(host==='youtu.be') id=u.pathname.slice(1); if(u.pathname.startsWith('/shorts/')) id=u.pathname.split('/')[2];
    if(!id) throw new Error('Invalid YouTube URL');
    return {type:'embed',provider:'youtube',url:raw,embedUrl:`https://www.youtube.com/embed/${encodeURIComponent(id)}`};
  }
  if(host==='vimeo.com') return {type:'embed',provider:'vimeo',url:raw,embedUrl:raw};
  if(host==='open.spotify.com') return {type:'embed',provider:'spotify',url:raw,embedUrl:raw.replace('/track/','/embed/track/').replace('/playlist/','/embed/playlist/')};
  if(host==='maps.google.com'||host==='google.com') return {type:'embed',provider:'google-maps',url:raw,embedUrl:raw};
  if(host==='instagram.com') return {type:'embed',provider:'instagram',url:raw,embedUrl:raw};
  if(host==='x.com'||host==='twitter.com') return {type:'embed',provider:'x',url:raw,embedUrl:raw};
  return {type:'embed',provider:'link',url:raw,embedUrl:null};
}

app.get('/api/users/search',auth,async(req,res)=>{
  const q=String(req.query.q||'').trim().toLowerCase(); if(q.length<2) return res.json({users:[]});
  const {data,error}=await db.from('profiles').select('id,username,display_name,avatar_url').ilike('username',`%${q}%`).neq('id',req.user.id).limit(20);
  if(error) return res.status(500).json({error:error.message}); res.json({users:data||[]});
});

app.post('/api/message-requests',auth,async(req,res)=>{
  const {recipient_id,initial_message=''}=req.body;
  if(!recipient_id||recipient_id===req.user.id) return res.status(400).json({error:'Invalid recipient'});
  const {data,error}=await db.from('message_requests').insert({sender_id:req.user.id,recipient_id,initial_message,status:'pending'}).select('*').single();
  if(error) return res.status(400).json({error:error.message}); res.status(201).json({request:data});
});
app.get('/api/message-requests',auth,async(req,res)=>{
  const {data,error}=await db.from('message_requests').select('*,sender:profiles!message_requests_sender_id_fkey(id,username,display_name,avatar_url)').eq('recipient_id',req.user.id).eq('status','pending').order('created_at',{ascending:false});
  if(error) return res.status(500).json({error:error.message}); res.json({requests:data||[]});
});
app.post('/api/message-requests/:id/:action',auth,async(req,res)=>{
  const action=req.params.action; if(!['accepted','declined'].includes(action)) return res.status(400).json({error:'Invalid action'});
  const {data:r,error}=await db.from('message_requests').select('*').eq('id',req.params.id).eq('recipient_id',req.user.id).single();
  if(error||!r) return res.status(404).json({error:'Request not found'});
  if(action==='declined'){await db.from('message_requests').update({status:'declined'}).eq('id',r.id); return res.json({ok:true});}
  const {data:c,error:ce}=await db.from('conversations').insert({kind:'direct'}).select().single(); if(ce) return res.status(500).json({error:ce.message});
  await db.from('conversation_members').insert([{conversation_id:c.id,user_id:r.sender_id},{conversation_id:c.id,user_id:req.user.id}]);
  if(r.initial_message) await db.from('messages').insert({conversation_id:c.id,sender_id:r.sender_id,type:'text',body:r.initial_message});
  await db.from('message_requests').update({status:'accepted'}).eq('id',r.id); res.json({ok:true,conversation_id:c.id});
});

app.get('/api/conversations',auth,async(req,res)=>{
  const {data:members,error}=await db.from('conversation_members').select('conversation_id').eq('user_id',req.user.id); if(error) return res.status(500).json({error:error.message});
  const ids=(members||[]).map(x=>x.conversation_id); if(!ids.length) return res.json({conversations:[]});
  const {data:convos}=await db.from('conversations').select('id,kind,title,updated_at').in('id',ids).order('updated_at',{ascending:false});
  const out=[]; for(const c of convos||[]){ const {data:ms}=await db.from('conversation_members').select('user_id,profile:profiles(id,username,display_name,avatar_url)').eq('conversation_id',c.id).neq('user_id',req.user.id); const {data:last}=await db.from('messages').select('body,type,created_at,sender_id,payload').eq('conversation_id',c.id).order('created_at',{ascending:false}).limit(1); out.push({...c,other:ms?.[0]?.profile||null,last:last?.[0]||null}); }
  res.json({conversations:out});
});
app.get('/api/conversations/:id/messages',auth,async(req,res)=>{
  const {data:m}=await db.from('conversation_members').select('user_id').eq('conversation_id',req.params.id).eq('user_id',req.user.id).single(); if(!m) return res.status(403).json({error:'Not a member'});
  const limit=Math.min(Number(req.query.limit)||80,200); const {data,error}=await db.from('messages').select('*,sender:profiles(id,username,display_name,avatar_url),reactions:message_reactions(*)').eq('conversation_id',req.params.id).order('created_at',{ascending:true}).limit(limit); if(error) return res.status(500).json({error:error.message}); res.json({messages:data||[]});
});
app.post('/api/conversations/:id/messages',auth,async(req,res)=>{
  const {data:m}=await db.from('conversation_members').select('user_id').eq('conversation_id',req.params.id).eq('user_id',req.user.id).single(); if(!m) return res.status(403).json({error:'Not a member'});
  const {type='text',body=null,payload={}}=req.body;
  if(type==='embed'&&payload.html) payload.html=cleanEmbedHtml(payload.html);
  const {data,error}=await db.from('messages').insert({conversation_id:req.params.id,sender_id:req.user.id,type,body,payload}).select('*,sender:profiles(id,username,display_name,avatar_url)').single();
  if(error) return res.status(400).json({error:error.message}); await db.from('conversations').update({updated_at:new Date().toISOString()}).eq('id',req.params.id); io.to(`conversation:${req.params.id}`).emit('message:new',data); res.status(201).json({message:data});
});
app.post('/api/embeds/parse',auth,(req,res)=>{try{res.json({embed:parseEmbed(req.body.input)})}catch(e){res.status(400).json({error:e.message})}});
app.post('/api/messages/:id/read',auth,async(req,res)=>{const {data:msg}=await db.from('messages').select('id,sender_id,conversation_id').eq('id',req.params.id).single(); if(!msg) return res.status(404).json({error:'Message not found'}); if(msg.sender_id===req.user.id) return res.json({ok:true,ignored:true}); const {data:member}=await db.from('conversation_members').select('user_id').eq('conversation_id',msg.conversation_id).eq('user_id',req.user.id).single(); if(!member) return res.status(403).json({error:'Not a member'}); await db.from('message_reads').upsert({message_id:msg.id,user_id:req.user.id,read_at:new Date().toISOString()}); io.to(`conversation:${msg.conversation_id}`).emit('message:read',{message_id:msg.id,user_id:req.user.id,read_at:new Date().toISOString()}); res.json({ok:true});});
app.post('/api/messages/:id/reactions',auth,async(req,res)=>{const {kind,value}=req.body; if(!['emoji','image'].includes(kind)||!value) return res.status(400).json({error:'Invalid reaction'}); const {data,error}=await db.from('message_reactions').upsert({message_id:req.params.id,user_id:req.user.id,kind,value},{onConflict:'message_id,user_id,kind'}).select().single(); if(error) return res.status(400).json({error:error.message}); const {data:msg}=await db.from('messages').select('conversation_id').eq('id',req.params.id).single(); if(msg) io.to(`conversation:${msg.conversation_id}`).emit('reaction:update',data); res.json({reaction:data});});
app.get('/api/giphy',auth,async(req,res)=>{if(!process.env.GIPHY_API_KEY)return res.status(503).json({error:'GIPHY_API_KEY is not configured'}); const q=encodeURIComponent(req.query.q||'trending'); const r=await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${process.env.GIPHY_API_KEY}&q=${q}&limit=24&rating=pg`); res.status(r.status).json(await r.json());});

io.use(async(socket,next)=>{try{const token=socket.handshake.auth?.accessToken; const {data,error}=await db.auth.getUser(token); if(error||!data.user) return next(new Error('Unauthorized')); socket.user=data.user; next();}catch(e){next(e)}});
io.on('connection',socket=>{socket.on('join-conversation',id=>socket.join(`conversation:${id}`)); socket.on('leave-conversation',id=>socket.leave(`conversation:${id}`));});

server.listen(process.env.PORT||3001,'0.0.0.0',()=>console.log(`FROSTLINK API listening on ${process.env.PORT||3001}`));
