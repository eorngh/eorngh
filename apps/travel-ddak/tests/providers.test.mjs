import test from 'node:test';
import assert from 'node:assert/strict';
import {publicPhoto} from '../backend/tour-photo.mjs';
import {mapFrameUrl,photoPanel} from '../dist/hybrid.js';
import {normalizeRequest,checkQuota,MAP_LIMITS} from '../backend/policy.mjs';
test('photo attribution and trusted image origin required',()=>{
 const p={galContentId:'123',galPhotographer:'Author',galTitle:'<b>Place</b>',galWebImageUrl:'https://tong.visitkorea.or.kr/a.jpg'};
 assert.equal(publicPhoto(p,'now').title,'Place');
 assert.equal(publicPhoto({...p,galWebImageUrl:'https://evil.example/a.jpg'},'now'),null);
 assert.equal(photoPanel([{imageUrl:'javascript:alert(1)',photographer:'x'}]),'');
 assert.ok(photoPanel([{imageUrl:p.galWebImageUrl,photographer:'<script>',title:'x'}]).includes('&lt;script&gt;'));
});
test('map frames reject foreign origins and unexpected paths',()=>{
 assert.ok(mapFrameUrl('https://www.google.com/maps/embed/v1/place?q=Busan'));
 for(const u of ['https://evil.example/maps/embed/v1/place','https://www.google.com/search','javascript:alert(1)'])assert.throws(()=>mapFrameUrl(u));
});
test('official refresh has independent bounded lookup quota',()=>{
 const t={kind:'domestic',parentId:'busan',city:'해운대',days:3,start:'2026-10-20',end:'2026-10-22'};
 assert.equal(normalizeRequest({mode:'official',trip:t}).mode,'official');
 assert.equal(checkQuota(199,19,3,MAP_LIMITS),true);
 assert.equal(checkQuota(0,0,20,MAP_LIMITS),false);
});
