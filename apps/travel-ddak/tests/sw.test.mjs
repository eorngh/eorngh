import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../dist/sw.js',import.meta.url),'utf8');
async function worker(fetcher){
 const handlers={},cached=new Map();
 const self={location:{origin:'https://qa.example'},registration:{scope:'https://qa.example/'},addEventListener:(name,handler)=>handlers[name]=handler};
 const caches={open:async()=>({put:async(path,response)=>cached.set(path,response)})};
 vm.runInNewContext(source,{self,caches,fetch:fetcher,URL,Response});
 return {handlers,cached,install(){let task;handlers.install({waitUntil:promise=>task=promise});return task;}};
}
test('실제 앱 HTML로 셸 캐시 설치, 로그인 화면은 캐시 거부',async()=>{
 const good=await worker(async path=>new Response(await readFile(new URL('../dist/'+(path==='./'?'index.html':path.slice(2)),import.meta.url))));
 await good.install();assert(good.cached.has('./index.html'));assert(good.cached.has('./itinerary.js'));
 const login=await worker(async()=>new Response('<html>Sign in</html>'));
 await assert.rejects(login.install(),/앱 화면만/);assert.equal(login.cached.size,0);
 const redirect=await worker(async()=>({ok:true,redirected:true}));
 await assert.rejects(redirect.install(),/인증 화면/);assert.equal(redirect.cached.size,0);
});
test('서비스워커는 API·사용자 내보내기 응답을 가로채지 않음',async()=>{
 const app=await worker(async()=>new Response('unused'));let intercepted=false;
 for(const path of ['/api/trips','/exports/travel.html'])app.handlers.fetch({request:{method:'GET',url:'https://qa.example'+path,mode:'cors'},respondWith:()=>intercepted=true});
 assert.equal(intercepted,false);
});
