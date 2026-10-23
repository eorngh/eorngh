// DOM interaction tests, not a browser engine: no layout, download or PWA claims.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {makeTrip} from '../dist/core.js';

const KEY='travel-ddak.schema1';
const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
let serial=0;
async function mount(seed,hash='#home',blocked=false){
 const {window}=parseHTML(html);const map=new Map(seed===undefined?[]:[[KEY,typeof seed==='string'?seed:JSON.stringify(seed)]]);
 let currentHash=hash;const storage={fail:false,getItem:key=>map.get(key)??null,setItem(key,value){if(this.fail)throw Error('storage write denied');map.set(key,value);},removeItem:key=>map.delete(key)};
 const location={get hash(){return currentHash;},set hash(value){currentHash=value.startsWith('#')?value:'#'+value;queueMicrotask(()=>window.dispatchEvent(new window.Event('hashchange')));}};
 Object.assign(globalThis,{window,document:window.document,location,history:{replaceState(_a,_b,url){currentHash=url;}},confirm:()=>true});
 Object.defineProperty(globalThis,'localStorage',blocked?{configurable:true,get(){throw new Error('storage blocked');}}:{configurable:true,writable:true,value:storage});
 Object.defineProperty(globalThis,'navigator',{value:{},configurable:true});
 window.scrollTo=()=>{};window.HTMLElement.prototype.focus=function(){};
 window.HTMLElement.prototype.showModal=function(){this.setAttribute('open','');};
 window.HTMLElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new window.Event('close'));};
 const blobs=[];URL.createObjectURL=blob=>{blobs.push(blob);return 'blob:test';};URL.revokeObjectURL=()=>{};
 window.HTMLAnchorElement.prototype.click=function(){};
 // Avoid long-lived toast/URL timers in the test runner only.
 const nativeTimer=globalThis.setTimeout;
 globalThis.setTimeout=(fn,ms,...args)=>{const timer=nativeTimer(fn,ms,...args);timer.unref();return timer;};
 await import('../dist/app.js?ui-test='+serial++);
 async function click(selector){const el=window.document.querySelector(selector);assert(el,'Missing control '+selector);if(el.disabled)return;el.dispatchEvent(new window.Event('click',{bubbles:true}));await tick();}
 return {window,storage,map,blobs,click,read:()=>JSON.parse(map.get(KEY)),navigate:async route=>{location.hash='#'+route;await tick();}};
}
function trip(parentId='jp',city='후쿠오카') {return makeTrip({parentId,city,start:'2090-11-20',end:'2090-11-23'},'2026-01-01');}

test('목적지·날짜 두 단계로 등록하면 조사 버튼 없이 기기 내 준비가 나타남',async()=>{
 const app=await mount();await app.click('[data-action="start"]');
 const parent=document.querySelector('#quick-parent');parent.querySelector('[value="busan"]').selected=true;parent.dispatchEvent(new window.Event('change',{bubbles:true}));
 const city=document.querySelector('#quick-city');const option=city.querySelector('[value="해운대"]');assert(option);option.selected=true;city.dispatchEvent(new window.Event('change',{bubbles:true}));
 await app.click('[data-action="quick-dates"]');
 assert(document.querySelector('.step-label').textContent.includes('2 / 2'));
 const date=[...document.querySelectorAll('[data-action="day"]')].find(b=>!b.disabled).dataset.date;
 await app.click('[data-date="'+date+'"]');await app.click('[data-date="'+date+'"]');
 await app.click('[data-action="create"]');
 assert.equal(app.read().trips[0].city,'해운대');
 assert(document.querySelector('#autopilot-panel').textContent.includes('기본 준비 ✓'));
 assert(document.querySelector('#autopilot-panel').textContent.includes('한 번만 허용'));
 assert.equal(document.querySelector('[data-action="background-disable"]'),null);
});

