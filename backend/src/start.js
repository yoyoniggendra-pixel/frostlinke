import fs from 'fs';
import os from 'os';
import path from 'path';
import {pathToFileURL} from 'url';

const sourcePath=path.resolve(process.cwd(),'src/server.js');
let source=fs.readFileSync(sourcePath,'utf8');

const requestRoute=`app.post('/api/message-requests',auth,async(req,res)=>{
 const{recipient_id,initial_message=''}=req.body||{};
 if(!recipient_id||recipient_id===req.user.id)return res.status(400).json({error:'Invalid recipient'});
 const{data:target,error:targetError}=await db.from('profiles').select('id').eq('id',recipient_id).maybeSingle();
 if(targetError)return res.status(500).json({error:targetError.message});
 if(!target)return res.status(404).json({error:'User not found.'});
 const{data:senderMembers,error:senderMembersError}=await db.from('conversation_members').select('conversation_id').eq('user_id',req.user.id);
 if(senderMembersError)return res.status(500).json({error:senderMembersError.message});
 const senderIds=(senderMembers||[]).map(x=>x.conversation_id);
 if(senderIds.length){
   const{data:shared,error:sharedError}=await db.from('conversation_members').select('conversation_id').eq('user_id',recipient_id).in('conversation_id',senderIds);
   if(sharedError)return res.status(500).json({error:sharedError.message});
   if(shared?.length)return res.status(409).json({error:'You already have a conversation with this user.',code:'CONVERSATION_EXISTS'});
 }
 const{data:pending,error:pendingError}=await db.from('message_requests').select('id,created_at').eq('sender_id',req.user.id).eq('recipient_id',recipient_id).eq('status','pending').maybeSingle();
 if(pendingError)return res.status(500).json({error:pendingError.message});
 if(pending)return res.status(409).json({error:'You already sent a message request to this user.',code:'REQUEST_ALREADY_SENT',request_id:pending.id});
 const initial=String(initial_message||'').trim();
 if(!initial)return res.status(400).json({error:'Your first message is required.'});
 if(initial.length>2000)return res.status(400).json({error:'Your first message is too long.'});
 const{data,error}=await db.from('message_requests').insert({sender_id:req.user.id,recipient_id,initial_message:initial,status:'pending'}).select('*').single();
 if(error){if(error.code==='23505')return res.status(409).json({error:'You already sent a message request to this user.',code:'REQUEST_ALREADY_SENT'});return res.status(400).json({error:error.message})}
 res.status(201).json({request:data});
});`;

const outgoingRoute=`app.get('/api/message-requests/outgoing',auth,async(req,res)=>{
 const{data,error}=await db.from('message_requests').select('id,recipient_id,initial_message,status,created_at,recipient:profiles!message_requests_recipient_id_fkey(id,username,display_name,avatar_url)').eq('sender_id',req.user.id).eq('status','pending').order('created_at',{ascending:false});
 if(error)return res.status(500).json({error:error.message});
 res.json({requests:data||[]});
});`;

