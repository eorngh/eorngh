import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAuto,refreshPhase,autoFingerprint} from '../backend/auto-policy.mjs';
const trip={kind:'overseas',parentId:'jp',city:'후쿠오카',start:'2026-11-20',end:'2026-11-23',days:4};
test('background registration requires consent and strips notes, coordinates and credentials',()=>{
 const input={operation:'register',id:'qa-trip',consent:true,trip:{...trip,notes:'private',latitude:33,token:'secret'},timeZone:'Asia/Tokyo'};
 assert.deepEqual(normalizeAuto(input).trip,trip);
 assert.throws(()=>normalizeAuto({...input,consent:false}));
 assert.throws(()=>normalizeAuto({...input,timeZone:'Invalid/Zone'}));
 assert.throws(()=>normalizeAuto({...input,id:'../other-owner'}));
});
test('server refresh milestones use destination date, avoid daily generation before D7, and finish after return',()=>{
 const phase=date=>refreshPhase(trip,'Asia/Tokyo',Date.parse(date+'T01:00:00Z'));
 assert.equal(phase('2026-10-01'),'initial');assert.equal(phase('2026-10-21'),'d30');
 assert.equal(phase('2026-11-06'),'d14');assert.equal(phase('2026-11-07'),'d14');
 assert.equal(phase('2026-11-13'),'before:2026-11-13');assert.equal(phase('2026-11-19'),'before:2026-11-19');
 assert.equal(refreshPhase(trip,'Asia/Tokyo',Date.parse('2026-11-19T15:01:00Z')),'during:2026-11-20');
 assert.equal(phase('2026-11-24'),'complete');
});
test('a repeated official check is not a change notification, but changed dates and opening information are',()=>{
 const old=[{id:'1',title:'place',checkedAt:'old',openingHours:'미확인'}];
 assert.equal(autoFingerprint(old),autoFingerprint([{...old[0],checkedAt:'new'}]));
 assert.notEqual(autoFingerprint(old),autoFingerprint([{...old[0],openingHours:'closed'}]));
});
