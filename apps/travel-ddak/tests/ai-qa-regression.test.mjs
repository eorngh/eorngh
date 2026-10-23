import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAutoJobs} from '../backend/auto-jobs.mjs';
import {createNativeAlbums} from '../dist/native-albums.js';
import {createPreparation} from '../dist/autopilot.js';
const trip={id:'synthetic-ai-qa',kind:'domestic',parentId:'busan',city:'해운대',start:'2090-10-20',end:'2090-10-20',days:1};
const fact={id:'123',kind:'place',title:'Previously verified place',checkedAt:'2026-10-16T00:00:00Z'};

test('a retried Firestore lease transaction must not use the claim from its aborted attempt',async()=>{
 let calls=0;
 const job={trip,timeZone:'Asia/Seoul',nextCheckAt:0,expiresAt:Date.now()+86400000,phase:'',result:null};
 const ref={};
 const tx=value=>({get:async()=>({data:()=>({jobs:{job:value}})}),set:()=>{}});
 const db={collection:()=>({doc:()=>ref,limit:()=>({get:async()=>({docs:[{id:'fixture-owner',data:()=>({jobs:{job}})}]})})}),runTransaction:async callback=>{
  // Firestore may retry after a conflicting transaction wins the lease.
  await callback(tx(job));
  await callback(tx({...job,lease:'another-worker',leaseUntil:Date.now()+180000}));
 }};
 const service=createAutoJobs({db,reserveQuota:async()=>{},officialBundle:async()=>{calls++;return {official:{status:'ok',records:[]},photos:[]};},generateAdvice:async()=>({text:'fixture'})});
 await service.tick();assert.equal(calls,0);
});

test('narrowing photo permission during a scan must not save or display the broad result',async()=>{
 const saved=[];let statuses=0;
 const native={status:async()=>({access:++statuses===1?'full':'limited',photoLocation:true}),scan:async()=>({access:'full',afterId:'1',hasMore:false,photos:[{id:'1',takenAt:Date.parse('2090-10-20T03:00:00Z'),hasLocation:false}]})};
 const albums=createNativeAlbums({storage:{getItem:()=> 'true',setItem:()=>{}},store:{saveAlbum:async a=>saved.push(a),removeAlbum:async()=>{}},changed:()=>{},isCurrent:()=>true,tripExists:()=>true,bridge:async()=>native});
 await albums.ensure(trip);assert.equal(saved.length,0);assert.equal(albums.get(trip.id).album,null);assert.equal(albums.get(trip.id).access,'limited');
});

test('partial official API failure must retain previously verified sources with their old timestamps',async()=>{
 let stamp=1,phase=0;
 const map=new Map(),storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};
 const preparation=createPreparation({storage,now:()=>stamp,request:async input=>input.mode==='prepare'?{text:'fixture summary'}:{officialStatus:phase?'partial':'ok',officialSources:phase?[]:[fact],generatedAt:'2026-10-17T00:00:00Z'}});
 preparation.setConsent(true);await preparation.ensure(trip,{date:'2026-10-16'});phase=1;stamp+=86400001;
 await preparation.ensure(trip,{date:'2026-10-17'});
 assert.equal(preparation.get(trip).sources.length,1);assert.equal(preparation.get(trip).sources[0].checkedAt,fact.checkedAt);assert.equal(preparation.get(trip).officialStatus,'partial');
});

test('permission narrowing while IndexedDB saves removes the newly saved metadata',async()=>{
 let status=0,removed=0,saved=0;
 const native={status:async()=>({access:++status<3?'full':'denied',photoLocation:true}),scan:async()=>({photos:[],afterId:'0',hasMore:false})};
 const albums=createNativeAlbums({storage:{getItem:()=> 'true'},store:{saveAlbum:async()=>saved++,removeAlbum:async()=>removed++},changed:()=>{},tripExists:()=>true,isCurrent:()=>true,bridge:async()=>native});
 await albums.ensure(trip);assert.equal(saved,1);assert.equal(removed,1);assert.equal(albums.get(trip.id).album,null);
});

test('turning off photo automation during a pending scan prevents late storage',async()=>{
 let resolve,started;const ready=new Promise(r=>started=r);let saved=0;
 const native={status:async()=>({access:'full',photoLocation:true}),scan:()=>{started();return new Promise(r=>resolve=r);}};
 const albums=createNativeAlbums({storage:{getItem:()=> 'true',setItem:()=>{}},store:{saveAlbum:async()=>saved++,removeAlbum:async()=>{}},changed:()=>{},tripExists:()=>true,isCurrent:()=>true,bridge:async()=>native});
 const task=albums.ensure(trip);await ready;albums.clear();resolve({photos:[],afterId:'0',hasMore:false});await task;assert.equal(saved,0);assert.deepEqual(albums.get(trip.id),{});
});

test('permission narrowing during stored album restoration never displays it',async()=>{
 let statuses=0,removed=0;
 const native={status:async()=>({access:++statuses===1?'full':'limited',photoLocation:true})};
 const albums=createNativeAlbums({storage:{getItem:()=> 'true'},store:{readAlbum:async()=>({photos:[{id:'private'}]}),removeAlbum:async()=>removed++},changed:()=>{},tripExists:()=>true,isCurrent:()=>true,bridge:async()=>native});
 await albums.restore(trip);assert.equal(removed,1);assert.equal(albums.get(trip.id).album,null);
});

test('server partial refresh preserves old sources without sending them as fresh Gemini facts',async()=>{
 const job={trip,timeZone:'Asia/Seoul',nextCheckAt:0,expiresAt:Date.now()+86400000,phase:'',result:{officialSources:[fact]}};let jobs={job},grounded;
 const db={collection:()=>({doc:()=>({}),limit:()=>({get:async()=>({docs:[{id:'fixture-owner',data:()=>({jobs})}]})})}),runTransaction:async fn=>fn({get:async()=>({data:()=>({jobs})}),set:(_ref,value)=>{jobs=value.jobs;}})};
 const service=createAutoJobs({db,reserveQuota:async()=>{},officialBundle:async()=>({official:{status:'partial',records:[]},photos:[]}),generateAdvice:async(_input,official)=>{grounded=official.records;return {text:'fresh-only summary',officialSources:[]};}});
 await service.tick();assert.deepEqual(grounded,[]);assert.equal(jobs.job.result.officialSources[0].checkedAt,fact.checkedAt);assert.equal(jobs.job.result.officialSources[0].carriedForward,true);assert.equal(jobs.job.state,'partial');
});
