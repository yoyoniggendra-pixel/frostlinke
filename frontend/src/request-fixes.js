// FROSTLINK message-request recovery fix.
// Reload only after an accept action succeeds so the accepted state is read from Supabase.
const originalFetch=window.fetch.bind(window.fetch);
window.fetch=async(input,init={})=>{
  const url=typeof input==='string'?input:(input?.url||'');
  const method=String(init?.method||(typeof input!=='string'&&input?.method)||'GET').toUpperCase();
  const isRequestAction=method==='POST'&&/\/api\/message-requests\/[^/]+\/(accepted|accept)(?:[?#]|$)/.test(url);
  const response=await originalFetch(input,init);
  if(isRequestAction&&response.ok)window.setTimeout(()=>window.location.reload(),250);
  return response;
};
