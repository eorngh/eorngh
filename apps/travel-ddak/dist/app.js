import {ALL,COUNTRIES,PROVINCES,CHECKS,checklistFor,today,daysBetween,dayAt,pickDate,esc,place,makeTrip,validateState,addRecent,recommend,offlineHtml} from './core.js';
import {itineraryPanel} from './itinerary.js';
import {hybridPanel,officialPanel,photoPanel,mapFrameUrl} from './hybrid.js';
import {createPreparation,preparationPanel} from './autopilot.js';
import {createPackStore,makeOfflinePack} from './offline-pack.js';
import {tripTimeZone,nativeAlbumPanel} from './photo-candidates.js';
import {createNativeAlbums} from './native-albums.js';
import {cloudPanel} from './cloud-panel.js';
import {entryPanel} from './entry.js';
import {createBackgroundConsent} from './background-consent.js';
import {setupUpdates} from './updates.js';
const KEY='travel-ddak.schema1';const main=document.querySelector('main');
let deviceStorage;try{deviceStorage=globalThis.localStorage;if(!deviceStorage)throw Error('저장소 접근 불가');}catch{const unavailable=()=>{throw Error('기기 저장소에 접근할 수 없습니다. 브라우저 설정을 확인하세요.');};deviceStorage={getItem:unavailable,setItem:unavailable,removeItem:unavailable};}
let selectedAlbum=null,albumBusy=false;
let cloudStatus='로그인하면 다른 기기와 여행 사본을 주고받을 수 있어요.',cloudBusy=false,cloudSession=null,cloudEpoch=0;
function paintCloud(){const panel=document.querySelector('#cloud-panel');if(panel)panel.outerHTML=cloudPanel(cloudSession,cloudStatus);}
async function refreshCloudSession(){const epoch=++cloudEpoch;try{const cloud=await import('./cloud.js'),session=await cloud.session();if(epoch!==cloudEpoch||cloudBusy)return;cloudSession=session;if(session&&cloudStatus.startsWith('로그인하면'))cloudStatus='연결되었습니다. 저장 전 클라우드 사본을 확인하세요.';paintCloud();}catch{/* Local trips remain available without account connectivity. */}}
let hybridBusy=false;
let notesTimer;
const routeTrail=[location.hash||'#home'];let returningRoute=null;
function navigateBack(){
 const dialog=document.querySelector('#delete-trip-dialog');if(dialog?.hasAttribute('open')){dialog.close();return;}
 savePendingNotes();
 const route=location.hash||'#home';
 if(route==='#home'){toast('첫 화면입니다. 홈 버튼이나 최근 앱 화면으로 이동할 수 있어요.');return;}
 const previous=routeTrail.length>1?routeTrail[routeTrail.length-2]:route.startsWith('#trip/')?'#trips':({dates:'#cities',cities:'#regions',regions:'#new',new:'#home'})[route.slice(1)]||'#home';
 returningRoute=previous;if(routeTrail.length>1)routeTrail.pop();location.hash=previous;
}
window.addEventListener('travel-ddak-back',()=>{try{navigateBack();}catch(error){toast('메모를 저장하지 못했습니다. 화면을 유지합니다. '+error.message);}});
let state={version:1,trips:[],recents:[]},loadError='',draft={kind:'',parentId:'',city:'',start:'',end:''},filter='인기',month=today().slice(0,7),tags=['자연'],recommendKind='all',selectedDay=0,installPrompt,lastRoute=location.hash||'#home';
try{const raw=deviceStorage.getItem(KEY);if(raw)state=validateState(JSON.parse(raw));}catch(e){loadError='저장된 여행을 읽지 못했습니다. 브라우저 저장 설정을 확인하고, 보관한 백업이 있다면 복원해 주세요.';}
function toast(text){const el=document.querySelector('#toast');el.textContent=text;el.style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.style.display='none',4500);}
function commit(next){if(loadError)throw Error(loadError);const safe=validateState(next);deviceStorage.setItem(KEY,JSON.stringify(safe));state=safe;}
function savePendingNotes(){
 const input=document.querySelector('#trip-notes');if(!input)return;
 const trip=state.trips.find(t=>t.id===input.dataset.tripId);
 if(trip&&input.value!==trip.notes){
  if(input.value.length>5000)throw Error('메모는 최대 5,000자입니다.');
  commit({...state,trips:state.trips.map(t=>t.id===trip.id?{...t,notes:input.value}:t)});
  queuePack(state.trips.find(t=>t.id===trip.id));
 }
}
function go(route){if(location.hash==='#'+route)render();else location.hash=route;}
const packs=createPackStore(),packReady=new Map(),packJobs=new Map();
const nativePhotos=window.Capacitor?.isNativePlatform?.()?createNativeAlbums({storage:deviceStorage,store:packs,changed:updateNativePhotos,isCurrent:id=>currentTrip()?.id===id,tripExists:id=>state.trips.some(t=>t.id===id)}):null;
function updateNativePhotos(id,photoState){if(currentTrip()?.id!==id)return;const panel=document.querySelector('#native-photos');if(panel){panel.outerHTML=nativeAlbumPanel(currentTrip(),photoState);nativePhotos.previews(currentTrip()).catch(()=>{});}}
const backgroundTrips=createBackgroundConsent(deviceStorage,state.trips.map(t=>t.id));
const preparation=createPreparation({storage:deviceStorage,request:async data=>{const cloud=await import('./cloud.js');if(!backgroundTrips.has(data.id))return cloud.hybrid(data);const result=await cloud.autoJobs({operation:data.mode==='official'?'register':'get',id:data.id,trip:data.trip,timeZone:tripTimeZone(data.trip),consent:true});if(data.mode==='prepare'&&!result?.text)throw Error('server-ai-unavailable');return result;},onChange:id=>{const t=state.trips.find(t=>t.id===id);if(t){queuePack(t);updatePreparation(t);}}});
function updatePreparation(t){if(currentTrip()?.id!==t.id)return;const entry=document.querySelector('#entry-panel');if(entry)entry.outerHTML=entryPanel(t,preparation.get(t));const panel=document.querySelector('#autopilot-panel');if(panel)panel.outerHTML=preparationPanel(t,preparation.get(t),{consent:preparation.hasConsent(),background:backgroundTrips.has(t.id),pack:packReady.has(t.id)});}
function queuePack(t){
 if(!globalThis.indexedDB)return;
 const record=preparation.get(t),fingerprint=JSON.stringify([t,record]);if(packReady.get(t.id)===fingerprint)return;
 packReady.delete(t.id);updatePreparation(t);
 const pack=makeOfflinePack(t,record),pending=packJobs.get(t.id)||Promise.resolve();
 const job=pending.catch(()=>{}).then(()=>state.trips.some(x=>x.id===t.id)?packs.save(pack):undefined).then(()=>{if(state.trips.some(x=>x.id===t.id)){packReady.set(t.id,fingerprint);updatePreparation(t);displayPack(t);}}).catch(()=>{const panel=document.querySelector('#autopilot-panel');if(currentTrip()?.id===t.id&&panel&&!panel.querySelector('.pack-error'))panel.insertAdjacentHTML('beforeend','<p class="error pack-error">여행팩을 저장하지 못했습니다. 기존 여행은 유지됩니다. 저장 공간을 확인하고 파일 백업을 보관하세요.</p>');});
 packJobs.set(t.id,job);
}
function resumePreparation(force=false,photos=false){const t=currentTrip();if(!t)return;queuePack(t);updatePreparation(t);preparation.ensure(t,{online:navigator.onLine!==false,force}).catch(()=>toast('자동 준비 상태를 저장하지 못했습니다. 기존 여행은 보존됩니다.'));if(photos)nativePhotos?.ensure(t).catch(()=>{});}
async function displayPack(t){
 try{const pack=await packs.read(t.id);if(!pack||currentTrip()?.id!==t.id)return;const previous=document.querySelector('#offline-pack-view');const replace=html=>{if(previous)previous.outerHTML=html;else document.querySelector('#autopilot-panel')?.insertAdjacentHTML('afterend',html);};replace('<details class="panel" id="offline-pack-view" '+(previous?.open||navigator.onLine===false?'open':'')+'><summary>기기에 보관된 여행팩 · 기본 회화</summary><p class="note">기기 저장소에서 읽음 · '+esc(pack.savedAt)+'<br>오프라인 지도·예약 티켓·확정 입국 요건은 포함되지 않습니다.</p><h3>상황별 기본 회화</h3>'+pack.phrases.map(([label,text])=>'<article class="phrase"><strong>'+esc(label)+'</strong><p lang="'+(t.parentId==='jp'?'ja':'en')+'">'+esc(text)+'</p></article>').join('')+'<h3>보관된 관광 자료</h3>'+(pack.sources.length?pack.sources.map(s=>'<p>'+esc(s.title)+'<br>'+esc(s.address)+'<small>'+esc(s.source)+' · '+esc(s.checkedAt)+'</small></p>').join(''):'<p>확인된 관광 자료가 없어 기본 준비 내용만 보관했습니다.</p>')+entryPanel(t,{entry:pack.entry}).replace('id="entry-panel"','')+'<h3>내 메모</h3><p class="ai-summary">'+esc(pack.trip.notes||'별도 메모 없음')+'</p></details>');}catch{/* A failed pack never replaces the normal local travel view. */}
}
function quickScreen(){
 const parent=ALL.find(p=>p.id===draft.parentId);
 const cities=parent?[...parent.cities,...(draft.city&&!parent.cities.includes(draft.city)?[draft.city]:[])]:[];
 const recent=state.recents.length?'<div class="quick-recents"><span class="quick-recents-label">최근 살펴본 곳</span><div class="recent">'+state.recents.map(p=>'<button type="button" data-action="quick-pick" data-parent="'+esc(p.parentId)+'" data-city="'+esc(p.city)+'">'+esc(p.city)+' <small>('+esc(p.parentName)+')</small></button>').join('')+'</div></div>':'';
 const options=items=>items.map(p=>'<option value="'+esc(p.id)+'" '+(p.id===draft.parentId?'selected':'')+'>'+esc(p.kind==='overseas'?p.flag+' '+p.name:p.name)+'</option>').join('');
 return '<div class="step-wrap"><button class="back" data-action="back">← 이전으로</button><p class="eyebrow">여행 준비 시작</p><h1>어디로, 언제 떠나세요?</h1><p>나라 또는 시·도를 먼저 고르면 해당 지역의 도시를 선택할 수 있어요.</p><section class="panel">'+recent+'<label for="quick-parent">1. 큰 지역 · 나라 또는 시·도</label><select id="quick-parent"><option value="">나라 또는 시·도 선택</option><optgroup label="국내 시·도">'+options(PROVINCES)+'</optgroup><optgroup label="해외 국가">'+options(COUNTRIES)+'</optgroup></select><label for="quick-city">2. 세부 지역 · 도시 또는 관광권역</label><select id="quick-city" '+(!parent?'disabled':'')+'><option value="">'+(parent?'세부 지역 선택':'먼저 큰 지역을 선택하세요')+'</option>'+cities.map(city=>'<option value="'+esc(city)+'" '+(city===draft.city?'selected':'')+'>'+esc(city)+'</option>').join('')+'</select><button class="primary full" data-action="quick-dates">날짜 고르기 →</button><details><summary>국내·해외 카드로 천천히 고르기</summary><button class="linkbtn" data-action="browse-destination">지역 카드 열기</button></details></section></div>';
}
const image=(name)=>'./assets/'+name+'.jpg';
function photo(parent){return '<img loading="lazy" src="./assets/journey-'+({coast:'coast',city:'city',japan:'nature'}[parent.image]||'nature')+'.svg" alt="여행 테마 일러스트 · 실제 지역 사진 아님">';}
function cityCard(parent,city,subtitle='') {return '<button class="place" data-action="destination" data-parent="'+esc(parent.id)+'" data-city="'+esc(city)+'"><div class="place-photo">'+photo(parent)+'<span class="flag">'+parent.flag+'</span></div><div class="place-body"><strong>'+esc(city)+'</strong><small>'+esc(subtitle||parent.name)+'</small></div></button>';}
function step(title,description,index,total=4){return '<div class="step-wrap"><button class="back" data-action="back">← 이전으로</button><div class="step-head"><span class="step-label">MAKE YOUR TRIP · '+index+' / '+total+'</span><h1>'+title+'</h1><p>'+description+'</p></div><div class="progress"><span style="width:'+(index/total*100)+'%"></span></div>';}
function home(){
 return '<section class="hero"><div class="hero-content"><p class="eyebrow">가볍게 떠나는 준비</p><h1>다음 여행도,<br>준비는 <span>딱.</span></h1><p>목적지와 날짜만 정하세요.<br>여행 준비를 차근차근 챙길게요.</p><button class="primary" data-action="start">여행지가 정해졌어요 <span aria-hidden="true">↗</span></button><a class="secondary hero-discover" href="#recommend">어디 갈지 딱 골라줘 →</a></div><img class="hero-art" src="./assets/journey-hero.svg" alt="바다와 산, 기차와 여행 가방을 그린 여행딱 일러스트"></section>'+
 (state.recents.length?'<section class="recent-section"><h2>최근 살펴본 여행지</h2><div class="recent">'+state.recents.slice(0,4).map(p=>'<button data-action="destination" data-parent="'+esc(p.parentId)+'" data-city="'+esc(p.city)+'">'+esc(p.city)+' <span aria-hidden="true">↗</span></button>').join('')+'</div></section>':'')+
 '<div class="section-heading"><h2>내 여행</h2>'+(state.trips.length>2?'<a href="#trips">전체 '+state.trips.length+'개 보기 →</a>':'')+'</div>'+(state.trips.length?tripCards(state.trips.slice(0,2)):'<div class="empty-trips"><span aria-hidden="true">⌁</span><p>아직 저장한 여행이 없어요.<br>여행을 만들면 이곳에서 이어서 준비할 수 있어요.</p></div>');
}
function kindScreen(){return step('어디로 떠나볼까요?','여행의 시작, 두 가지 중 하나를 골라주세요.',1)+'<div class="choice-grid"><button class="large-choice" data-action="kind" data-kind="domestic"><img src="'+'./assets/journey-coast.svg'+'" alt="국내 바다 여행 일러스트"><div><h2>🇰🇷 국내여행</h2><p>가까운 곳에도 새로운 풍경이 있어요.</p></div></button><button class="large-choice" data-action="kind" data-kind="overseas"><img src="'+'./assets/journey-city.svg'+'" alt="도시 여행 일러스트"><div><h2>✈️ 해외여행</h2><p>새로운 언어와 풍경을 만나러 가요.</p></div></button></div><p class="note">목록에 없는 곳은 다음 단계의 보조 검색으로 추가할 수 있어요.</p></div>';}
function regionScreen(){const domestic=draft.kind==='domestic';const parents=domestic?PROVINCES:COUNTRIES.filter(p=>filter==='전체'||filter==='인기'||p.group===filter);
 return step(domestic?'어느 지역으로 갈까요?':'어느 나라로 떠나볼까요?',domestic?'광역지역을 선택하면 관광권역을 보여드려요.':'카드를 누르면 주요 도시와 여행지역을 보여드려요.',2)+(!domestic?'<div class="filters" role="group" aria-label="대륙 선택">'+['인기','아시아','미주','유럽','오세아니아','전체'].map(x=>'<button class="chip '+(x===filter?'active':'')+'" data-action="filter" data-filter="'+x+'" aria-pressed="'+(x===filter)+'">'+x+'</button>').join('')+'</div>':'')+
 '<div class="'+(domestic?'city-grid':'grid')+'">'+parents.map(p=>domestic?'<button class="city-card" data-action="parent" data-parent="'+p.id+'">'+p.name+'</button>':'<button class="place" data-action="parent" data-parent="'+p.id+'"><div class="place-photo">'+photo(p)+'<span class="flag">'+p.flag+'</span></div><div class="place-body"><strong>'+p.name+'</strong><small>'+p.cities.slice(0,3).join(' · ')+'</small></div></button>').join('')+'</div>'+
 '<p class="note">지역 카드를 선택하면 관광권역을 볼 수 있습니다. 목록은 편집 기준이며 실시간 인기 순위가 아닙니다.</p><div class="search-box"><button class="linkbtn" data-action="show-search">⌕ 목록에서 찾기</button><div id="parent-search" hidden><label for="parent-query">등록된 국가·지역 검색</label><input id="parent-query" placeholder="목록에 없을 때만 검색" autocomplete="off"><div id="parent-results" class="recent"></div><p class="muted">아직 등록되지 않은 국가는 이번 개발판에서 지원하지 않습니다.</p></div></div></div>';}
