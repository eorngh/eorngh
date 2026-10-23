import test from 'node:test';
import assert from 'node:assert/strict';
import {loadOfficialFacts,overlaps,publicRecord} from '../backend/tour.mjs';
test('official events must overlap local travel dates and have date fields',()=>{
 assert(overlaps({eventstartdate:'20261019',eventenddate:'20261021'},'2026-10-20','2026-10-22'));
 assert(!overlaps({eventstartdate:'20261023',eventenddate:'20261025'},'2026-10-20','2026-10-22'));
 assert(!overlaps({},'2026-10-20','2026-10-22'));
});
test('TourAPI adapter fails closed and does not fabricate official records',async()=>{
 const trip={kind:'domestic',parentId:'busan',city:'해운대',start:'2026-10-20',end:'2026-10-22'};
 const failed=await loadOfficialFacts(trip,'synthetic-key',async()=>{throw Error('test failure');});
 assert.equal(failed.status,'unavailable');assert.deepEqual(failed.records,[]);
 const unsupported=await loadOfficialFacts({...trip,kind:'overseas'},'synthetic-key',()=>{throw Error('must not call');});
 assert.equal(unsupported.status,'not-covered');
 assert.equal(publicRecord({contentid:'invalid',title:'fixture'},'place','date'),null);
});
test('only provider response records are returned with attribution and unknown hours',async()=>{
 const fixture={response:{header:{resultCode:'0000'},body:{totalCount:1,items:{item:[{contentid:'123',title:'TEST FIXTURE',addr1:'TEST ADDRESS',eventstartdate:'20261020',eventenddate:'20261021'}]}}}};
 const response=await loadOfficialFacts({kind:'domestic',parentId:'busan',city:'해운대',start:'2026-10-20',end:'2026-10-22'},'synthetic-key',async()=>({ok:true,json:async()=>fixture}));
 assert.equal(response.status,'ok');assert.equal(response.records.length,2);
 assert.equal(response.records[0].openingHours,'미확인');assert.equal(response.records[0].source,'한국관광공사 TourAPI');
 assert(!JSON.stringify(response).includes('synthetic-key'));
});