const acceptRoute=`app.post('/api/message-requests/:id/:action',auth,async(req,res)=>{
 const action=req.params.action;
 if(!['accepted','accept'].includes(action))return res.status(400).json({error:'Invalid action'});
 const{data:r,error}=await db.from('message_requests').select('*').eq('id',req.params.id).eq('recipient_id',req.user.id).eq('status','pending').single();
 if(error||!r)return res.status(404).json({error:error?.message||'Request not found'});
 const{data:existingMember,error:existingError}=await db.from('conversation_members').select('conversation_id').eq('user_id',req.user.id);
 if(existingError)return res.status(500).json({error:existingError.message});
 const existingIds=(existingMember||[]).map(x=>x.conversation_id);
 if(existingIds.length){
   const{data:shared,error:sharedError}=await db.from('conversation_members').select('conversation_id').eq('user_id',r.sender_id).in('conversation_id',existingIds);
   if(sharedError)return res.status(500).json({error:sharedError.message});
   if(shared?.length){
     const conversationId=shared[0].conversation_id;
     const{error:ue}=await db.from('message_requests').update({status:'accepted'}).eq('id',r.id);
     if(ue)return res.status(500).json({error:ue.message});
     return res.json({ok:true,conversation_id:conversationId});
   }
 }
 const{data:c,error:ce}=await db.from('conversations').insert({kind:'direct'}).select().single();
 if(ce)return res.status(500).json({error:\`Could not create conversation: \${ce.message}\`});
 const{error:me}=await db.from('conversation_members').insert([{conversation_id:c.id,user_id:r.sender_id},{conversation_id:c.id,user_id:req.user.id}]);
 if(me){await db.from('conversations').delete().eq('id',c.id);return res.status(500).json({error:\`Could not add conversation members: \${me.message}\`})}
 let initialMessage=null;
 if(r.initial_message){
   const{data:msg,error:msgError}=await db.from('messages').insert({conversation_id:c.id,sender_id:r.sender_id,type:'text',body:r.initial_message}).select('*,sender:profiles!messages_sender_id_fkey(id,username,display_name,avatar_url)').single();
   if(msgError)return res.status(500).json({error:\`Conversation created, but initial message failed: \${msgError.message}\`});
   initialMessage=msg;
   await db.from('conversations').update({updated_at:new Date().toISOString()}).eq('id',c.id);
 }
 const{error:ae}=await db.from('message_requests').update({status:'accepted'}).eq('id',r.id);
 if(ae)return res.status(500).json({error:\`Conversation created, but request status failed: \${ae.message}\`});
 if(initialMessage){io.to(\`conversation:\${c.id}\`).emit('message:new',initialMessage);io.to(\`user:\${r.sender_id}\`).emit('message:new',initialMessage);io.to(\`user:\${req.user.id}\`).emit('message:new',initialMessage)}
 res.json({ok:true,conversation_id:c.id});
});`;

const conversationsRoute=`app.get('/api/conversations',auth,async(req,res)=>{
 const{data:members,error}=await db.from('conversation_members').select('conversation_id').eq('user_id',req.user.id);
 if(error)return res.status(500).json({error:error.message});
 const ids=(members||[]).map(x=>x.conversation_id);
 if(!ids.length)return res.json({conversations:[]});
 const{data:convos,error:ce}=await db.from('conversations').select('id,kind,title,updated_at').in('id',ids).order('updated_at',{ascending:false});
 if(ce)return res.status(500).json({error:ce.message});
 const out=[];
 for(const c of convos||[]){
   const{data:ms,error:me}=await db.from('conversation_members').select('user_id').eq('conversation_id',c.id).neq('user_id',req.user.id);
   if(me)return res.status(500).json({error:\`Could not load conversation members: \${me.message}\`});
   let other=null;const otherId=ms?.[0]?.user_id;
   if(otherId){const{data:p,error:pe}=await db.from('profiles').select('id,username,display_name,avatar_url').eq('id',otherId).maybeSingle();if(pe)return res.status(500).json({error:\`Could not load conversation profile: \${pe.message}\`});other=p||null}
   const{data:last,error:le}=await db.from('messages').select('body,type,created_at,sender_id,payload').eq('conversation_id',c.id).order('created_at',{ascending:false}).limit(1);
   if(le)return res.status(500).json({error:\`Could not load last message: \${le.message}\`});
   out.push({...c,other,last:last?.[0]||null,music:activeMusic.has(c.id)?{user_id:activeMusic.get(c.id).user_id}:null});
 }
 res.json({conversations:out});
});`;

function replaceOnce(re, replacement, label){
 const next=source.replace(re,replacement);
 if(next===source)throw new Error(\`Could not patch \${label}: target not found\`);
 source=next;
}
replaceOnce(/app\.post\('\/api\/message-requests',auth,async\(req,res\)=>\{[\s\S]*?\}\);app\.get\('\/api\/message-requests',auth/,()=>requestRoute+'app.get(\'/api/message-requests\',auth', 'request creation route');
replaceOnce(/app\.get\('\/api\/message-requests',auth,async\(req,res\)=>\{[\s\S]*?\}\);\napp\.post\('\/api\/message-requests\/:id\/:action'/,m=>m.slice(0,m.indexOf('app.post'))+'\n'+outgoingRoute+'\n'+acceptRoute, 'outgoing and accept routes');
replaceOnce(/app\.get\('\/api\/conversations',auth,async\(req,res\)=>\{[\s\S]*?\}\);\nasync function requireMember/,()=>conversationsRoute+'\nasync function requireMember', 'conversation route');

const runtimePath=path.join(os.tmpdir(),`frostlink-server-${process.pid}.mjs`);
fs.writeFileSync(runtimePath,source,'utf8');
await import(pathToFileURL(runtimePath).href);
