import {test} from 'node:test';import assert from 'node:assert/strict';
import {approvedTravelTester} from '../backend/test-access.mjs';
import {createAutoJobs} from '../backend/auto-jobs.mjs';
test('AI access adds only the exact approved synthetic review identity',()=>{
 assert.equal(approvedTravelTester(null),false);
 assert.equal(approvedTravelTester({uid:'owner',token:{email:'eorngh@gmail.com'}}),true);
 assert.equal(approvedTravelTester({uid:'travelddak-play-review-da35dc7b637f',token:{email:'travelddak-play-review@example.invalid'}}),true);
 assert.equal(approvedTravelTester({uid:'wrong-uid',token:{email:'travelddak-play-review@example.invalid'}}),false);
 assert.equal(approvedTravelTester({uid:'travelddak-play-review-da35dc7b637f',token:{email:'other@example.invalid'}}),false);
});
test('unapproved callers remain denied before database access',async()=>{
 let touched=0;const service=createAutoJobs({db:{collection:()=>({doc:()=>{touched++;}})}});
 await assert.rejects(()=>service.call({auth:{uid:'wrong-uid',token:{email:'travelddak-play-review@example.invalid'}},data:{operation:'get',id:'qa'}}),e=>e.code==='permission-denied');assert.equal(touched,0);
});
