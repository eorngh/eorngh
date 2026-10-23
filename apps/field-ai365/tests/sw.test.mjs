import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../public/sw.js',import.meta.url),'utf8');
function harness({redirected=false,ok=true}={}){
 const handlers=new Map(),puts=[];
 const response={ok,redirected,clone:()=>({fixture:true})};
 vm.runInNewContext(source,{
  self:{location:{href:'https://site.example/sw.js',origin:'https://site.example'},addEventListener:(name,fn)=>handlers.set(name,fn)},
  URL,Set,Response,fetch:async()=>response,
  caches:{open:async()=>({put:(request,value)=>puts.push({url:typeof request==='string'?new URL(request,'https://site.example').href:request.url,value})}),match:async()=>undefined}
 });
 function request(path,method='GET'){
  let pending;
  handlers.get('fetch')({request:{url:new URL(path,'https://site.example').href,method,mode:'navigate'},respondWith:value=>{pending=value;}});
  return pending;
 }
 function install(){let pending;handlers.get('install')({waitUntil:value=>{pending=value;}});return pending;}
 return {request,install,puts,response};
}

test('비공개 사이트 인증·로그아웃·callback·API는 Service Worker가 가로채지 않음',()=>{
 const h=harness();
 for(const path of ['/signin-with-chatgpt','/signout-with-chatgpt','/callback?code=fixture','/api/ai/suggest','https://firestore.googleapis.com/fixture'])
  assert.equal(h.request(path),undefined,path);
 assert.equal(h.request('/index.html','POST'),undefined);
});

test('승인된 앱 정적 자산만 네트워크 응답 후 오프라인 캐시에 저장',async()=>{
 const h=harness();
 assert.equal(await h.request('/app.mjs'),h.response);
 assert.equal(h.puts.length,1);
 assert.equal(h.puts[0].url,'https://site.example/app.mjs');
 assert.equal(h.request('/unlisted-resource'),undefined);
});

test('정적 자산 요청이 로그인으로 리디렉션되면 인증 화면을 앱 캐시에 저장하지 않음',async()=>{
 const h=harness({redirected:true});
 assert.equal(await h.request('/index.html'),h.response);
 assert.equal(h.puts.length,0);
});

test('최초 오프라인 설치도 로그인 리디렉션·HTTP 실패 시 캐시 저장 전에 중단',async()=>{
 for(const options of [{redirected:true},{ok:false}]){
  const h=harness(options);
  await assert.rejects(h.install(),/앱 파일을 인증된 상태/);
  assert.equal(h.puts.length,0);
 }
});

test('최초 오프라인 설치는 모든 앱 파일 응답을 확인한 뒤 캐시를 준비',async()=>{
 const h=harness();
 await h.install();
 for(const name of ['index.html','app.mjs','styles.css','core.mjs','store.mjs','reports.mjs','vendor/pdf-lib.min.js'])
  assert.ok(h.puts.some(p=>p.url==='https://site.example/'+name),name);
 assert.ok(h.puts.some(p=>p.url==='https://site.example/index.html'));
 assert.ok(h.puts.some(p=>p.url==='https://site.example/app.mjs'));
 assert.ok(h.puts.every(p=>!p.url.includes('signin-with-chatgpt')));
});
