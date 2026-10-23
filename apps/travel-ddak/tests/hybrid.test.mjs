import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRequest,checkQuota,buildPrompt} from '../backend/policy.mjs';
test('hybrid request excludes private notes, photos and client supplied official facts',()=>{
 const value=normalizeRequest({mode:'prepare',trip:{kind:'overseas',parentId:'jp',city:'후쿠오카',days:3,start:'2026-10-20',end:'2026-10-22',notes:'PRIVATE',photos:['PRIVATE']},officialSources:['invented']});
 assert.equal(JSON.stringify(value).includes('PRIVATE'),false);
 assert.equal('officialSources' in value,false);
 assert.ok(buildPrompt(value).systemInstruction.parts[0].text.includes('공식 관광 데이터는 아직 없다'));
});
test('translation allows bounded text and fixed target languages only',()=>{
 assert.equal(normalizeRequest({mode:'translate',language:'일본어',text:'안녕하세요'}).text,'안녕하세요');
 assert.throws(()=>normalizeRequest({mode:'translate',language:'arbitrary',text:'hello'}));
 assert.throws(()=>normalizeRequest({mode:'translate',language:'영어',text:'a'.repeat(1001)}));
});
test('global and per-user quotas stop before overflow',()=>{
 assert.equal(checkQuota(199,19,2),true);
 for(const args of [[200,0,0],[0,20,0],[0,0,3],[NaN,0,0]])assert.equal(checkQuota(...args),false);
});