function cityScreen(){const parent=ALL.find(p=>p.id===draft.parentId);if(!parent)return kindScreen();return step(esc(parent.name)+', 어디가 좋을까요?','도시와 관광권역 중 여행할 곳을 골라주세요.',3)+'<div class="city-grid">'+parent.cities.map(city=>'<button class="city-card" data-action="destination" data-parent="'+parent.id+'" data-city="'+esc(city)+'">'+esc(city)+' <span style="color:var(--blue)">↗</span></button>').join('')+'<button class="city-card" data-action="destination" data-parent="'+parent.id+'" data-city="'+esc(parent.name)+' 전체">지역 전체</button><button class="city-card" data-action="other">기타 지역 · 찾기</button></div>'+
 (parent.id==='us'?'<p class="note">괌은 미국의 비편입 영토입니다. 별도 여행권역 데이터로 다루며, 이 도시 목록에 포함하지 않았습니다.</p>':'')+
 '<div id="other-region" class="search-box" hidden><label for="other-city">목록에 없는 여행지역</label><input id="other-city" maxlength="80" placeholder="도시 또는 관광권역 이름"><button class="secondary" data-action="custom-city">이 지역 선택</button></div><p class="note">관광권역과 행정구역을 함께 보여드립니다. 사진·영업 정보는 아직 지역별로 연결되지 않았습니다.</p></div>';}
