const V='wc26-v42',B='wc26-bible',SHELL=['./','index.html','app.js','extras.js','extras.css','bible.css','songs.json','manifest.webmanifest','config.js','icon-192.png','icon-512.png','icon-maskable-512.png','favicon.png','lords-church.png','cormorant-garamond-italic.woff2'];
self.addEventListener('install',e=>e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V&&x!==B).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
// Songs, the Sunday sheet and settings: always the newest copy when online (4 s limit), the saved copy when offline
const FRESH=/\/(config\.js|sunday\.txt|songs\.json)$/;
async function fresh(r){
  const c=await caches.open(V);
  try{const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),4000);const x=await fetch(r,{signal:ctl.signal});clearTimeout(t);if(x.ok){c.put(r,x.clone());return x}}catch(_){}
  return (await c.match(r,{ignoreSearch:true}))||fetch(r);
}
// Bible books: saved the first time they are opened, kept across app updates (own cache), served instantly afterwards
async function bible(r){
  const c=await caches.open(B);
  const hit=await c.match(r);
  if(hit)return hit;
  const x=await fetch(r);
  if(x.ok)c.put(r,x.clone());
  return x;
}
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==location.origin)return;
  if(r.destination==='video'||r.destination==='audio'||r.headers.has('range')||/\.(mp4|mp3|m4a|mpeg|mpg|ogg|wav|aac)$/i.test(u.pathname))return;
  if(/\/bible\/(te|en)\/[0-9A-Z]{3}\.json$/.test(u.pathname)){e.respondWith(bible(r));return}
  if(FRESH.test(u.pathname)){e.respondWith(fresh(r));return}
  const key=(r.mode==='navigate'&&/(\/|index\.html)$/.test(u.pathname))?'index.html':r;
  e.respondWith(caches.open(V).then(async c=>{
    const hit=await c.match(key,{ignoreSearch:true});
    const net=fetch(r).then(x=>{if(x.ok)c.put(key,x.clone());return x}).catch(()=>hit);
    return hit||net;
  }));
});
