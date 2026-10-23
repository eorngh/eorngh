import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPreparation,factualDraft,journeyStage} from '../dist/autopilot.js';
import {makeOfflinePack,createPackStore} from '../dist/offline-pack.js';
const trip={id:'t1',kind:'domestic',parentId:'busan',city:'해운대',start:'2026-11-20',end:'2026-11-23',days:4,notes:'예약 비밀 메모',checks:[],stops:[]};
const record={id:'123',title:'공식 관광 후보',kind:'place',address:'부산',checkedAt:'2026-10-16T00:00:00Z',source:'한국관광공사',sourceUrl:'https://www.data.go.kr/data/15101578/openapi.do'};
function store(){const m=new Map([['travel-ddak.schema1','DO NOT MODIFY']]);return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),m};}
const official=()=>({officialStatus:'ok',officialSources:[record],generatedAt:record.checkedAt});
test('no implicit external transmission before consent, or while offline',async()=>{
 const s=store();let calls=0;const p=createPreparation({storage:s,request:async()=>{calls++;return official();}});
 await p.ensure(trip,{date:'2026-10-16'});p.setConsent(true);await p.ensure(trip,{online:false,date:'2026-10-16'});
 assert.equal(calls,0);assert.equal(s.m.get('travel-ddak.schema1'),'DO NOT MODIFY');
});
test('registration preparation deduplicates concurrent requests and survives reload without regenerating',async()=>{
 const s=store(),sent=[];const request=async input=>{sent.push(input);return input.mode==='official'?official():{text:'공식 자료 요약'};};
 const p=createPreparation({storage:s,request,now:()=>100000});p.setConsent(true);
 await Promise.all([p.ensure(trip,{date:'2026-10-16'}),p.ensure(trip,{date:'2026-10-16'})]);
 await createPreparation({storage:s,request,now:()=>100010}).ensure(trip,{date:'2026-10-16'});
 assert.equal(sent.length,2);assert.deepEqual(Object.keys(sent[0].trip).sort(),['kind','parentId','city','start','end','days'].sort());
 assert(!JSON.stringify(sent).includes(trip.notes));assert.equal(p.get(trip).text,'공식 자료 요약');
});
test('revoking consent or deleting a trip rejects late network answers',async()=>{
 for(const cancel of ['revoke','delete']){const s=store();let complete;const p=createPreparation({storage:s,request:()=>new Promise(r=>{complete=r;})});p.setConsent(true);const pending=p.ensure(trip,{date:'2026-10-16'});if(cancel==='revoke')p.setConsent(false);else p.remove(trip.id);complete(official());await pending;assert.equal(p.get(trip)?.sources?.length||0,0);if(cancel==='delete')assert.equal(p.get(trip),null);}
});
test('Gemini failure preserves official facts, backoff prevents retries on every open',async()=>{
 const s=store();let count=0;const p=createPreparation({storage:s,now:()=>1000,request:async input=>{count++;if(input.mode==='official')return official();throw {code:'functions/resource-exhausted'};}});p.setConsent(true);
 await p.ensure(trip,{date:'2026-10-16'});await p.ensure(trip,{date:'2026-10-16'});
 assert.equal(count,2);assert.equal(p.get(trip).status,'partial');assert.equal(p.get(trip).sources[0].id,'123');assert(p.get(trip).error.includes('한도'));
});
test('official provider unavailable does not replace cached facts with an empty success',async()=>{
 const s=store();let fail=false;const p=createPreparation({storage:s,request:async input=>input.mode==='official'?(fail?{officialStatus:'unavailable',officialSources:[]}:official()):{text:'요약'}});p.setConsent(true);
 await p.ensure(trip,{date:'2026-10-16'});fail=true;await p.ensure(trip,{date:'2026-10-17',force:true});assert.equal(p.get(trip).sources[0].id,'123');assert.equal(p.get(trip).status,'unavailable');
});
test('only meaningful fact changes trigger change message; checkedAt alone does not',async()=>{
 let facts=[record];const p=createPreparation({storage:store(),request:async input=>input.mode==='official'?{...official(),officialSources:facts}:{text:'요약'}});p.setConsent(true);
 await p.ensure(trip,{date:'2026-10-16'});facts=[{...record,checkedAt:'2026-10-17T00:00:00Z'}];await p.ensure(trip,{date:'2026-10-17',force:true});assert.equal(p.get(trip).changed,false);
 facts=[{...record,title:'공식 자료의 수정 제목'}];await p.ensure(trip,{date:'2026-10-18',force:true});assert.equal(p.get(trip).changed,true);
});
test('travel stage changes on start/end; completed trips cause no API requests',async()=>{
 assert.equal(journeyStage(trip,'2026-11-19').label,'D-1');assert.equal(journeyStage(trip,'2026-11-20').id,'during');assert.equal(journeyStage(trip,'2026-11-22').day,2);assert.equal(journeyStage(trip,'2026-11-24').id,'after');
 const p=createPreparation({storage:store(),request:async()=>assert.fail('past trip request')});p.setConsent(true);await p.ensure(trip,{date:'2026-11-24'});
});
test('factual drafts cannot invent places, duplicate sources or schedule events outside verified dates',()=>{
 const event={...record,id:'999',kind:'event',start:'20261122',end:'20261122'};
 const draft=factualDraft(trip,[record,record,event,{...event,id:'888',start:'20261125',end:'20261126'},null]);
 assert.equal(draft.flatMap(d=>d.items).length,2);assert.equal(draft.find(d=>d.items.some(r=>r.sourceId==='999')).date,'2026-11-22');assert(draft.flatMap(d=>d.items).every(i=>i.status==='candidate'&&!('time' in i)));
});
test('offline pack retains notes and source attribution, not credentials, photos or map promises',async()=>{
 const pack=makeOfflinePack({...trip,password:'secret',photos:['private'],latitude:35},{sources:[record],text:'요약'});
 assert.equal(pack.trip.notes,trip.notes);assert.equal(pack.sources[0].checkedAt,record.checkedAt);assert.equal(pack.phrases.length,12);assert(pack.phrases.some(([label])=>label==='병원'));assert(pack.phrases.some(([label])=>label==='탑승구'));assert(!JSON.stringify(pack).includes('secret'));assert(!JSON.stringify(pack).includes('private'));assert(pack.limits.some(s=>s.includes('지도')));
 await assert.rejects(createPackStore(null).save(pack),/지원하지/);
});