function calendarScreen(){if(!draft.parentId||!draft.city)return kindScreen();const [year,m]=month.split('-').map(Number);const first=new Date(Date.UTC(year,m-1,1)).getUTCDay();const count=new Date(Date.UTC(year,m,0)).getUTCDate();const weeks=['일','월','화','수','목','금','토'];let cells=weeks.map(w=>'<div class="weekday">'+w+'</div>').join('')+'<span></span>'.repeat(first);
 for(let d=1;d<=count;d++){const value=month+'-'+String(d).padStart(2,'0');const chosen=value===draft.start||value===draft.end;cells+='<button class="day '+(chosen?'selected':draft.start&&draft.end&&value>draft.start&&value<draft.end?'between':'')+'" data-action="day" data-date="'+value+'" '+(value<today()?'disabled':'')+' aria-label="'+value+'" aria-pressed="'+chosen+'">'+d+'</button>';}
 let summary='출발일과 돌아오는 날을 선택해 주세요.';try{if(draft.start&&draft.end){const n=daysBetween(draft.start,draft.end);summary='<strong>'+(n===1?'당일 여행':(n-1)+'박 '+n+'일')+'</strong>'+draft.start+' → '+draft.end;}}catch(e){summary='<span class="error">'+esc(e.message)+'</span>';}
 return step('언제 떠나시나요?','출발일과 마지막 날을 차례로 눌러주세요. 당일 여행은 같은 날짜를 두 번 누르세요.',draft.quick?2:4,draft.quick?2:4)+'<div class="calendar-layout"><section class="panel"><div class="calendar-head"><button data-action="month" data-step="-1" aria-label="이전 달">‹</button><label class="calendar-month-label" for="calendar-month">연도·월 선택<input type="month" id="calendar-month" aria-label="달력 연도와 월 선택" value="'+month+'"></label><button data-action="month" data-step="1" aria-label="다음 달">›</button></div><div class="calendar">'+cells+'</div></section><aside class="panel"><span class="pill">'+esc(draft.kind==='domestic'?'국내여행':'해외여행')+'</span><h2 style="margin-top:14px">'+esc(draft.city)+'</h2><p>'+esc(ALL.find(p=>p.id===draft.parentId).name)+'</p><div class="date-summary">'+summary+'</div><p class="muted">출발 '+(draft.start||'미선택')+'<br>귀국·귀가 '+(draft.end||'미선택')+'</p><button class="primary full" data-action="create" '+(!draft.start||!draft.end?'disabled':'')+'>바로 여행 만들기 →</button><p class="note">이 기기에 저장됩니다. 로그인·결제는 필요 없어요.</p></aside></div></div>';}
