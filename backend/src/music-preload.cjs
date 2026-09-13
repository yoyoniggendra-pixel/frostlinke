/*
 * Isolate synchronized music from the legacy music:control receiver.
 * Normal Socket.IO events are untouched. Only music:control is translated
 * to music:sync and stamped with server time.
 */
const {Server,Socket}=require('socket.io');
const activeSync=new Map();

function syncPayload(payload){
  if(!payload||typeof payload!=='object')return payload;
  const now=Date.now();
  const out={...payload,serverNow:now};
  if(out.action==='start'&&out.conversation_id){
    const current=Number(out.currentTime)||0;
    activeSync.set(out.conversation_id,{...out,startedAt:now-current*1000});
  }else if(out.action==='stop'&&out.conversation_id){
    activeSync.delete(out.conversation_id);
  }
  return out;
}

function enrichJoin(payload){
  if(!payload||typeof payload!=='object'||payload.action!=='start'||!payload.conversation_id)return payload;
  const state=activeSync.get(payload.conversation_id);
  if(!state)return syncPayload(payload);
  const now=Date.now();
  return {...payload,currentTime:Math.max(0,(now-state.startedAt)/1000),serverNow:now};
}

const originalTo=Server.prototype.to;
Server.prototype.to=function(room){
  const operator=originalTo.call(this,room);
  const originalEmit=operator.emit.bind(operator);
  operator.emit=(event,...args)=>{
    if(event==='music:control')return originalEmit('music:sync',syncPayload(args[0]));
    return originalEmit(event,...args);
  };
  return operator;
};

const originalSocketEmit=Socket.prototype.emit;
Socket.prototype.emit=function(event,...args){
  if(event==='music:control')return originalSocketEmit.call(this,'music:sync',enrichJoin(args[0]));
  return originalSocketEmit.call(this,event,...args);
};
