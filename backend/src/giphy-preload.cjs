const http=require('http');
const {URL}=require('url');
const originalCreateServer=http.createServer;

http.createServer=function patchedCreateServer(requestListener){
  return originalCreateServer.call(http,async(req,res)=>{
    const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
    if(req.method==='GET'&&url.pathname==='/api/giphy'){
      res.setHeader('Access-Control-Allow-Origin',process.env.FRONTEND_URL||'*');
      res.setHeader('Access-Control-Allow-Credentials','true');
      res.setHeader('Cache-Control','no-store');
      try{
        const token=String(req.headers.authorization||'').replace(/^Bearer\\s+/,'');
        if(!token)return res.writeHead(401,{'Content-Type':'application/json'}).end(JSON.stringify({error:'Missing authorization token'}));
        const {createClient}=require('@supabase/supabase-js');
        const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
        const {data,error}=await db.auth.getUser(token);
        if(error||!data.user)return res.writeHead(401,{'Content-Type':'application/json'}).end(JSON.stringify({error:'Invalid session'}));
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