test('큰 지역 선택 후 해당 세부 지역만 보이고 변경·뒤로가기에도 선택이 유지됨',async()=>{
 const app=await mount();await app.click('[data-action="start"]');
 let parent=document.querySelector('#quick-parent'),city=document.querySelector('#quick-city');assert(city.disabled);
 parent.querySelector('[value="jp"]').selected=true;parent.dispatchEvent(new window.Event('change',{bubbles:true}));
 city=document.querySelector('#quick-city');assert(!city.disabled);assert(city.querySelector('[value="후쿠오카"]'));assert(!city.querySelector('[value="해운대"]'));
 city.querySelector('[value="후쿠오카"]').selected=true;city.dispatchEvent(new window.Event('change',{bubbles:true}));
 parent.querySelector('[value="busan"]').selected=true;parent.dispatchEvent(new window.Event('change',{bubbles:true}));
 city=document.querySelector('#quick-city');assert(city.querySelector('[value="해운대"]'));assert(!city.querySelector('[value="후쿠오카"]'));assert(!city.value);
 city.querySelector('[value="해운대"]').selected=true;city.dispatchEvent(new window.Event('change',{bubbles:true}));await app.click('[data-action="quick-dates"]');await app.click('[data-action="back"]');
 assert.equal(document.querySelector('#quick-parent').value,'busan');assert.equal(document.querySelector('#quick-city').value,'해운대');
});

test('최근 목적지는 한 번에 날짜 선택으로 이동',async()=>{
 const saved=trip();const app=await mount({version:1,trips:[],recents:[{parentId:saved.parentId,parentName:saved.parentName,city:saved.city,kind:saved.kind}]});
 await app.click('[data-action="start"]');await app.click('[data-action="quick-pick"]');assert(document.querySelector('.calendar'));assert(document.body.textContent.includes('후쿠오카'));
});

test('주요 카드·추천·등록 화면 이동과 직접 입력 없는 등록 흐름',async()=>{
 const app=await mount();
 await app.click('[data-action="start"]');await app.click('[data-action="browse-destination"]');assert(document.querySelector('[data-kind="overseas"]'),location.hash+' / '+document.body.textContent.slice(-600));
 await app.click('[data-kind="overseas"]');assert.equal(document.querySelectorAll('[data-action="parent"]').length,14);
 await app.click('[data-filter="유럽"]');assert.equal(document.querySelectorAll('[data-action="parent"]').length,2);
 await app.click('[data-parent="fr"]');assert(document.body.textContent.includes('파리'));
 await app.click('[data-city="파리"]');assert(document.querySelector('.calendar'));
 await app.click('[data-action="back"]');assert(document.body.textContent.includes('프랑스, 어디가'));
 await app.navigate('recommend');assert(document.body.textContent.includes('기기 내 규칙 추천'));
 await app.click('[data-kind="domestic"]');
 await app.click('[data-action="destination"]');assert(document.querySelector('.calendar'));
});

test('AI 전송은 동의와 온라인 상태가 모두 필요하며 로컬 메모 보존',async()=>{
 const t=trip();const app=await mount({version:1,trips:[t],recents:[]},'#trip/'+t.id);
 document.querySelector('#trip-notes').value='외부 전송하면 안 되는 메모';
 await app.click('[data-action="hybrid-prepare"]');
 assert(document.querySelector('#ai-status').textContent.includes('동의'));
 assert.equal(app.read().trips[0].notes,'외부 전송하면 안 되는 메모');
 document.querySelector('#ai-consent').checked=true;navigator.onLine=false;
 await app.click('[data-action="hybrid-prepare"]');
 assert(document.querySelector('#ai-status').textContent.includes('인터넷 연결'));
 assert.equal(document.querySelector('#ai-result').textContent,'');
});

test('여행 생성·중복 클릭 차단·최근 선택 저장',async()=>{
 const app=await mount();await app.click('[data-action="start"]');await app.click('[data-action="browse-destination"]');await app.click('[data-kind="overseas"]');await app.click('[data-action="parent"][data-parent="jp"]');await app.click('[data-city="후쿠오카"]');
 const days=[...document.querySelectorAll('[data-action="day"]')].filter(b=>!b.disabled);assert(days.length);
 const date=days[0].dataset.date;await app.click('[data-date="'+date+'"]');await app.click('[data-date="'+date+'"]');
 await app.click('[data-action="create"]');assert.equal(app.read().trips.length,1);assert.equal(app.read().recents[0].city,'후쿠오카');assert(document.querySelector('#trip-notes'));
});

