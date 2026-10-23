const CACHE='travel-ddak-shell-v25';
const FILES=['./','./index.html','./styles.css','./app.js','./assets/journey-hero.svg','./assets/journey-coast.svg','./assets/journey-city.svg','./assets/journey-nature.svg','./core.js','./updates.js','./cloud-panel.js','./entry.js','./background-consent.js','./autopilot.js','./offline-pack.js','./photo-candidates.js','./native-albums.js','./itinerary.js','./hybrid.js','./photos.js','./cloud.js','./firebase-config.js','./native-export.js','./manifest.webmanifest','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png','./assets/japan.jpg','./assets/coast.jpg','./assets/city.jpg'];
self.addEventListener('install',event=>{event.waitUntil((async()=>{
 const assets=await Promise.all(FILES.map(async path=>{
  const response=await fetch(path,{cache:'reload'});
  if(!response.ok||response.redirected)throw Error('인증 화면은 캐시하지 않습니다.');
  if((path==='./'||path==='./index.html')&&!(await response.clone().text()).includes('data-travel-ddak-shell="1"'))throw Error('앱 화면만 캐시할 수 있습니다.');
  return [path,response];
 }));
 const cache=await caches.open(CACHE);await Promise.all(assets.map(([path,response])=>cache.put(path,response)));
})());});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('travel-ddak-shell-')&&key!==CACHE).map(key=>caches.delete(key)))));});
self.addEventListener('message',event=>{if(event.data?.type==='APPLY_UPDATE')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);if(url.origin!==self.location.origin)return;
 // Cache app assets only. Never persist auth pages, API responses, trip exports or user content.
 const relative='./'+url.pathname.slice(new URL(self.registration.scope).pathname.length);
 if(!FILES.includes(relative)&&event.request.mode!=='navigate')return;
 event.respondWith(fetch(event.request).then(response=>{if(!response.ok||response.redirected)throw Error('온라인 앱 파일을 읽지 못했습니다.');return response;}).catch(async()=>{
  const cache=await caches.open(CACHE);
  return (await cache.match(event.request))||(event.request.mode==='navigate'?await cache.match('./index.html'):undefined)||new Response('오프라인에서 파일을 찾지 못했습니다.',{status:503});
 }));
});
