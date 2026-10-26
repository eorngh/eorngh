import test from 'node:test';import assert from 'node:assert/strict';
import {createMapProvider,KakaoMapProvider} from '../public/kakao-map.mjs';
import {ArcGISProvider} from '../public/providers.mjs';
test('기존 ArcGIS 키만 있어도 기본은 카카오, 명시적 선택 때만 ArcGIS',()=>{assert.ok(createMapProvider({key:'old-key'}) instanceof KakaoMapProvider);assert.ok(createMapProvider({provider:'arcgis',key:'old-key'}) instanceof ArcGISProvider);});
test('카카오 키 없음은 실제 호출 없이 BLOCKED',async()=>{let calls=0;const p=new KakaoMapProvider({loader:()=>calls++});await assert.rejects(p.render(null),e=>e.status==='BLOCKED');assert.equal(calls,0);});
test('카카오 일반/위성·현장 마커·클릭 좌표·정리 보존',async()=>{
 const previous=globalThis.document;globalThis.document={createElement:()=>({style:{},setAttribute(){}})};
 const handlers=[];let type,markerOptions,removed=0,selected,siteSelected;
 const sdk={LatLng:class{constructor(lat,lng){this.lat=lat;this.lng=lng;}getLat(){return this.lat;}getLng(){return this.lng;}},Map:class{setMapTypeId(t){type=t;}addControl(){}relayout(){}},Marker:class{constructor(o){markerOptions=o;}setMap(){removed++;}},MapTypeId:{HYBRID:'satellite',ROADMAP:'road'},ZoomControl:class{},ControlPosition:{RIGHT:1},event:{addListener(t,e,h){handlers.push(h);},removeListener(){}}};
 try{const p=new KakaoMapProvider({key:'test-only',loader:async()=>sdk});const container={replaceChildren(){},append(){}};const site={name:'test',latitude:37.5,longitude:127};await p.render(container,{sites:[site],satellite:true,onSelect:x=>selected=x,onSite:x=>siteSelected=x});assert.equal(type,'satellite');assert.equal(markerOptions.position.getLat(),37.5);handlers[0]({latLng:new sdk.LatLng(38,128)});handlers[1]();assert.deepEqual(selected,{latitude:38,longitude:128});assert.equal(siteSelected,site);p.destroy();assert.equal(removed,1);await p.render(container);assert.equal(type,'road');}finally{globalThis.document=previous;}
});