test('저장 전 메모는 일차 이동·여행팩 내보내기 전에 보존',async()=>{
 const t=trip();const app=await mount({version:1,trips:[t],recents:[]},'#trip/'+t.id);
 document.querySelector('#trip-notes').value='일차를 바꿔도 지켜야 할 예약 주소';
 await app.click('[data-trip-day="unused"], [data-action="trip-day"][data-day="1"]');
 assert.equal(app.read().trips[0].notes,'일차를 바꿔도 지켜야 할 예약 주소');
 assert.equal(document.querySelector('#trip-notes').value,app.read().trips[0].notes);
 document.querySelector('#trip-notes').value='여행팩 저장 직전 메모';await app.click('[data-action="offline"]');
 assert.equal(app.blobs.length,1);assert((await app.blobs[0].text()).includes('여행팩 저장 직전 메모'));
});

test('저장 실패 시 화면 이동을 막고 입력 메모 유지',async()=>{
 const t=trip();const app=await mount({version:1,trips:[t],recents:[]},'#trip/'+t.id);
 document.querySelector('#trip-notes').value='저장 실패 때 남겨야 할 메모';app.storage.fail=true;
 await app.click('[data-action="trip-day"][data-day="1"]');
 assert.equal(document.querySelector('#trip-notes').value,'저장 실패 때 남겨야 할 메모');assert.equal(app.read().trips[0].notes,'');
 assert(document.querySelector('#toast').textContent.includes('저장하지 못했습니다'));
});

test('국내·해외 체크 구분, 체크·명시 저장·삭제·백업 동작',async()=>{
 const t=trip('busan','해운대');const app=await mount({version:1,trips:[t],recents:[]},'#trip/'+t.id);
 assert(!document.querySelector('.task').textContent.includes('여권'));
 const check=document.querySelector('[data-check="0"]');check.checked=true;check.dispatchEvent(new window.Event('change',{bubbles:true}));await tick();
 assert(app.read().trips[0].checks.includes(0));
 document.querySelector('#trip-notes').value='부산 메모';await app.click('[data-action="save-notes"]');assert.equal(app.read().trips[0].notes,'부산 메모');
 await app.navigate('trips');await app.click('[data-action="backup"]');assert((await app.blobs[0].text()).includes('부산 메모'));
 await app.navigate('trip/'+t.id);await app.click('[data-action="delete-trip"]');assert.equal(app.read().trips.length,1);
 assert(document.querySelector('#delete-trip-description').textContent.includes('복구할 수 없습니다'));
 await app.click('[data-action="delete-cancel"]');assert.equal(app.read().trips.length,1);
 await app.click('[data-action="delete-trip"]');window.dispatchEvent(new window.Event('travel-ddak-back'));await tick();assert.equal(app.read().trips.length,1);assert.equal(document.querySelector('#delete-trip-dialog'),null);
 await app.click('[data-action="delete-trip"]');await app.click('[data-action="delete-confirm"]');assert.equal(app.read().trips.length,0);
});

test('달력의 연도·월을 바로 선택해도 선택된 출발일이 유지됨',async()=>{
 const app=await mount();await app.click('[data-action="start"]');await app.click('[data-action="browse-destination"]');await app.click('[data-kind="domestic"]');await app.click('[data-parent="busan"]');await app.click('[data-city="해운대"]');
 let field=document.querySelector('#calendar-month');field.value='2090-01';field.dispatchEvent(new window.Event('change',{bubbles:true}));await tick();
 await app.click('[data-date="2090-01-15"]');field=document.querySelector('#calendar-month');field.value='2091-02';field.dispatchEvent(new window.Event('change',{bubbles:true}));await tick();
 assert(document.querySelector('[data-date="2091-02-01"]'));assert(document.body.textContent.includes('2090-01-15'));
});