function tripCards(trips){return trips.map(t=>'<article class="trip"><div><span class="pill">'+(t.kind==='domestic'?'국내':'해외')+' · '+t.days+'일</span><h3>'+esc(t.city)+'</h3><p>'+t.start+' ~ '+t.end+' · '+esc(t.parentName)+'</p></div><a class="secondary" href="#trip/'+encodeURIComponent(t.id)+'">여행 열기 →</a></article>').join('');}
function tripsScreen(){return '<div class="section-heading"><div><p class="eyebrow">MY JOURNEYS</p><h1 style="font-size:36px">내 여행</h1></div><button class="primary" data-action="start">＋ 새 여행</button></div>'+(state.trips.length?tripCards(state.trips):'<div class="empty"><div class="big">🧳</div><h2>다음 여행을 기다리고 있어요</h2><p>여행지를 고르고, 설렘을 저장해 보세요.</p><button class="primary" data-action="start">여행 만들기</button></div>')+'<div class="panel"><h3>PC에서 준비하고, 휴대폰으로 가져가세요</h3><p class="muted">여행·직접 기록한 일정·메모·체크를 파일로 보관해요. 기기 저장 정보가 지워지거나 기기를 바꾸기 전에 백업하세요. 공유 전 개인 정보를 확인하세요.</p><details><summary>백업과 복원 안내</summary><p class="note">사진·앨범 정리 결과와 온라인 관광 조회 자료는 이 백업에 포함되지 않습니다. Safari와 홈 화면에 추가한 웹앱은 저장소가 분리될 수 있으니, 옮기기 전에 백업하고 새 화면에서 가져오세요.</p></details><div class="inline-actions"><button class="secondary" data-action="backup">전체 여행 백업</button><button class="secondary" data-action="import">여행 백업 가져오기</button></div><input id="import-file" type="file" accept="application/json,.json" hidden></div>';}
function currentTrip(){let id;try{id=decodeURIComponent(location.hash.slice(6));}catch{return undefined;}return state.trips.find(t=>t.id===id);}
function tripScreen(){const t=currentTrip();if(!t)return '<div class="empty"><h2>여행을 찾지 못했어요</h2><a class="secondary" href="#trips">내 여행으로</a></div>';selectedDay=Math.min(selectedDay,t.days-1);const CHECKS=checklistFor(t);return '<button class="back" data-action="route" data-route="trips">← 내 여행</button><div class="trip-cover"><h1>'+esc(t.city)+'<span style="display:block;font-size:15px;font-weight:500;margin-top:8px">'+t.start+' — '+t.end+' · '+t.days+'일</span></h1></div><div class="detail-layout"><div><div class="panel"><h2>메모·예약 기록 · 선택 사항</h2><div class="filters">'+Array.from({length:t.days},(_,i)=>'<button class="chip '+(selectedDay===i?'active':'')+'" data-action="trip-day" data-day="'+i+'">'+(i+1)+'일차</button>').join('')+'</div><span class="pill">'+dayAt(t.start,selectedDay)+'</span><div class="timeline"><span class="number">1</span><div><h3>가고 싶은 곳을 골라보세요</h3><p>아직 장소를 추가하지 않았습니다. 동선 자동 생성은 관광 정보 연동 후 제공할 예정입니다.</p></div></div><label for="trip-notes">여행 메모 · 주소 · 예약 확인 사항</label><textarea id="trip-notes" data-trip-id="'+esc(t.id)+'" rows="6" maxlength="5000" placeholder="예약 번호 등 내가 보관할 내용만 적어주세요. 비워 두어도 여행 준비는 진행됩니다.">'+esc(t.notes)+'</textarea><button class="secondary" data-action="save-notes" style="margin-top:12px">메모 저장</button></div><p class="note">관광 자료와 직접 기록한 장소는 구분해 보관해요. <a href="#about">지원 기능·개발 상태 보기 →</a></p></div><aside><div class="panel"><h3>출발 전 체크</h3>'+CHECKS.map((c,i)=>'<div class="task"><input type="checkbox" id="check-'+i+'" data-check="'+i+'" '+(t.checks.includes(i)?'checked':'')+'><label for="check-'+i+'" class="'+(t.checks.includes(i)?'done':'')+'">'+c+'</label></div>').join('')+'<button class="primary full" data-action="offline" style="margin-top:22px">↓ 메모·체크 HTML 내보내기</button><p class="note">이 버튼은 보조 HTML 파일 저장입니다. 별도의 기기 내 여행팩은 자동으로 저장하며, 지도·티켓은 포함되지 않아요. 화면 이동과 여행팩 저장 시에도 메모를 저장합니다.</p><button class="linkbtn" data-action="delete-trip">이 여행 삭제</button></div><p class="note">아래에서 선택한 사진을 기기 안에서 정리하고 앨범으로 저장할 수 있습니다.</p></aside></div>';}
function recommendScreen(){const options=['맛집','자연','휴식','쇼핑','문화','사진','산책','가족'];const recommendations=recommend(tags,recommendKind).slice(0,3);return '<div class="step-wrap"><button class="back" data-action="route" data-route="home">← 홈으로</button><p class="eyebrow">FIND YOUR NEXT PLACE</p><h1 style="font-size:35px">어떤 여행이 끌리세요?</h1><p>좋아하는 것을 골라주세요. 여행지 선택의 첫 단서를 드릴게요.</p><span class="pill">기기 내 규칙 추천 · AI 도우미는 여행 상세에서 별도 요청</span><div class="filters">'+[['all','전체'],['domestic','국내'],['overseas','해외']].map(([id,label])=>'<button class="chip '+(recommendKind===id?'active':'')+'" data-action="rec-kind" data-kind="'+id+'">'+label+'</button>').join('')+'</div><div class="options">'+options.map((t,i)=>'<button class="chip '+(tags.includes(t)?'option-chosen':'')+'" aria-pressed="'+tags.includes(t)+'" data-action="tag" data-tag="'+t+'">'+['🍜','🌿','☕','🛍️','🏛️','📷','🚶','👨‍👩‍👧'][i]+' '+t+'</button>').join('')+'</div><h2>이런 여행을 생각해 볼까요?</h2>'+recommendations.map(r=>{const p=ALL.find(x=>x.id===r.parent);return '<article class="recommend">'+photo(p)+'<div><span class="muted">'+p.name+'</span><h3>'+r.city+'</h3><p>'+r.reason+'</p><p class="muted">선택과 겹치는 테마: '+(r.matches.join(' · ')||'탐색 추천')+'</p></div><button class="secondary" data-action="destination" data-parent="'+p.id+'" data-city="'+r.city+'">여기로 선택</button></article>';}).join('')+'<p class="note">취향 태그 일치로 정렬한 탐색용 제안입니다. 계절·날씨·예산·항공편·행사 개최 여부를 확인한 결과가 아닙니다. AI 호출이나 비용은 발생하지 않습니다.</p></div>';}
function aboutScreen(){return '<article class="prose"><p class="eyebrow">TRAVEL DDAK · 0.3.1 개발판</p><h1>알아서 준비하는 여행 비서</h1><h2>구현 완료</h2><p>목적지·날짜 등록, 기기 내 준비 항목, 메모·체크·직접 일정, 백업·가져오기와 기본 회화. 온라인 허용·인증 후 국내 공식 관광 조회와 Gemini 요약을 자동 요청합니다. 주소·메모·회화는 IndexedDB 여행팩으로 자동 저장합니다. HTML 내보내기는 별도 보조 기능입니다.</p><h2>부분 구현</h2><p>공식 장소 ID를 근거로 Gemini가 날짜별 방문 후보를 구성합니다. 이동·영업시간을 검증한 실행 일정은 아닙니다. 서버 자동 준비는 별도 허용한 여행에 한해 출발 단계와 날짜에 맞춰 다시 조회하며 호출 한도 안에서 실행합니다. 휴대폰 푸시 알림은 미연결입니다. 취향 추천은 기기 내 태그 규칙이며 실시간 AI 추천은 아닙니다.</p><h2>Android 사진 정리 · 검증 중</h2><p>사진 접근을 직접 허용하면 여행 날짜의 사진 메타데이터를 기기에서 조회해 후보와 앱 내 앨범으로 정리합니다. GPS가 없는 사진도 후보로 보관하며 추정 위치는 표시합니다. 원본·얼굴·표정을 변경하거나 서버에 업로드하지 않습니다. 음식·랜드마크 이미지 AI 분류와 앱 종료 중 사진 검색은 미구현입니다.</p><h2>외부 연결 필요</h2><p>일본 입국 안내는 일본 외무성 원문 조회·확인 시각을 보관합니다. 개인별 입국 심사는 판정하지 않습니다. 다른 국가의 입국 정보·해외 관광·기상·교통·경로는 미구현입니다. Android Google 로그인은 연결했으며 실제 계정 인증 완료는 검증 중입니다. 오프라인 지도·예약 티켓은 여행팩에 포함되지 않습니다. 행사·가격·운영시간·규정을 임의 생성하지 않습니다.</p><h2>개인정보와 저장</h2><p>여행은 기기에 보관합니다. 선택적 클라우드 사본은 사용자가 저장할 때만 전송합니다. 별도 서버 자동 준비를 허용하면 여행지·지역·날짜·일수·시간대와 조회·요약 결과를 Firebase에 보관해 갱신하며 종료 후 최대 8일 내 삭제합니다. 메모·사진·예약은 자동 준비 서버로 보내지 않습니다. 지원 계정·호출 한도가 적용됩니다. 광고·분석 SDK는 없습니다. 기기 변경 전 파일 백업을 보관하세요.</p><h2>그래픽</h2><p>직접 제작한 여행 테마 SVG이며 실제 지역 사진이 아닙니다.</p><div class="inline-actions"><button class="secondary" data-action="backup">여행 백업</button><button class="linkbtn" data-action="reset">이 기기 여행 정보 삭제</button></div></article>';}
function render(){let route=location.hash.slice(1)||'home';let body;
 try{if(route==='home')body=home();else if(route==='quick')body=quickScreen();else if(route==='new')body=kindScreen();else if(route==='regions')body=draft.kind?regionScreen():kindScreen();else if(route==='cities')body=cityScreen();else if(route==='dates')body=calendarScreen();else if(route==='trips')body=tripsScreen();else if(route.startsWith('trip/'))body=tripScreen();else if(route==='recommend')body=recommendScreen();else body=aboutScreen();}
 catch(e){body='<div class="empty"><h2>화면을 열지 못했어요</h2><p>'+esc(e.message)+'</p><a href="#home" class="secondary">홈으로</a></div>';}
 main.innerHTML=(loadError?'<div class="error">'+esc(loadError)+' <button data-action="backup">원본 백업</button><button data-action="reset">초기화</button></div>':'')+body;
 if(route==='trips'){main.insertAdjacentHTML('beforeend',cloudPanel(cloudSession,cloudStatus));refreshCloudSession();}
 if(route.startsWith('trip/')&&currentTrip()){
  const t=currentTrip(),album=selectedAlbum?.tripId===t.id?selectedAlbum:null;
  main.querySelector('.trip-cover').insertAdjacentHTML('afterend',preparationPanel(t,preparation.get(t),{consent:preparation.hasConsent(),background:backgroundTrips.has(t.id),pack:packReady.has(t.id)}));
  if(globalThis.indexedDB)main.querySelector('#autopilot-panel').insertAdjacentHTML('afterend','<details class="panel" id="offline-pack-view"><summary>기기에 보관된 여행팩 · 기본 회화</summary><p class="note">여행팩을 확인 중입니다.</p></details>');
  if(t.kind==='overseas')main.querySelector('#autopilot-panel').insertAdjacentHTML('afterend',entryPanel(t,preparation.get(t)));
  queuePack(t);preparation.ensure(t,{online:navigator.onLine!==false}).catch(()=>toast('자동 준비 상태를 보관하지 못했습니다. 기존 여행은 유지됩니다.'));
  main.querySelector('.timeline')?.remove();
  const detail=main.querySelector('.detail-layout > div');
  if(detail)detail.insertAdjacentHTML('beforeend',itineraryPanel(t,selectedDay));
  else main.insertAdjacentHTML('beforeend',itineraryPanel(t,selectedDay));
  main.insertAdjacentHTML('beforeend','<details class="panel"><summary>추가 AI 조언·번역·지도</summary>'+hybridPanel()+'</details>');
  if(nativePhotos){main.querySelector('#autopilot-panel').insertAdjacentHTML('afterend',nativeAlbumPanel(t,nativePhotos.get(t.id)));nativePhotos.restore(t).then(()=>nativePhotos.ensure(t)).catch(()=>{});}
  main.insertAdjacentHTML('beforeend','<section class="panel album-panel"><h2>여행 후 사진 정리</h2><p class="note">Android 개발판은 별도 권한 허용 후 사진 후보를 자동 검색합니다. 웹에서는 아래 직접 선택 방식을 보조로 사용합니다. 서버에 업로드하지 않습니다.</p><details><summary>웹에서 사진을 직접 선택하는 보조 방식</summary><p>선택한 사진만 기기 안에서 촬영일별로 정리합니다. 서버에 업로드하지 않으며 원본 파일과 얼굴·표정을 변경하지 않습니다. 촬영일이 없는 사진은 별도로 표시합니다.</p><label for="album-files">사진 선택</label><p class="album-limit" id="album-limit">한 번에 최대 20장 · JPG/PNG/WebP · 장당 15MB</p><input id="album-files" aria-describedby="album-limit" type="file" accept="image/jpeg,image/png,image/webp" multiple '+(albumBusy?'disabled':'')+'><p class="note">선택한 사진은 재실행 시 복원되지 않습니다. 보관하려면 앨범 HTML을 저장하세요. 내보내는 사본은 최대 1,200px로 축소하며 위치 정보를 제거합니다.</p><div id="album-preview" class="album-grid">'+(album?.preview||'')+'</div><button class="secondary" data-action="album-export" '+(!album?'disabled':'')+'>앨범 HTML 저장·공유</button></details></section>');
 }
 document.querySelectorAll('nav a').forEach(a=>a.setAttribute('aria-current',a.hash==='#'+route?'page':'false'));
}
function destination(parentId,city){const p=place(parentId,city);draft={...draft,...p,parentId,city:p.city,kind:p.kind};month=(draft.start||today()).slice(0,7);commit({...state,recents:addRecent(state.recents,p)});go('dates');}
async function download(data,name,type){if(window.Capacitor?.isNativePlatform?.()){const {exportFile}=await import('./native-export.js');await exportFile(data,name);return;}const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60_000);}
main.addEventListener('click',async event=>{const b=event.target.closest('[data-action]');if(!b)return;try{
 savePendingNotes();const a=b.dataset.action;
 if(a.startsWith('hybrid-')){
  if(hybridBusy)return;
  const status=document.querySelector('#ai-status'),result=document.querySelector('#ai-result'),trip=currentTrip();
  if(!document.querySelector('#ai-consent').checked){status.textContent='전송 항목을 확인하고 동의를 선택하세요.';return;}
  if(!navigator.onLine){status.textContent='인터넷 연결이 필요합니다. 기기 내 여행과 체크리스트는 계속 사용할 수 있습니다.';return;}
  const mode=a.slice('hybrid-'.length);
  const request=mode==='map'?{mode,query:trip.city+' '+(ALL.find(p=>p.id===trip.parentId)?.name||'')}:mode==='translate'?{mode,language:document.querySelector('#ai-language').value,text:document.querySelector('#ai-text').value.trim()}:{mode,trip:{kind:trip.kind,parentId:trip.parentId,city:trip.city,days:trip.days,start:trip.start,end:trip.end}};
  if(request.mode==='translate'&&!request.text){status.textContent='번역할 문장을 입력하세요.';return;}
  hybridBusy=true;b.disabled=true;status.textContent='서비스 응답을 기다리고 있습니다…';
  try{const cloud=await import('./cloud.js');const answer=await cloud.hybrid(request);if(status.isConnected){
   if(mode==='map'){
    const frame=document.createElement('iframe');frame.src=mapFrameUrl(answer.url);frame.title='여행지 Google 지도';frame.width='100%';frame.height='360';frame.style.border='0';frame.loading='lazy';frame.referrerPolicy='strict-origin-when-cross-origin';frame.allowFullscreen=true;
    document.querySelector('#ai-map').replaceChildren(frame);status.textContent='Google 지도 · 온라인에서만 표시됩니다. 경로 최적화·오프라인 지도는 제공하지 않습니다.';
   }else{
    if(mode!=='official')result.textContent=answer.text||'';
    status.textContent=mode==='official'?'공식 관광 정보 조회 · '+answer.generatedAt:answer.disclaimer+' · '+answer.model+' · '+answer.generatedAt;
    if(mode!=='translate'){document.querySelector('#ai-sources').innerHTML=officialPanel(answer);document.querySelector('#ai-photos').innerHTML=photoPanel(answer.photos);}
   }
  }}
  catch(error){if(status.isConnected)status.textContent=error.message||'AI 연결에 실패했습니다. 로컬 여행은 보존됩니다.';}
  finally{hybridBusy=false;if(b.isConnected)b.disabled=false;}return;
 }
 if(a==='stop-add'){const t=currentTrip(),value=id=>document.querySelector('#'+id).value;const stop={id:crypto.randomUUID(),day:selectedDay,time:value('stop-time'),name:value('stop-name'),address:value('stop-address'),source:value('stop-source').trim()};commit({...state,trips:state.trips.map(x=>x.id===t.id?{...x,stops:[...(x.stops||[]),stop]}:x)});render();toast('장소를 이 기기에 저장했어요.');}
 if(a==='stop-delete'&&confirm('이 장소 기록을 삭제할까요?')){const t=currentTrip();commit({...state,trips:state.trips.map(x=>x.id===t.id?{...x,stops:x.stops.filter(s=>s.id!==b.dataset.stop)}:x)});render();}
 if(a.startsWith('cloud-')){
  if(cloudBusy)return;cloudBusy=true;b.disabled=true;
  let cloud;try{
   cloud=await import('./cloud.js');
   if(a==='cloud-login'){try{const email=await cloud.login(document.querySelector('#cloud-email').value,document.querySelector('#cloud-password').value);cloudStatus=email+' 로그인됨. 사본 확인 후 저장할 수 있습니다.';}finally{const password=document.querySelector('#cloud-password');if(password)password.value='';}}
   if(a==='cloud-google'){const email=await cloud.loginGoogle();cloudStatus=email+' Google 로그인됨. 사본 확인 후 저장할 수 있습니다.';}
   if(a==='cloud-logout'){await cloud.logout();cloudStatus='로그아웃했습니다. 로컬 여행은 보존됩니다.';}
   if(a==='cloud-inspect'){const data=await cloud.inspect();cloudStatus=data.email+' · '+(data.state?'클라우드 '+data.state.trips.length+'개 여행 · 버전 '+data.revision:'클라우드 여행 사본 없음');}
   if(a==='cloud-upload'){const revision=await cloud.upload(state);cloudStatus='클라우드 사본 버전 '+revision+' 저장 완료';}
   if(a==='cloud-import'){const data=await cloud.inspect();if(!data.state)throw Error('클라우드 여행 사본이 없습니다.');const imported=validateState(data.state),existing=new Set(state.trips.map(t=>t.id));const additions=imported.trips.filter(t=>!existing.has(t.id));commit({...state,trips:[...additions,...state.trips]});cloudStatus=additions.length+'개 여행 추가. 기존 여행은 덮어쓰지 않았습니다.';render();}
   if(a==='cloud-delete'&&confirm('Firebase의 본인 여행딱 사본을 삭제할까요? 클라우드에서는 복구할 수 없습니다. 로컬 여행·딱모둠 데이터는 보존됩니다.')){await cloud.remove();cloudStatus='클라우드 여행딱 사본 삭제 완료';}
  }catch(error){cloudStatus=cloud?cloud.friendly(error):'연결 모듈을 열지 못했습니다. 인터넷 연결을 확인하세요.';}
  finally{cloudBusy=false;cloudEpoch++;if(cloud){try{cloudSession=await cloud.session();}catch{}}paintCloud();toast(cloudStatus);}
 }
 if(a==='album-export'){if(!selectedAlbum||selectedAlbum.tripId!==currentTrip()?.id)throw Error('사진을 먼저 선택하세요.');await download(selectedAlbum.html,'여행딱_사진앨범.html','text/html;charset=utf-8');}
 if(a==='start'){draft={kind:'',parentId:'',city:'',start:'',end:''};filter='인기';month=today().slice(0,7);go('quick');}
 if(a==='browse-destination'){draft.quick=false;go('new');}
 if(a==='quick-pick'){draft.quick=true;destination(b.dataset.parent,b.dataset.city);}
 if(a==='quick-dates'){const parent=document.querySelector('#quick-parent').value,city=document.querySelector('#quick-city').value;if(!parent)throw Error('나라 또는 시·도를 먼저 골라주세요.');if(!city)throw Error('세부 지역을 골라주세요.');draft.quick=true;destination(parent,city);}
 if(a==='background-enable'){backgroundTrips.add(currentTrip().id);preparation.setConsent(true);resumePreparation(true);}
 if(a==='background-disable'){await(await import('./cloud.js')).autoJobs({operation:'remove',id:currentTrip().id});backgroundTrips.remove(currentTrip().id);updatePreparation(currentTrip());toast('이 여행의 서버 자동 준비와 보관된 자동 준비 자료를 삭제했습니다.');}
 if(a==='auto-enable'){preparation.setConsent(true);resumePreparation(true);}
 if(a==='auto-disable'){if(backgroundTrips.size){await(await import('./cloud.js')).autoJobs({operation:'removeAll'});backgroundTrips.clear();}preparation.setConsent(false);updatePreparation(currentTrip());}
 if(a==='auto-login'){await(await import('./cloud.js')).loginGoogle();resumePreparation(true);}
 if(a==='photos-allow'&&nativePhotos)await nativePhotos.allow(currentTrip());
 if(a==='photos-confirm'&&nativePhotos)await nativePhotos.confirm(currentTrip());
 if(a==='photos-more'&&nativePhotos)nativePhotos.more(currentTrip());
 if(a==='route')go(b.dataset.route);
 if(a==='kind'){draft.kind=b.dataset.kind;filter='인기';go('regions');}
 if(a==='parent'){draft.parentId=b.dataset.parent;go('cities');}
 if(a==='filter'){filter=b.dataset.filter;render();}
 if(a==='destination')destination(b.dataset.parent,b.dataset.city);
 if(a==='back')navigateBack();
 if(a==='show-search'){document.querySelector('#parent-search').hidden=false;document.querySelector('#parent-query').focus();}
 if(a==='other'){document.querySelector('#other-region').hidden=false;document.querySelector('#other-city').focus();}
 if(a==='custom-city')destination(draft.parentId,document.querySelector('#other-city').value);
 if(a==='month'){const [y,m]=month.split('-').map(Number);const next=new Date(Date.UTC(y,m-1+Number(b.dataset.step),1));month=next.toISOString().slice(0,7);render();}
 if(a==='day'){Object.assign(draft,pickDate(draft.start,draft.end,b.dataset.date));render();}
 if(a==='create'){if(state.trips.length>=100)throw Error('여행은 최대 100개까지 저장할 수 있습니다.');const t=makeTrip(draft);commit({...state,trips:[t,...state.trips]});b.disabled=true;selectedDay=0;go('trip/'+encodeURIComponent(t.id));render();queuePack(t);toast('여행을 저장하고 기기 내 준비를 시작했어요.');}
 if(a==='trip-day'){selectedDay=Number(b.dataset.day);render();const active=document.querySelector('.filters [data-day="'+selectedDay+'"]'),tabs=active?.parentElement;if(active&&tabs)tabs.scrollLeft=Math.max(0,active.offsetLeft-tabs.offsetLeft-(tabs.clientWidth-active.offsetWidth)/2);}
 if(a==='save-notes'){const t=currentTrip(),notes=document.querySelector('#trip-notes').value;if(notes.length>5000)throw Error('메모는 최대 5,000자입니다.');commit({...state,trips:state.trips.map(x=>x.id===t.id?{...x,notes}:x)});toast('메모를 저장했어요.');}
 if(a==='offline'){await download(offlineHtml(currentTrip()),'여행딱_여행팩.html','text/html;charset=utf-8');toast('여행팩 저장·공유를 요청했어요. 저장한 파일을 열어 확인하세요.');}
 if(a==='backup'){await download(loadError?deviceStorage.getItem(KEY)||'{}':JSON.stringify(state,null,2),'travel-ddak-backup.json','application/json');toast('백업 파일 저장·공유를 요청했어요.');}
 if(a==='import')document.querySelector('#import-file').click();
 if(a==='delete-trip'){
  const t=currentTrip();if(!t||document.querySelector('#delete-trip-dialog'))return;
  main.insertAdjacentHTML('beforeend','<dialog id="delete-trip-dialog" aria-labelledby="delete-trip-title" aria-describedby="delete-trip-description"><h2 id="delete-trip-title">이 여행을 삭제할까요?</h2><p id="delete-trip-description">'+esc(t.city)+' 여행과 이 기기의 메모·일정·여행팩·앨범 정리 결과가 삭제됩니다. 삭제 후 앱에서 복구할 수 없습니다. 클라우드 사본은 삭제하지 않습니다.</p><div class="dialog-actions"><button class="secondary" data-action="delete-cancel">취소</button><button class="danger" data-action="delete-confirm" data-trip-id="'+esc(t.id)+'">여행 삭제</button></div></dialog>');
  const dialog=document.querySelector('#delete-trip-dialog');dialog.addEventListener('close',()=>{dialog.remove();if(b.isConnected)b.focus();},{once:true});dialog.showModal();dialog.querySelector('[data-action="delete-cancel"]').focus();return;
 }
 if(a==='delete-cancel'){document.querySelector('#delete-trip-dialog')?.close();return;}
 if(a==='delete-confirm'){if(b.disabled)return;const active=currentTrip();if(!active||active.id!==b.dataset.tripId){document.querySelector('#delete-trip-dialog')?.close();return;}b.disabled=true;try{const t=currentTrip();if(backgroundTrips.has(t.id)){await(await import('./cloud.js')).autoJobs({operation:'remove',id:t.id});backgroundTrips.remove(t.id);}commit({...state,trips:state.trips.filter(x=>x.id!==t.id)});preparation.remove(t.id);packReady.delete(t.id);if(nativePhotos)await nativePhotos.remove(t.id);const pending=packJobs.get(t.id)||Promise.resolve();packJobs.set(t.id,pending.catch(()=>{}).then(()=>packs.remove(t.id)).catch(()=>toast('여행팩 삭제를 완료하지 못했습니다. 저장소를 확인하세요.')));document.querySelector('#delete-trip-dialog')?.close();go('trips');}catch(error){b.disabled=false;throw error;}}
 if(a==='reset'&&confirm('이 브라우저에 저장한 모든 여행·메모·최근 선택을 삭제할까요? 필요한 경우 먼저 백업하세요.')){if(backgroundTrips.size){await(await import('./cloud.js')).autoJobs({operation:'removeAll'});backgroundTrips.clear();}deviceStorage.removeItem(KEY);for(const key of Object.keys(deviceStorage)){if(key.startsWith(KEY+'.recovery.'))deviceStorage.removeItem(key);}state={version:1,trips:[],recents:[]};preparation.clear();nativePhotos?.clear();packReady.clear();if(globalThis.indexedDB){await Promise.allSettled([...packJobs.values()]);await packs.clear();}loadError='';go('home');render();toast('이 브라우저의 여행·자동 준비·여행팩·앨범 정보를 삭제했어요.');}
 if(a==='tag'){const t=b.dataset.tag;tags=tags.includes(t)?tags.filter(x=>x!==t):[...tags,t];render();}
 if(a==='rec-kind'){recommendKind=b.dataset.kind;render();}
 }catch(e){toast(e.name==='QuotaExceededError'?'저장 공간이 부족합니다. 백업 후 공간을 확보하세요.':e.message||'작업을 완료하지 못했습니다.');}});
