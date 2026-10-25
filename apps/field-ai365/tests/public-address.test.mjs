import test from 'node:test';
import assert from 'node:assert/strict';
import {createAddressSearch} from '../public-api/address.mjs';
const response=()=>({ok:true,json:async()=>({results:{common:{errorCode:'0'},juso:[{roadAddr:'검증용 도로명주소',jibunAddr:'검증용 지번',siNm:'검증시'}]}})});
test('public address lookup never calls a provider without a key or fabricates sample results',async()=>{
  let calls=0;const search=createAddressSearch({fetcher:()=>{calls++;}});
  const result=await search('검증 주소');assert.equal(result.status,'BLOCKED');assert.deepEqual(result.items,[]);assert.equal(calls,0);
});
test('public address lookup validates input before external calls',async()=>{
  let calls=0;const search=createAddressSearch({key:'synthetic-approval',fetcher:()=>{calls++;}});
  for(const keyword of ['',null,'a','x'.repeat(101)])assert.equal((await search(keyword)).status,'INVALID');
  assert.equal(calls,0);
});
test('concurrent matching searches share one call and retain official source time without leaking keys',async()=>{
  let calls=0;const search=createAddressSearch({key:'synthetic-approval',now:()=>0,fetcher:async(url,options)=>{
    calls++;assert.equal(url.origin,'https://business.juso.go.kr');assert.equal(url.searchParams.get('confmKey'),'synthetic-approval');assert.equal(options.redirect,'error');return response();
  }});
  const [a,b]=await Promise.all([search('검증   주소'),search('검증 주소')]);
  assert.equal(calls,1);assert.equal(a.status,'LIVE');assert.equal(a.items[0].addressSource.checkedAt,new Date(0).toISOString());
  a.items[0].roadAddress='changed';assert.equal(b.items[0].roadAddress,'검증용 도로명주소');
  const cached=await search('검증 주소');assert.equal(cached.cached,true);assert.equal(cached.items[0].roadAddress,'검증용 도로명주소');
  assert(!JSON.stringify(cached).includes('synthetic-approval'));
});
test('cache expiry performs a new official lookup and does not relabel a cached value as newly checked',async()=>{
  let stamp=0,calls=0;const search=createAddressSearch({key:'synthetic-approval',now:()=>stamp,fetcher:async()=>{calls++;return response();}});
  const first=await search('검증 주소');stamp=1000;assert.equal((await search('검증 주소')).source.checkedAt,first.source.checkedAt);
  stamp=300001;assert.notEqual((await search('검증 주소')).source.checkedAt,first.source.checkedAt);assert.equal(calls,2);
});
test('invalid responses and network failures remain unavailable and are never cached as successful empty results',async()=>{
  for(const fetcher of [async()=>{throw Error('synthetic-approval should not leak');},async()=>({ok:false,json:async()=>({})}),async()=>({ok:true,json:async()=>({results:{common:{errorCode:'0'},juso:[{}]}})})]){
    let calls=0;const search=createAddressSearch({key:'synthetic-approval',fetcher:async(...args)=>{calls++;return fetcher(...args);}});
    for(let i=0;i<2;i++){const result=await search('검증 주소');assert.equal(result.status,'ERROR');assert.deepEqual(result.items,[]);assert(!JSON.stringify(result).includes('synthetic-approval'));}
    assert.equal(calls,2);
  }
});
test('public address calls have a process-local minute limit; cached queries do not spend another call',async()=>{
  let stamp=0,calls=0;const search=createAddressSearch({key:'synthetic-approval',now:()=>stamp,fetcher:async()=>{calls++;return response();}});
  for(let i=0;i<60;i++)assert.equal((await search('검증 주소 '+i)).status,'LIVE');
  assert.equal((await search('검증 주소 0')).cached,true);
  assert.equal((await search('검증 주소 60')).status,'LIMITED');assert.equal(calls,60);
  stamp=60001;assert.equal((await search('검증 주소 60')).status,'LIVE');
});