test('검증된 백업으로 손상 데이터 복원, 손상 원본 별도 보존',async()=>{
 const t=trip();const app=await mount('{broken-json','#trips');
 const input=document.querySelector('#import-file');assert(input);
 Object.defineProperty(input,'files',{value:[{size:400,text:async()=>JSON.stringify({version:1,trips:[t],recents:[]})}]});
 input.dispatchEvent(new window.Event('change',{bubbles:true}));await tick();await tick();
 assert.equal(app.read().trips[0].id,t.id);assert([...app.map.keys()].some(key=>key.startsWith(KEY+'.recovery.')));
 assert(!document.querySelector('.error'));
});

test('국내 시도·보조 검색·기타 지역·뒤로가기 경로',async()=>{
 const app=await mount();await app.click('[data-action="start"]');await app.click('[data-action="browse-destination"]');await app.click('[data-kind="domestic"]');
 assert.equal(document.querySelectorAll('.city-card[data-action="parent"]').length,17);
 await app.click('[data-action="show-search"]');const input=document.querySelector('#parent-query');input.value='강원';input.dispatchEvent(new window.Event('input',{bubbles:true}));
 assert.equal(document.querySelectorAll('#parent-results button').length,1);await app.click('#parent-results button');
 await app.click('[data-action="other"]');document.querySelector('#other-city').value='개인 여행권역';await app.click('[data-action="custom-city"]');
 assert(document.body.textContent.includes('개인 여행권역'));await app.click('[data-action="back"]');assert(document.body.textContent.includes('강원특별자치도'));
});

test('잘못 인코딩된 여행 주소에서도 다른 화면으로 복구 가능',async()=>{
 const app=await mount(undefined,'#trip/%');
 assert(document.body.textContent.includes('여행을 찾지 못했어요'));
 await app.navigate('home');assert(document.querySelector('[data-action="start"]'));
});

test('브라우저 저장소 접근이 거부되어도 화면이 열리고 저장 실패를 안내',async()=>{
 const app=await mount(undefined,'#home',true);assert(document.querySelector('[data-action="start"]'));assert(document.querySelector('.error').textContent.includes('저장 설정'));
 await app.navigate('trips');assert(document.querySelector('[data-action="import"]'));assert(document.body.textContent.includes('백업과 복원 안내'));
});

test('체크 변경은 작성 중 메모도 보존',async()=>{
 const t=trip();const app=await mount({version:1,trips:[t],recents:[]},'#trip/'+t.id);
 document.querySelector('#trip-notes').value='체크 전 작성한 메모';
 const check=document.querySelector('[data-check="0"]');check.checked=true;
 check.dispatchEvent(new window.Event('change',{bubbles:true}));await tick();
 assert.equal(app.read().trips[0].notes,'체크 전 작성한 메모');
 assert.deepEqual(app.read().trips[0].checks,[0]);
});


test('홈은 여행 생성 버튼 하나이며 Android 뒤로가기는 이전 화면·홈 유지',async()=>{
 const app=await mount();assert.equal(document.querySelectorAll('[data-action="start"]').length,1);
 await app.click('[data-action="start"]');await app.click('[data-action="browse-destination"]');await app.click('[data-kind="domestic"]');
 window.dispatchEvent(new window.Event('travel-ddak-back'));await tick();assert.equal(location.hash,'#new');
 window.dispatchEvent(new window.Event('travel-ddak-back'));await tick();assert.equal(location.hash,'#quick');
 window.dispatchEvent(new window.Event('travel-ddak-back'));await tick();assert.equal(location.hash,'#home');
 window.dispatchEvent(new window.Event('travel-ddak-back'));await tick();assert.equal(location.hash,'#home');
});
test('직접 연 여행의 뒤로가기는 목록으로, 메모 저장 실패 시 현재 화면 보존',async()=>{
 const t=trip();const app=await mount({version:1,trips:[t],recents:[]},'#trip/'+t.id);
 document.querySelector('#trip-notes').value='뒤로가기 직전 메모';app.storage.fail=true;
 window.dispatchEvent(new window.Event('travel-ddak-back'));await tick();assert.equal(location.hash,'#trip/'+t.id);
 app.storage.fail=false;window.dispatchEvent(new window.Event('travel-ddak-back'));await tick();assert.equal(location.hash,'#trips');assert.equal(app.read().trips[0].notes,'뒤로가기 직전 메모');
});
