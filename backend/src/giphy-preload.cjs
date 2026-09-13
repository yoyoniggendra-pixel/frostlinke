const http=require('http');
const {URL}=require('url');
const originalCreateServer=http.createServer;

async function getDb(){
  const {createClient}=await import('@supabase/supabase-js');
  return createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
}
async function authUser(req){
  const token=String(req.headers.authorization||'').replace(/^Bearer\s+/,'');
  if(!token)return null;
  const db=await getDb();
  const {data,error}=await db.auth.getUser(token);
  return error||!data.user?null:{db,user:data.user};
}

http.createServer=function patchedCreateServer(requestListener){
  return originalCreateServer.call(http,async(req,res)=>{
    const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);

    if(req.method==='DELETE'&&url.pathname.startsWith('/api/starred-items/')){
      res.setHeader('Access-Control-Allow-Origin',process.env.FRONTEND_URL||'*');
      res.setHeader('Access-Control-Allow-Credentials','true');
      res.setHeader('Cache-Control','no-store');
      try{
        const auth=await authUser(req);
        if(!auth)return res.writeHead(401,{'Content-Type':'application/json'}).end(JSON.stringify({error:'Invalid or missing session'}));
        const messageId=decodeURIComponent(url.pathname.slice('/api/starred-items/'.length));
        if(!messageId)return res.writeHead(400,{'Content-Type':'application/json'}).end(JSON.stringify({error:'message_id is required'}));
        const {data,error}=await auth.db.from('starred_items').delete().eq('user_id',auth.user.id).eq('message_id',messageId).select('id').maybeSingle();
        if(error)return res.writeHead(400,{'Content-Type':'application/json'}).end(JSON.stringify({error:error.message}));
        return res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({removed:!!data,message_id:messageId}));
      }catch(e){
        return res.writeHead(500,{'Content-Type':'application/json'}).end(JSON.stringify({error:e.message||'Unstar failed'}));
      }
    }

    if(req.method==='GET'&&url.pathname==='/api/giphy'){
      res.setHeader('Access-Control-Allow-Origin',process.env.FRONTEND_URL||'*');
      res.setHeader('Access-Control-Allow-Credentials','true');
      res.setHeader('Cache-Control','no-store');
      try{
        const auth=await authUser(req);
        if(!auth)return res.writeHead(401,{'Content-Type':'application/json'}).end(JSON.stringify({error:'Missing or invalid authorization token'}));
        const key=process.env.GIPHY_API_KEY||process.env.GIPHY_KEY;
        if(!key)return res.writeHead(503,{'Content-Type':'application/json'}).end(JSON.stringify({error:'GIPHY is not configured. Add GIPHY_API_KEY to the Render environment.'}));
        const q=(url.searchParams.get('q')||'trending').slice(0,50);
        const limit=Math.min(Math.max(Number(url.searchParams.get('limit')||24),1),50);
        const endpoint=new URL('https://api.giphy.com/v1/gifs/search');
        endpoint.searchParams.set('api_key',key);endpoint.searchParams.set('q',q);endpoint.searchParams.set('limit',String(limit));endpoint.searchParams.set('rating','pg-13');
        const upstream=await fetch(endpoint);
        const body=await upstream.text();
        res.writeHead(upstream.status,{'Content-Type':'application/json'}).end(body);
      }catch(e){res.writeHead(502,{'Content-Type':'application/json'}).end(JSON.stringify({error:e.message||'GIPHY request failed'}));}
      return;
    }
    return requestListener(req,res);
  });
};