main.addEventListener('input',event=>{if(event.target.id==='parent-query'){const q=event.target.value.trim();const items=(draft.kind==='domestic'?PROVINCES:COUNTRIES).filter(p=>p.name.includes(q));document.querySelector('#parent-results').innerHTML=items.map(p=>'<button data-action="parent" data-parent="'+p.id+'">'+p.name+'</button>').join('')||'<span>등록된 지역이 없습니다.</span>';}});
main.addEventListener('input',event=>{if(event.target.id==='trip-notes'){clearTimeout(notesTimer);notesTimer=setTimeout(()=>{try{savePendingNotes();}catch(error){toast('메모 자동 저장 실패. 입력은 유지됩니다. '+error.message);}},300);}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){try{savePendingNotes();}catch{/* Explicit navigation still reports write failure and keeps the input. */}}});
main.addEventListener('change',async event=>{const target=event.target;try{
 savePendingNotes();
 if(target.id==='quick-parent'){draft.parentId=target.value;draft.city='';const parent=ALL.find(p=>p.id===draft.parentId),city=document.querySelector('#quick-city');city.disabled=!parent;city.innerHTML='<option value="">'+(parent?'세부 지역 선택':'먼저 큰 지역을 선택하세요')+'</option>'+(parent?parent.cities.map(name=>'<option value="'+esc(name)+'">'+esc(name)+'</option>').join(''):'');return;}
 if(target.id==='quick-city'){draft.city=target.value;return;}
 if(target.id==='calendar-month'){if(/^\d{4}-(0[1-9]|1[0-2])$/.test(target.value)){month=target.value;render();}else{target.value=month;}return;}
 if(target.id==='album-files'){
  if(albumBusy)return;const t=currentTrip();if(!t)return;
  albumBusy=true;target.disabled=true;toast('선택한 사진을 이 기기에서 정리하고 있어요.');
  try{const {makeAlbum}=await import('./photos.js');const result=await makeAlbum([...target.files],t);selectedAlbum={...result,tripId:t.id};savePendingNotes();albumBusy=false;if(currentTrip()?.id===t.id)render();toast(result.count+'장 앨범을 준비했어요. 저장 버튼으로 보관하세요.');}
  finally{albumBusy=false;target.disabled=false;}
 }
 if(target.matches('[data-check]')){const t=currentTrip();const i=Number(target.dataset.check);const checks=target.checked?[...new Set([...t.checks,i])]:t.checks.filter(x=>x!==i);commit({...state,trips:state.trips.map(x=>x.id===t.id?{...x,checks}:x)});target.nextElementSibling.classList.toggle('done',target.checked);}
 if(target.id==='import-file'){const file=target.files[0];if(!file)return;if(file.size>2_000_000)throw Error('2MB 이하 여행 백업 파일을 선택하세요.');const imported=validateState(JSON.parse(await file.text()));const existing=new Set(state.trips.map(t=>t.id));const additions=imported.trips.filter(t=>!existing.has(t.id));
 if(loadError){
  if(!confirm('검증된 백업으로 복원할까요? 기존 원본은 이 브라우저에 별도로 보존합니다.'))return;
  const original=deviceStorage.getItem(KEY);
  if(original!==null)deviceStorage.setItem(KEY+'.recovery.'+Date.now(),original);
  deviceStorage.setItem(KEY,JSON.stringify(imported));
  state=imported;loadError='';
 }else commit({...state,trips:[...additions,...state.trips]});
 render();toast(additions.length+'개 여행을 추가했어요. 기존 여행은 덮어쓰지 않았어요.');}
 }catch(e){if(target.matches('[data-check]'))target.checked=!target.checked;toast(e.message||'파일을 읽지 못했습니다.');}finally{if(target.id==='import-file')target.value='';}});
