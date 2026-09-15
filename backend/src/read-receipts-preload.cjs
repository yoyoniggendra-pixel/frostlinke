const http=require('http');
const {URL}=require('url');
const {Server}=require('socket.io');
const originalCreateServer=http.createServer;
const originalServerOn=Server.prototype.on;
let socketIo=null;

async function getDb(){const{createClient}=await import('@supabase/supabase-js');return createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY)}
async function authUser(req){const token=String(req.headers.authorization||'').replace(/^Bearer\s+/,'');if(!token)return null;const db=await getDb();const{data,error}=await db.auth.getUser(token);return error||!data.user?null:{db,user:data.user}}
function json(res,status,body){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':process.env.FRONTEND_URL||'*','Access-Control-Allow-Credentials':'true'});res.end(JSON.stringify(body))}

async function markRead(db,user,messageId){
 const{data:message,error:messageError}=await db.from('messages').select('id,conversation_id,sender_id').eq('id',messageId).maybeSingle();
 if(messageError)throw Object.assign(new Error(messageError.message),{status:500});
 if(!message)throw Object.assign(new Error('Message not found'),{status:404});
 if(message.sender_id===user.id)throw Object.assign(new Error('You cannot mark your own message as read.'),{status:400});
 const{data:member,error:memberError}=await db.from('conversation_members').select('user_id').eq('conversation_id',message.conversation_id).eq('user_id',user.id).maybeSingle();
 if(memberError)throw Object.assign(new Error(memberError.message),{status:500});
 if(!member)throw Object.assign(new Error('Not a member of this conversation'),{status:403});
 const{data:read,error:readError}=await db.from('message_reads').upsert({message_id:message.id,user_id:user.id,read_at:new Date().toISOString()},{onConflict:'message_id,user_id'}).select().single();
 if(readError)throw Object.assign(new Error(readError.message),{status:500});
 return{message,read};
}

function broadcastRead(conversationId,messageId,userId,readAt,excludeSocket){
 const payload={conversation_id:conversationId,message_id:messageId,user_id:userId,read_at:readAt};
 if(excludeSocket)excludeSocket.to(`conversation:${conversationId}`).emit('message:read',payload);
 else socketIo?.to(`conversation:${conversationId}`).emit('message:read',payload);
}

// Keep the existing server connection handler intact, but attach the read-receipt
// Socket.IO event to every authenticated socket. This does not replace any
// existing message, typing, reaction, presence, or music handlers.
Server.prototype.on=function(event,listener){
 if(event!=='connection')return originalServerOn.call(this,event,listener);
 socketIo=this;
 const wrapped=socket=>{
  listener(socket);
  if(socket.__frostReadReceiptInstalled)return;
  socket.__frostReadReceiptInstalled=true;
  socket.on('message:read',async(payload,ack)=>{
   const done=typeof ack==='function'?ack:()=>{};
   try{
    const messageId=typeof payload==='string'?payload:payload?.message_id;
    if(!messageId)throw Object.assign(new Error('message_id is required'),{status:400});
    const db=await getDb();
    const result=await markRead(db,socket.user,String(messageId));
    broadcastRead(result.message.conversation_id,result.message.id,socket.user.id,result.read.read_at,socket);
    done({ok:true,message_id:result.message.id,conversation_id:result.message.conversation_id,read_at:result.read.read_at});
   }catch(e){done({ok:false,error:e.message||'Could not mark message as read'})}
  });
 };
 return originalServerOn.call(this,event,wrapped);
};

http.createServer=function patchedCreateServer(requestListener){return originalCreateServer.call(http,async(req,res)=>{
 const url=new URL(req.url||'/','http://'+(req.headers.host||'localhost'));
 if(req.method==='POST'&&/^\/api\/messages\/[^/]+\/read$/.test(url.pathname)){
  try{
   const auth=await authUser(req);
   if(!auth)return json(res,401,{error:'Invalid session'});
   const messageId=decodeURIComponent(url.pathname.split('/')[3]);
   const result=await markRead(auth.db,auth.user,messageId);
   broadcastRead(result.message.conversation_id,result.message.id,auth.user.id,result.read.read_at);
   return json(res,200,{ok:true,read:result.read});
  }catch(e){return json(res,e.status||500,{error:e.message||'Could not mark message as read'})}
 }
 if(req.method==='GET'&&url.pathname==='/api/messages/read-status'){
  try{
   const auth=await authUser(req);
   if(!auth)return json(res,401,{error:'Invalid session'});
   const conversationId=String(url.searchParams.get('conversation_id')||'');
   if(!conversationId)return json(res,400,{error:'conversation_id is required'});
   const{data:member,error:memberError}=await auth.db.from('conversation_members').select('user_id').eq('conversation_id',conversationId).eq('user_id',auth.user.id).maybeSingle();
   if(memberError)return json(res,500,{error:memberError.message});
   if(!member)return json(res,403,{error:'Not a member of this conversation'});
   const{data:sent,error:sentError}=await auth.db.from('messages').select('id').eq('conversation_id',conversationId).eq('sender_id',auth.user.id);
   if(sentError)return json(res,500,{error:sentError.message});
   const ids=(sent||[]).map(x=>x.id);
   if(!ids.length)return json(res,200,{message_ids:[]});
   const{data:rows,error}=await auth.db.from('message_reads').select('message_id,user_id,read_at').in('message_id',ids).neq('user_id',auth.user.id);
   if(error)return json(res,500,{error:error.message});
   return json(res,200,{message_ids:(rows||[]).map(x=>x.message_id)});
  }catch(e){return json(res,500,{error:e.message||'Could not load read status'})}
 }
 return requestListener(req,res)
})}
