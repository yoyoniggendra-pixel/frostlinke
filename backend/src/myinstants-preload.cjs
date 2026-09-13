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
    if(req.method==='GET'&&url.pathname==='/api/myinstants/search'){
      res.setHeader('Access-Control-Allow-Origin',process.env.FRONTEND_URL||'*');
      res.setHeader('Access-Control-Allow-Credentials','true');
      res.setHeader('Cache-Control','no-store');
      try{
        const auth=await authUser(req);
        if(!auth)return res.writeHead(401,{'Content-Type':'application/json'}).end(JSON.stringify({error:'Missing or invalid authorization token'}));
        const q=(url.searchParams.get('q')||'trending').slice(0,80);
        const upstream=new URL('https://myinstants-api.vercel.app/search');
        upstream.searchParams.set('q',q);
        const r=await fetch(upstream);
        const body=await r.text();
        return res.writeHead(r.status,{'Content-Type':'application/json'}).end(body);
      }catch(e){
        return res.writeHead(502,{'Content-Type':'application/json'}).end(JSON.stringify({error:e.message||'MyInstants request failed'}));
      }
    }
    return requestListener(req,res);
  });
};