document.addEventListener('click',event=>{
 if(!event.target.closest('a,[data-action]'))return;
 try{savePendingNotes();}catch(error){event.preventDefault();event.stopImmediatePropagation();toast('메모를 저장하지 못했습니다. 화면을 유지합니다. '+error.message);}
},true);
window.addEventListener('beforeunload',event=>{
 try{savePendingNotes();}catch{event.preventDefault();event.returnValue='';}
});
window.addEventListener('hashchange',()=>{
 try{savePendingNotes();const next=location.hash||'#home';if(returningRoute===next){returningRoute=null;if(routeTrail[routeTrail.length-1]!==next)routeTrail.push(next);}else if(routeTrail.length>1&&routeTrail[routeTrail.length-2]===next)routeTrail.pop();else if(routeTrail[routeTrail.length-1]!==next)routeTrail.push(next);render();lastRoute=next;window.scrollTo(0,0);main.focus({preventScroll:true});}
 catch(error){history.replaceState(null,'',lastRoute);toast('메모를 저장하지 못했습니다. '+error.message);}
});
window.addEventListener('offline',()=>toast('오프라인입니다. 저장된 여행과 메모를 볼 수 있어요.'));
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;document.querySelector('#install').hidden=false;});
document.querySelector('#install').addEventListener('click',async()=>{if(installPrompt){await installPrompt.prompt();installPrompt=null;document.querySelector('#install').hidden=true;}});
if('serviceWorker' in navigator&&!window.Capacitor?.isNativePlatform?.())setupUpdates({serviceWorker:navigator.serviceWorker,button:document.querySelector('#app-update'),saveNotes:savePendingNotes,reload:()=>location.reload(),notify:toast});

render();

if(window.Capacitor?.isNativePlatform?.())import('./native-navigation.js').then(m=>m.bindBackButton()).catch(()=>toast('뒤로가기 기능을 준비하지 못했습니다. 화면의 이전 버튼을 이용해 주세요.'));

window.addEventListener('online',()=>resumePreparation());
window.addEventListener('focus',()=>resumePreparation(false,true));
const preparationTimer=setInterval(()=>{if(document.visibilityState!=='hidden')resumePreparation();},60000);
preparationTimer?.unref?.();
