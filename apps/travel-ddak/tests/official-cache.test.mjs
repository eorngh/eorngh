import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createOfficialCache} from '../backend/official-cache.mjs';
const trip={kind:'domestic',parentId:'busan',city:'해운대',start:'2026-11-20',end:'2026-11-23'};
test('official cache deduplicates concurrent lookups and expires; returned values cannot mutate shared cache',async()=>{
 let count=0,time=100;const load=createOfficialCache(async()=>{count++;return {official:{status:'ok',records:[{id:'1'}]},photos:[]};},{now:()=>time,ttl:10});
 const [a,b]=await Promise.all([load(trip),load(trip)]);assert.equal(count,1);a.official.records[0].id='changed';assert.equal(b.official.records[0].id,'1');assert.equal((await load(trip)).official.records[0].id,'1');
 time=111;await load(trip);assert.equal(count,2);await load({...trip,end:'2026-11-24'});assert.equal(count,3);
});
test('provider unavailable responses are not cached as a successful empty result',async()=>{
 let count=0;const load=createOfficialCache(async()=>{count++;return {official:{status:'unavailable',records:[]},photos:[]};});await load(trip);await load(trip);assert.equal(count,2);
});
