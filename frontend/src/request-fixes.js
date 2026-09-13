// FROSTLINK message-request recovery fix.
// Reload only after a message-request action succeeds so the app reloads the
// accepted/declined state directly from Supabase.
const originalFetch=window.fetch.bind(window);
window.fetch=async(input,init={})=>{
  const url=typeof input==='string'?input:(input?.url||'');
  const method=String(init?.method||(typeof input!=='string'&&input?.method)||'GET').toUpperCase();
  const isRequestAction=method==='POST'&&/\/api\/message-requests\/[^/]+\/(accepted|declined|accept|decline)(?:[?#]|$)/.test(url);
  const response=await originalFetch(input,init);
  if(isRequestAction&&response.ok){
    window.setTimeout(()=>window.location.reload(),250);
  }
  return response;
};
