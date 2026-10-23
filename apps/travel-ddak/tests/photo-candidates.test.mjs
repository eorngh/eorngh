import {test} from 'node:test';
import assert from 'node:assert/strict';
import {classifyPhotos,tripTimeZone,distanceKm} from '../dist/photo-candidates.js';
const trip={id:'photo-trip',kind:'overseas',parentId:'jp',city:'후쿠오카',start:'2026-11-20',end:'2026-11-23',days:4};
const at=time=>Date.parse('2026-11-20T'+time+':00+09:00');
test('photos are matched by destination-local date, not the device timezone or filename',()=>{
 const a=classifyPhotos([{id:'1',takenAt:Date.parse('2026-11-19T15:05:00Z')},{id:'2',takenAt:Date.parse('2026-11-23T15:05:00Z')}],trip);
 assert.deepEqual(a.photos.map(p=>p.id),['1']);assert.equal(a.photos[0].date,'2026-11-20');assert.equal(tripTimeZone({...trip,parentId:'us',city:'하와이'}),'Pacific/Honolulu');assert.equal(tripTimeZone({...trip,parentId:'id',city:'자카르타'}),'Asia/Jakarta');
});
test('missing GPS is inferred only from two nearby time/location anchors, and remains explicitly inferred',()=>{
 const a=classifyPhotos([{id:'1',takenAt:at('10:00'),hasLocation:true,latitude:33.59,longitude:130.4},{id:'2',takenAt:at('10:20')},{id:'3',takenAt:at('10:40'),hasLocation:true,latitude:33.60,longitude:130.41}],trip);
 assert.equal(a.photos[1].match,'inferred');assert.equal(a.photos[1].hasLocation,false);assert.equal(a.photos[1].latitude,null);assert(a.photos[1].inferredLocation);
 const b=classifyPhotos([{id:'1',takenAt:at('10:00'),hasLocation:true,latitude:33.59,longitude:130.4},{id:'2',takenAt:at('12:30')}],trip);assert.equal(b.photos[1].match,'unknown');
});
test('invalid GPS, stored-date estimates and far-away locations are not silently marked as confirmed trip photos',()=>{
 const a=classifyPhotos([{id:'1',takenAt:at('10:00'),hasLocation:true,latitude:999,longitude:130},{id:'2',takenAt:at('10:20'),timeEstimated:true},{id:'3',takenAt:at('10:40'),hasLocation:true,latitude:37.5,longitude:127}],trip,{verified:true,latitude:33.59,longitude:130.4});
 assert.equal(a.photos[0].match,'unknown');assert.equal(a.photos[1].timeEstimated,true);assert.equal(a.photos[2].match,'away');assert.equal(a.photos.length,3);assert.equal(distanceKm({},{}),Infinity);
});
test('large photo sets are deduplicated and bounded without a twenty-photo manual-selection limit',()=>{
 const photos=Array.from({length:5000},(_,i)=>({id:String(i+1),takenAt:at('10:00')+i*1000}));const a=classifyPhotos([...photos,photos[0]],trip);assert.equal(a.photos.length,5000);assert(a.photos.every(p=>p.match==='unknown'));
});
