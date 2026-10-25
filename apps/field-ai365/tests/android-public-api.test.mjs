import test from 'node:test';
import assert from 'node:assert/strict';
import {AddressProvider} from '../public/providers.mjs';
import {publicApiOrigin,readNativePublicApiOrigin} from '../public/public-api-config.mjs';
import {verifyAndroidPublicApi,nativeOrigin} from '../tools/configure-public-api.mjs';
import {createServer} from '../server.mjs';
import {mkdtemp,mkdir,copyFile,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
test('build includes only origin, removes stale endpoint on disconnect and refuses key-bearing config',async()=>{
 const root=await mkdtemp(join(tmpdir(),'field-native-api-'));
 try{
  for(const dir of ['tools','public','.local'])await mkdir(join(root,dir),{recursive:true});
  await copyFile(new URL('../tools/build.mjs',import.meta.url),join(root,'tools/build.mjs'));
  await copyFile(new URL('../public/public-api-config.mjs',import.meta.url),join(root,'public/public-api-config.mjs'));
  const input=join(root,'.local/public-api-runtime.json'),output=join(root,'android/app/src/main/assets/_public-api-runtime.json');
  const build=()=>spawnSync(process.execPath,['tools/build.mjs'],{cwd:root,encoding:'utf8'});
  await writeFile(input,JSON.stringify({origin:'https://example.test'}));
  assert.equal(build().status,0);assert.deepEqual(JSON.parse(await readFile(output)),{origin:'https://example.test'});
  await rm(input);assert.equal(build().status,0);await assert.rejects(readFile(output),{code:'ENOENT'});
  await writeFile(input,JSON.stringify({origin:'https://example.test',JUSO_SEARCH_KEY:'synthetic-do-not-package'}));
  const bad=build();assert.notEqual(bad.status,0);assert(!bad.stderr.includes('synthetic-do-not-package'));await assert.rejects(readFile(output),{code:'ENOENT'});
 }finally{await rm(root,{recursive:true,force:true});}
});
test('Android endpoint rejects cleartext, local assets, credentials and query/path secrets',()=>{
 for(const value of ['',undefined,'http://example.test','https://user:pass@example.test','https://example.test?key=secret','https://example.test#secret','https://example.test/api','https://localhost','https://127.0.0.1','https://[::1]','https://appassets.androidplatform.net'])assert.throws(()=>publicApiOrigin(value));
 assert.equal(publicApiOrigin('https://example.test/'),'https://example.test');
 assert.equal(readNativePublicApiOrigin({getPublicApiConfig:()=>'{broken'}),'');
 assert.equal(readNativePublicApiOrigin({getPublicApiConfig:()=>JSON.stringify({origin:'https://example.test'})}),'https://example.test');
});
test('configured Android sends only keyword to HTTPS proxy; web retains same-origin requests',async()=>{
 for(const native of [true,false]){
  let calls=0;const provider=new AddressProvider({native,serverOrigin:'https://example.test',fetcher:async(url,options)=>{
   calls++;assert.equal(url,(native?'https://example.test':'')+'/api/address?keyword='+encodeURIComponent('검증 주소'));
   assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');
   return {ok:true,json:async()=>({status:'LIVE',items:[{roadAddress:'검증 주소'}]})};
  }});
  assert.equal((await provider.search('검증 주소')).status,'LIVE');assert.equal(calls,1);
 }
});
test('unconfigured Android never sends a request to the appassets virtual host',async()=>{
 let calls=0;for(const serverOrigin of ['', 'http://example.test']){
  const provider=new AddressProvider({native:true,serverOrigin,fetcher:()=>{calls++;}});
  assert.equal((await provider.search('검증 주소')).status,'BLOCKED');
 }assert.equal(calls,0);
});
test('native lookup failures do not fall back to fake addresses or expose transport errors',async()=>{
 const provider=new AddressProvider({native:true,serverOrigin:'https://example.test',fetcher:async()=>{throw Error('secret upstream url');}});
 await assert.rejects(provider.search('검증 주소'),error=>!error.message.includes('secret')&&error.message.includes('직접 입력'));
 await assert.rejects(provider.search('a'),/2~100/);
});
test('configuration verification requires service identity, native CORS and live nonempty addresses',async()=>{
 for(const mode of ['valid','wrong-service','wrong-cors','blocked','empty','bad-row']){
  const fetcher=async(url,options)=>{
   assert.equal(options.headers.Origin,nativeOrigin);assert.equal(options.redirect,'error');
   return {ok:true,headers:new Headers({'Access-Control-Allow-Origin':mode==='wrong-cors'?'*':nativeOrigin}),json:async()=>url.endsWith('/status')?{service:mode==='wrong-service'?'other':'field-ai365',addressSearchConfigured:true}:{status:mode==='blocked'?'BLOCKED':'LIVE',items:mode==='empty'?[]:mode==='bad-row'?[{}]:[{roadAddress:'synthetic'}]}};
  };
  if(mode==='valid')assert.deepEqual(await verifyAndroidPublicApi('https://example.test',{fetcher}),{origin:'https://example.test',addressCount:1});
  else await assert.rejects(verifyAndroidPublicApi('https://example.test',{fetcher}));
 }
});
test('real HTTP proxy permits native origin and denies unrelated sites without calling upstream',async()=>{
 let calls=0;const server=createServer({env:{JUSO_SEARCH_KEY:'synthetic-key'},fetcher:async()=>{calls++;return {ok:true,json:async()=>({results:{common:{errorCode:'0'},juso:[{roadAddr:'synthetic road'}]}})};}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const url='http://127.0.0.1:'+server.address().port+'/api/address?keyword=synthetic';
  const allowed=await fetch(url,{headers:{Origin:nativeOrigin}});
  assert.equal(allowed.headers.get('access-control-allow-origin'),nativeOrigin);assert.equal((await allowed.json()).status,'LIVE');
  const denied=await fetch(url,{headers:{Origin:'https://unrelated.test'}});assert.equal(denied.status,403);assert.equal(calls,1);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
