import test from 'node:test';
import assert from 'node:assert/strict';
import {checkPublicApi,serverBase} from '../tools/check-public-api.mjs';
import {createServer} from '../server.mjs';
const response=body=>({ok:true,json:async()=>body});
test('server URLs reject embedded credentials, query secrets and non-local cleartext',()=>{
  for(const url of ['https://user:secret@example.test','https://example.test?key=secret','https://example.test#secret','http://example.test','file:///tmp/a'])assert.throws(()=>serverBase(url));
  assert.equal(serverBase('http://127.0.0.1:3650/'),'http://127.0.0.1:3650');
  assert.equal(serverBase('https://example.test/app/'),'https://example.test/app');
});
test('missing local settings report unverified and do not start a server or call address search',async()=>{
  let requests=0,started=false;
  const result=await checkPublicApi({fetcher:async url=>{requests++;assert(url.endsWith('/api/public-data/status'));throw Error('offline');},serverFactory:()=>{started=true;}});
  assert.equal(result.status,'NOT_VERIFIED');assert.equal(started,false);assert.equal(requests,1);
});
test('an unrelated local service is not mistaken for a working field API',async()=>{
  const result=await checkPublicApi({fetcher:async()=>response({service:'another-app',addressSearchConfigured:true})});
  assert.equal(result.existingServerRecognized,false);assert.equal(result.status,'NOT_VERIFIED');
});
test('recognized server can validate its own key without transferring it to the checker',async()=>{
  let requests=0;
  const result=await checkPublicApi({baseUrl:'https://example.test/app',fetcher:async url=>{
    requests++;return response(url.endsWith('/status')?{service:'field-ai365',addressSearchConfigured:true}:{status:'LIVE',items:[{roadAddress:'synthetic address',secret:'must-not-be-saved'}]});
  }});
  assert.equal(requests,2);assert.equal(result.status,'PASS');assert.equal(result.localKeyConfigured,false);assert.equal(result.serverOrigin,'https://example.test');
  assert(!JSON.stringify(result).includes('must-not-be-saved'));assert(!JSON.stringify(result).includes('synthetic address'));
});
test('an invalid or unconfigured explicit server never falls back to a different local project',async()=>{
  let started=false;
  const options={env:{JUSO_SEARCH_KEY:'synthetic-approval'},serverFactory:()=>{started=true;},fetcher:async()=>response({service:'field-ai365',addressSearchConfigured:false})};
  assert.equal((await checkPublicApi({...options,baseUrl:'https://example.test'})).status,'SERVER_NOT_READY');
  assert.equal((await checkPublicApi({...options,baseUrl:'https://example.test?secret=hidden'})).status,'INVALID_SERVER_URL');
  assert.equal(started,false);
});
test('configured server or key presence alone is not counted as a successful lookup',async()=>{
  const result=await checkPublicApi({baseUrl:'https://example.test',fetcher:async url=>response(url.endsWith('/status')?{service:'field-ai365',addressSearchConfigured:true}:{status:'BLOCKED',items:[]})});
  assert.equal(result.status,'LOOKUP_NOT_VERIFIED');assert.equal(result.addressCount,0);
});
test('temporary real loopback server uses existing settings, verifies the adapter and closes afterwards',async()=>{
  let temporary,upstreamCalls=0;
  const result=await checkPublicApi({env:{JUSO_SEARCH_KEY:'synthetic-approval',PORT:'1'},
    fetcher:async(url,options)=>{if(url.startsWith('http://127.0.0.1:1/'))throw Error('no listener');return fetch(url,options);},
    serverFactory:options=>{temporary=createServer({...options,fetcher:async()=>{upstreamCalls++;return response({results:{common:{errorCode:'0'},juso:[{roadAddr:'synthetic road'}]}});}});return temporary;}
  });
  assert.equal(result.status,'PASS');assert.equal(result.checkedVia,'temporary-local-server');assert.equal(result.persistentServerStarted,false);
  assert.equal(temporary.listening,false);assert.equal(upstreamCalls,1);assert(!JSON.stringify(result).includes('synthetic-approval'));
});
test('readiness endpoint exposes presence only, with no credential or fabricated verification result',async()=>{
  const server=createServer({env:{JUSO_SEARCH_KEY:'synthetic-secret-value'}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const data=await(await fetch('http://127.0.0.1:'+server.address().port+'/api/public-data/status')).json();
    assert.equal(data.addressSearchConfigured,true);assert.equal(data.verification,'NOT_TESTED');assert(!JSON.stringify(data).includes('synthetic-secret-value'));
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
