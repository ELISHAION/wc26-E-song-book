const V='wc26-v14',SHELL=['./','index.html','app.js','songs.json','manifest.webmanifest','icon-192.png','icon-512.png','favicon.png','icon-maskable-512.png','lords-church.png','worship-conference.png','cormorant-garamond-italic.woff2'];
self.addEventListener('install',e=>e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
// Stale-while-revalidate: instant from cache, refreshed in background (new songs.json arrives on next visit)
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
  const key=r.mode==='navigate'?'index.html':r;
  e.respondWith(caches.open(V).then(async c=>{
    const hit=await c.match(key,{ignoreSearch:true});
    const net=fetch(r).then(x=>{if(x.ok)c.put(key,x.clone());return x}).catch(()=>hit);
    return hit||net;
  }));
});
