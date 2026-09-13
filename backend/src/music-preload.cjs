/*
 * Isolate synchronized music from the legacy music:control receiver.
 * Normal Socket.IO events are untouched. Only the old music:control event
 * is translated to the new music:sync event and stamped with server time.
 */
const {Server}=require('socket.io');
const {Socket}=require('socket.io');

function syncPayload(payload){
  if(!payload||typeof payload!=='object')return payload;
  return {...payload,serverNow:Date.now()};
}

const originalTo=Server.prototype.to;
Server.prototype.to=function(room){
  const operator=originalTo.call(this,room);
  const originalEmit=operator.emit.bind(operator);
  operator.emit=(event,...args)=>{
    if(event==='music:control'){
      return originalEmit('music:sync',syncPayload(args[0]));
    }
    return originalEmit(event,...args);
  };
  return operator;
};

const originalSocketEmit=Socket.prototype.emit;
Socket.prototype.emit=function(event,...args){
  if(event==='music:control')return originalSocketEmit.call(this,'music:sync',syncPayload(args[0]));
  return originalSocketEmit.call(this,event,...args);
};
