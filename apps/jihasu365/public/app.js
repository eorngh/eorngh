const PARAMS=new URLSearchParams(location.search);
const DEMO=PARAMS.get('demo')==='1';
const PC_MODE=PARAMS.get('pc')==='1';
const PC_PORT=PARAMS.get('port')||'';
const PC_NONCE=PARAMS.get('nonce')||'';
const $=id=>document.getElementById(id);
const ROLE_LABEL={owner:'대표',admin:'관리자',manager:'현장관리자',worker:'현장직원'};
const STATUS_LABEL={active:'진행중',planned:'예정',completed:'완료'};
const PLAN_LABEL={alpha:'PRO',trial:'PRO 체험',basic:'BASIC',pro:'PRO',business:'BUSINESS'};
let fb={},auth=null,db=null,storage=null,functions=null,currentUser=null,currentProfile=null,currentCompany=null,companyId='',sites=[],logs=[],photos=[],members=[],deferredPrompt=null,firebaseReady=false;
let photoCategory='굴착중';
let groundwaterMap=null,siteMarkers=null,newSiteGps={lat:null,lng:null};
const GIMS_URL='https://new.gims.go.kr/igis';

function show(id,on=true){const e=$(id);if(e)e.classList.toggle('hidden',!on)}
function toast(s,ms=3000){const e=$('toast');e.textContent=s;show('toast',true);clearTimeout(toast._t);toast._t=setTimeout(()=>show('toast',false),ms)}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function uid(){return 'W'+Date.now()+'_'+Math.random().toString(36).slice(2,8)}
function localDate(){const d=new Date();const z=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`}
function canManage(){return ['owner','admin','manager'].includes(currentProfile?.role)}
function canAdmin(){return ['owner','admin'].includes(currentProfile?.role)}
function companyPath(collectionName){return ['companies',companyId,collectionName]}
function setStatus(s){if($('status'))$('status').textContent=s}
function setSyncState(text,tone='ok'){
  const b=$('syncStateBadge');if(!b)return;b.textContent=text;b.dataset.tone=tone;b.classList.remove('hidden');
}
const DEMO_MEM={};function demoGet(k,def=null){try{const v=localStorage.getItem(k);return v===null?def:v}catch(e){return Object.prototype.hasOwnProperty.call(DEMO_MEM,k)?DEMO_MEM[k]:def}}function demoSet(k,v){try{localStorage.setItem(k,v)}catch(e){DEMO_MEM[k]=v}}
$('date').value=localDate();

const WORKLOG_DRAFT_FIELDS=['siteSelect','date','workers','work','depth','equipment','materials','note'];
function worklogDraftKey(){return `j365_worklog_draft_${companyId||'pending'}`}
function saveWorklogDraft(){
  if(!companyId)return; const data={updatedAt:Date.now()};
  WORKLOG_DRAFT_FIELDS.forEach(id=>{const el=$(id);if(el)data[id]=el.value});
  const meaningful=(data.work||data.note||data.workers||data.depth||data.equipment||data.materials||data.siteSelect);
  try{if(meaningful)localStorage.setItem(worklogDraftKey(),JSON.stringify(data));else localStorage.removeItem(worklogDraftKey())}catch(e){}
}
function clearWorklogDraft(){try{localStorage.removeItem(worklogDraftKey())}catch(e){}}
function restoreWorklogDraft(){
  if(!companyId)return;let d=null;try{d=JSON.parse(localStorage.getItem(worklogDraftKey())||'null')}catch(e){}
  if(!d||!d.updatedAt||Date.now()-d.updatedAt>7*86400000){clearWorklogDraft();return}
  WORKLOG_DRAFT_FIELDS.forEach(id=>{const el=$(id);if(el&&d[id]!==undefined){if(id==='siteSelect'&&d[id]&&!sites.some(s=>s.id===d[id]))return;el.value=d[id]}});
  const selected=sites.find(s=>s.id===$('siteSelect').value);if(selected)$('siteAddress').value=selected.site||'';
  if(d.work||d.note||d.workers||d.depth||d.equipment||d.materials){setStatus('이전 임시저장을 복원했습니다.');}
}
let draftTimer=null;WORKLOG_DRAFT_FIELDS.forEach(id=>{const el=$(id);if(el){const fn=()=>{clearTimeout(draftTimer);draftTimer=setTimeout(saveWorklogDraft,250)};el.addEventListener('input',fn);el.addEventListener('change',fn)}});
function updateNetworkBadge(){const b=$('networkBadge');if(!b)return;const offline=!navigator.onLine;b.classList.toggle('hidden',!offline);b.textContent=offline?'오프라인':'온라인';if(offline)setSyncState('기기에 안전하게 저장','offline')}
updateNetworkBadge();



function dmsToDd(v){
  const m=String(v||'').match(/(-?\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)?\D*(\d+(?:\.\d+)?)?/);
  if(!m)return NaN;const d=Number(m[1]),mi=Number(m[2]||0),se=Number(m[3]||0),sgn=d<0?-1:1;return sgn*(Math.abs(d)+mi/60+se/3600);
}
function siteCoords(x){
  let lat=Number(x?.lat),lng=Number(x?.lng);
  if(Number.isFinite(lat)&&Number.isFinite(lng))return{lat,lng};
  const pp=x?.permitProfile||{};lng=dmsToDd(pp.coord1);lat=dmsToDd(pp.coord2);
  return Number.isFinite(lat)&&Number.isFinite(lng)?{lat,lng}:null;
}
function openGims(layer=''){
  const w=window.open(GIMS_URL,'_blank','noopener');
  if(layer)toast(`GIMS에서 “${layer}” 레이어를 확인해 주세요.`,4200);
  if(!w)toast('팝업이 차단되었습니다. 국가지하수정보지도 버튼을 다시 눌러주세요.',5000);
}
function initGroundwaterMap(){
  if(!window.L){toast('지도 모듈을 불러오지 못했습니다. 인터넷 연결을 확인하세요.',5000);return false}
  if(!groundwaterMap){
    groundwaterMap=L.map('groundwaterMap',{zoomControl:true,attributionControl:true}).setView([36.15,127.85],7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(groundwaterMap);
    siteMarkers=L.layerGroup().addTo(groundwaterMap);
  }
  setTimeout(()=>groundwaterMap.invalidateSize(),50);return true;
}
function renderGroundwaterMap(focusId=''){
  if(!initGroundwaterMap())return;siteMarkers.clearLayers();const bounds=[];let focus=null;
  sites.forEach(x=>{const c=siteCoords(x);if(!c)return;const marker=L.marker([c.lat,c.lng]).addTo(siteMarkers).bindPopup(`<b>${esc(x.name||'현장')}</b><br>${esc(x.site||'주소 미입력')}<br><button class="mapPopupBtn" data-map-site="${esc(x.id)}">현장 상세</button>`);bounds.push([c.lat,c.lng]);if(x.id===focusId)focus={marker,c};});
  const notice=$('mapEmptyNotice');if(notice)notice.classList.toggle('hidden',bounds.length>0);
  if(focus){groundwaterMap.setView([focus.c.lat,focus.c.lng],16);focus.marker.openPopup()}
  else if(bounds.length===1)groundwaterMap.setView(bounds[0],16);else if(bounds.length>1)groundwaterMap.fitBounds(bounds,{padding:[34,34],maxZoom:16});
  setTimeout(()=>{document.querySelectorAll('[data-map-site]').forEach(b=>b.onclick=()=>openSiteDetail(b.dataset.mapSite))},100);
}
function switchSitesMode(mode='list',focusId=''){
  const mapMode=mode==='map';show('sitesListPane',!mapMode);show('sitesMapPane',mapMode);
  $('sitesTabList')?.classList.toggle('active',!mapMode);$('sitesTabMap')?.classList.toggle('active',mapMode);
  if(mapMode)setTimeout(()=>renderGroundwaterMap(focusId),50);
}
function captureNewSiteGps(){
  if(!navigator.geolocation){toast('이 기기에서는 GPS를 사용할 수 없습니다.');return}
  const b=$('newSiteGpsBtn');b.disabled=true;b.textContent='GPS 확인 중...';
  navigator.geolocation.getCurrentPosition(pos=>{newSiteGps={lat:pos.coords.latitude,lng:pos.coords.longitude};$('newSiteLat').value=String(newSiteGps.lat);$('newSiteLng').value=String(newSiteGps.lng);$('newSiteGpsText').textContent=`${newSiteGps.lat.toFixed(6)}, ${newSiteGps.lng.toFixed(6)}`;b.disabled=false;b.textContent='GPS 다시 저장';toast('현재 관정 위치를 저장했습니다.')},()=>{b.disabled=false;b.textContent='현재 GPS 저장';toast('GPS를 가져오지 못했습니다. 위치 권한을 확인하세요.',5000)},{enableHighAccuracy:true,timeout:12000,maximumAge:0});
}

function bindNavigation(){
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
  document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.go)));
}
function switchView(name){
  const allowed=['Dashboard','Today','Sites','Logs','Docs','Team','Account'];
  if(!allowed.includes(name))name='Dashboard';
  if(name==='Team'&&!canAdmin())name='Dashboard';
  allowed.forEach(v=>{const e=$('view'+v);if(e)e.classList.toggle('active',v===name)});
  document.querySelectorAll('.navBtn,.navItem').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
  if(name==='Dashboard')refreshDashboard();
  if(name==='Sites'){renderSites();switchSitesMode('list')}
  if(name==='Logs')loadRecentLogs(true);
  if(name==='Docs')renderDocsView();
  if(name==='Team'&&canAdmin())loadMembers();
  window.scrollTo({top:0,behavior:'auto'});
}
bindNavigation();

function dbOpen(){return new Promise((res,rej)=>{const r=indexedDB.open('j365_queue',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('queue'))r.result.createObjectStore('queue',{keyPath:'id'})};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function qPut(x){const d=await dbOpen();return new Promise((res,rej)=>{const t=d.transaction('queue','readwrite');t.objectStore('queue').put(x);t.oncomplete=res;t.onerror=()=>rej(t.error)})}
async function qAll(){const d=await dbOpen();return new Promise((res,rej)=>{const r=d.transaction('queue').objectStore('queue').getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error)})}
async function qDel(id){const d=await dbOpen();return new Promise((res,rej)=>{const t=d.transaction('queue','readwrite');t.objectStore('queue').delete(id);t.oncomplete=res;t.onerror=()=>rej(t.error)})}
async function refreshQueueCount(){
  if(DEMO){['queueCount','queueCountMirror','statQueue'].forEach(id=>{if($(id))$(id).textContent='0'});if($('queueStatCard'))$('queueStatCard').classList.remove('queueAlert');setSyncState('데모 모드','demo');return 0}
  const xs=await qAll();const mine=xs.filter(x=>!x.companyId||x.companyId===companyId);['queueCount','queueCountMirror','statQueue'].forEach(id=>{if($(id))$(id).textContent=mine.length});if($('queueStatCard'))$('queueStatCard').classList.toggle('queueAlert',mine.length>0);
  if(!navigator.onLine)setSyncState(mine.length?`오프라인 · ${mine.length}건 보관`:'오프라인 · 기기 저장','offline');else if(mine.length)setSyncState(`전송 대기 ${mine.length}건`,'pending');else setSyncState('동기화 완료','ok');
  return mine.length
}

async function compressFile(file){return new Promise((resolve,reject)=>{const fr=new FileReader();fr.onerror=()=>reject(fr.error);fr.onload=()=>{const img=new Image();img.onerror=()=>reject(new Error('사진을 읽을 수 없습니다: '+file.name));img.onload=()=>{let w=img.naturalWidth,h=img.naturalHeight,max=1800;if(w>max||h>max){const s=Math.min(max/w,max/h);w=Math.round(w*s);h=Math.round(h*s)}const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d',{alpha:false}).drawImage(img,0,0,w,h);resolve({id:uid(),name:(file.name||'photo').replace(/\.[^.]+$/,'')+'.jpg',data:c.toDataURL('image/jpeg',.8)})};img.src=fr.result};fr.readAsDataURL(file)})}
function renderPhotos(){const box=$('photoPreview');box.innerHTML='';photos.forEach((p,i)=>{const d=document.createElement('div');d.className='photoItem';d.innerHTML=`<img alt="현장사진 ${esc(p.category||'기타')}" src="${p.data}"><span class="photoTypeBadge">${esc(p.category||'기타')}</span><button type="button" aria-label="삭제">×</button>`;d.querySelector('button').onclick=()=>{photos.splice(i,1);renderPhotos()};box.appendChild(d)});setStatus(photos.length?`사진 ${photos.length}장 · 저장 준비됨`:'준비됨')}
async function addFiles(fileList){const site=sites.find(s=>s.id===$('siteSelect')?.value),coord=siteCoords(site);for(const f of [...fileList]){if(photos.length>=15){toast('사진은 한 공사일보에 최대 15장입니다.');break}try{const p=await compressFile(f);photos.push({...p,category:photoCategory,capturedAt:new Date().toISOString(),siteId:site?.id||'',siteName:site?.name||'',...(coord?{lat:coord.lat,lng:coord.lng}:{})})}catch(e){toast(e.message)}}renderPhotos()}
$('galleryBtn').onclick=()=>$('galleryInput').click();$('cameraBtn').onclick=()=>$('cameraInput').click();$('galleryInput').addEventListener('change',e=>addFiles(e.target.files));$('cameraInput').addEventListener('change',e=>addFiles(e.target.files));
document.querySelectorAll('[data-photo-category]').forEach(b=>b.onclick=()=>{photoCategory=b.dataset.photoCategory;document.querySelectorAll('[data-photo-category]').forEach(x=>x.classList.toggle('active',x===b));});
function updatePhotoLocationState(){const site=sites.find(s=>s.id===$('siteSelect')?.value),c=siteCoords(site),e=$('photoLocationState');if(!e)return;e.textContent=c?`✓ ${site.name} GPS 위치가 사진 메타정보에 연결됩니다.`:'현장 GPS가 없으면 날짜·현장명·공정만 저장됩니다.';e.classList.toggle('ready',!!c)}

function siteShortNameFromAddress(addr){addr=String(addr||'').replace(/번지/g,'').replace(/\s+/g,' ').trim();const parts=addr.split(' ');let idx=-1;for(let i=parts.length-1;i>=0;i--){if(/[동리읍면]$/.test(parts[i])){idx=i;break}}if(idx<0)return parts.slice(-2).join(' ');let tail=parts[idx];for(let j=idx+1;j<parts.length;j++){const x=parts[j];if(/^산?\d+(?:-\d+)?$/.test(x)){tail+=' '+x;break}}return tail}
let daumPostcodePromise=null;
function ensureDaumPostcode(){
  if(window.daum?.Postcode)return Promise.resolve();
  if(daumPostcodePromise)return daumPostcodePromise;
  daumPostcodePromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';s.async=true;s.onload=()=>window.daum?.Postcode?resolve():reject(new Error('주소검색 모듈 초기화 실패'));s.onerror=()=>reject(new Error('주소검색 모듈을 불러오지 못했습니다.'));document.head.appendChild(s)});
  return daumPostcodePromise;
}
async function openAddressSearch(){const wrap=$('postcodeWrap');try{await ensureDaumPostcode()}catch(e){toast('주소검색을 불러오지 못했습니다. 인터넷 연결을 확인하세요.',5000);return}wrap.innerHTML='';show('addressModal',true);new daum.Postcode({oncomplete:d=>{const addr=(d.jibunAddress||d.autoJibunAddress||d.roadAddress||d.address||'').trim();$('newSiteAddress').value=addr;if(!$('newSiteName').value.trim()||$('newSiteName').dataset.auto==='1'){$('newSiteName').value=siteShortNameFromAddress(addr);$('newSiteName').dataset.auto='1'}show('addressModal',false);toast('주소가 자동 입력되었습니다.')},width:'100%',height:'100%'}).embed(wrap)}
$('searchSiteAddressBtn').onclick=openAddressSearch;$('closeAddressModal').onclick=()=>show('addressModal',false);$('newSiteName').addEventListener('input',()=>{$('newSiteName').dataset.auto='0'});

async function loadFirebaseConfig(){const r=await fetch('/__/firebase/init.json?t='+Date.now(),{cache:'no-store',credentials:'same-origin'});if(!r.ok)throw new Error(`Firebase 자동설정 실패 (HTTP ${r.status})`);const cfg=await r.json();if(!cfg?.apiKey||!cfg?.appId||!cfg?.projectId)throw new Error('Firebase 설정 값이 올바르지 않습니다.');return cfg}
async function initFirebase(){
  if(DEMO){startDemo();return}
  $('loginMsg').textContent='Firebase 프로젝트 확인 중...';
  const cfg=await loadFirebaseConfig();
  const appMod=await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js');
  const authMod=await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js');
  const fsMod=await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js');
  const stMod=await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js');
  const fnMod=await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js');
  fb={...authMod,...fsMod,...stMod,...fnMod};
  const app=appMod.initializeApp(cfg);auth=authMod.getAuth(app);db=fsMod.getFirestore(app);storage=stMod.getStorage(app);functions=fnMod.getFunctions(app,'asia-northeast3');
  firebaseReady=true;$('loginBtn').disabled=false;$('loginMsg').textContent='로그인 준비 완료';
  try{await authMod.getRedirectResult(auth)}catch(e){}
  authMod.onAuthStateChanged(auth,handleAuth);
}
async function login(){if(DEMO)return; if(!firebaseReady)return;const provider=new fb.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});$('loginBtn').disabled=true;$('loginMsg').textContent='Google 로그인 창을 여는 중...';try{await fb.signInWithPopup(auth,provider)}catch(e){const c=e?.code||'';$('loginMsg').textContent=c==='auth/popup-closed-by-user'?'로그인 창이 닫혔습니다. 다시 시도하세요.':c==='auth/popup-blocked'?'팝업을 허용한 뒤 다시 시도하세요.':'로그인 오류: '+(e?.message||e)}finally{$('loginBtn').disabled=false}}
async function logout(){if(DEMO){location.href=location.pathname;return}await fb.signOut(auth)}
$('loginBtn').onclick=login;$('logoutBtn').onclick=logout;$('logoutSide').onclick=logout;$('logoutOnboarding').onclick=logout;$('demoBtn').onclick=()=>{location.href=location.pathname+'?demo=1'};

async function handleAuth(user){
  currentUser=user;
  if(!user){show('loginCard',true);show('onboarding',false);show('app',false);show('sidebar',false);show('bottomNav',false);show('topUser',false);return}
  show('loginCard',false);
  const ref=fb.doc(db,'users',user.uid);const snap=await fb.getDoc(ref);
  if(!snap.exists||!snap.data().companyId){showOnboarding(user);return}
  currentProfile={...snap.data()};companyId=currentProfile.companyId;
  if(currentProfile.status!=='active'){showOnboarding(user,'현재 계정 사용이 중지되어 있습니다. 업체 관리자에게 문의하세요.');return}
  const companySnap=await fb.getDoc(fb.doc(db,'companies',companyId));
  if(!companySnap.exists){showOnboarding(user,'업체 정보를 찾을 수 없습니다. 관리자에게 문의하세요.');return}
  currentCompany={id:companyId,...companySnap.data()};
  if(PC_MODE){await handoffToPC(user);return}
  await enterApp();
}
function showOnboarding(user,message=''){
  currentProfile=null;currentCompany=null;companyId='';show('loginCard',false);show('app',false);show('sidebar',false);show('bottomNav',false);show('topUser',false);show('onboarding',true);$('onboardingEmail').textContent=message||`${user.email||''} · 새 업체를 만들거나 초대코드로 참가하세요.`;$('ownerName').value=user.displayName||'';
}
async function enterApp(){
  show('onboarding',false);show('app',true);show('sidebar',true);show('bottomNav',true);show('topUser',true);
  $('userName').textContent=currentUser?.displayName||currentUser?.email||'';$('roleText').textContent=ROLE_LABEL[currentProfile.role]||currentProfile.role;$('sideCompanyName').textContent=currentCompany.name;$('topCompanyName').textContent=currentCompany.name;$('dashCompanyName').textContent=currentCompany.name;$('accountCompany').textContent=currentCompany.name;$('accountEmail').textContent=currentUser?.email||'';$('accountRole').textContent=ROLE_LABEL[currentProfile.role]||currentProfile.role;$('accountPlan').textContent=PLAN_LABEL[String(currentCompany.plan||'alpha').toLowerCase()]||String(currentCompany.plan||'PRO').toUpperCase();
  document.querySelectorAll('.managerOnly').forEach(e=>e.classList.toggle('permissionHidden',!canManage()));
  document.querySelectorAll('.ownerOnly').forEach(e=>e.classList.toggle('hidden',currentProfile?.role!=='owner'));
  const teamNav=document.querySelector('[data-view="Team"]');if(teamNav)teamNav.classList.toggle('hidden',!canAdmin());
  await Promise.all([loadSites(),loadRecentLogs(),refreshQueueCount()]);restoreWorklogDraft();if(canAdmin())await loadMembers();switchView('Dashboard');if(navigator.onLine&&!DEMO)syncQueue();
}

async function callFunction(name,data={}){const fn=fb.httpsCallable(functions,name);const r=await fn(data);return r.data}
$('createCompanyBtn').onclick=async()=>{const name=$('companyName').value.trim();if(!name){toast('업체명을 입력하세요.');return}const btn=$('createCompanyBtn');btn.disabled=true;btn.textContent='업체 만드는 중...';try{await callFunction('createCompany',{name,ownerName:$('ownerName').value.trim(),phone:$('companyPhone').value.trim(),address:$('companyAddress').value.trim()});toast('업체가 생성되었습니다.');await handleAuth(currentUser)}catch(e){toast(e?.message||'업체 생성에 실패했습니다.',5000)}finally{btn.disabled=false;btn.textContent='업체 만들고 시작'}};
$('joinCompanyBtn').onclick=async()=>{const code=$('inviteCode').value.trim().toUpperCase();if(!code){toast('초대코드를 입력하세요.');return}const btn=$('joinCompanyBtn');btn.disabled=true;try{await callFunction('joinCompany',{code});toast('업체에 연결되었습니다.');await handleAuth(currentUser)}catch(e){toast(e?.message||'초대코드를 확인하세요.',5000)}finally{btn.disabled=false}};

async function handoffToPC(user){
  if(!['owner','admin'].includes(currentProfile?.role)){alert('PC 관리 프로그램 연결은 대표 또는 관리자 계정만 사용할 수 있습니다.');await logout();return}
  if(!PC_PORT||!PC_NONCE){alert('PC 연결정보가 없습니다. PC 프로그램에서 다시 로그인하세요.');return}
  const idToken=await user.getIdToken(true),refreshToken=user.refreshToken||user.stsTokenManager?.refreshToken||'';const f=document.createElement('form');f.method='POST';f.action=`http://127.0.0.1:${encodeURIComponent(PC_PORT)}/token`;const vals={idToken,refreshToken,email:user.email||'',uid:user.uid,companyId,role:currentProfile.role,nonce:PC_NONCE};for(const [k,v] of Object.entries(vals)){const i=document.createElement('input');i.type='hidden';i.name=k;i.value=v;f.appendChild(i)}document.body.appendChild(f);f.submit();
}

async function loadSites(){
  if(DEMO){sites=JSON.parse(demoGet('j365_demo_sites','null'))||[{id:'demo1',name:'학산리 957',site:'경상북도 의성군 다인면 학산리 957',status:'active',client:'농장주',active:true},{id:'demo2',name:'도남동 268',site:'대구광역시 북구 도남동 268',status:'active',client:'개인',active:true},{id:'demo3',name:'창평리 관정',site:'경상북도 칠곡군 지천면 창평리',status:'planned',client:'',active:true}];renderSites();return}
  const snap=await fb.getDocs(fb.query(fb.collection(db,...companyPath('sites')),fb.orderBy('name')));sites=snap.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.active!==false);renderSites();
}
function statusTag(x){const s=x.status||'active';return `<span class="statusTag ${esc(s)}">${esc(STATUS_LABEL[s]||s)}</span>`}
function renderSites(){
  const sel=$('siteSelect'),prev=sel.value;sel.innerHTML='<option value="">현장을 선택하세요</option>'+sites.map(x=>`<option value="${esc(x.id)}">${esc(x.name||x.site||x.id)}</option>`).join('');if(sites.some(x=>x.id===prev))sel.value=prev;
  const q=($('siteSearchInput')?.value||'').trim().toLowerCase(),status=$('siteStatusFilter')?.value||'all';const visible=sites.filter(x=>(status==='all'||(x.status||'active')===status)&&(!q||`${x.name||''} ${x.site||''} ${x.client||''}`.toLowerCase().includes(q)));
  const board=$('sitesOverview');
  if(!sites.length)board.innerHTML=emptyStateHtml('첫 현장','첫 현장을 등록해 보세요','주소와 GPS를 저장하면 지하수365가 현장관리를 시작합니다.','새 현장','emptyAddSite');
  else if(!visible.length)board.innerHTML=emptyStateHtml('검색','조건에 맞는 현장이 없습니다','검색어 또는 상태 필터를 바꿔보세요.');
  else board.innerHTML=visible.map(x=>`<article class="siteCard" data-site="${esc(x.id)}"><div class="siteCardTop"><h3>${esc(x.name||x.site||'현장')}</h3>${statusTag(x)}</div><p class="address">${esc(x.site||'주소 미입력')}</p><div class="siteMeta"><span>${esc(x.client||'고객 미입력')}</span><span>공사일보 ${logs.filter(l=>l.siteId===x.id).length}건</span></div><div class="siteCardFoot"><span>${siteCoords(x)?'GPS 등록됨':'GPS 미등록'}</span><em>상세 보기 →</em></div></article>`).join('');
  board.querySelectorAll('[data-site]').forEach(e=>e.addEventListener('click',()=>openSiteDetail(e.dataset.site)));if($('emptyAddSite'))$('emptyAddSite').onclick=()=>{$('openAddSite').click()};
  renderDashboardSites();if(!$('sitesMapPane')?.classList.contains('hidden'))renderGroundwaterMap();updateRecentCopyButton();updatePhotoLocationState();
}
$('sitesTabList').onclick=()=>switchSitesMode('list');$('sitesTabMap').onclick=()=>switchSitesMode('map');if($('siteSearchInput'))$('siteSearchInput').addEventListener('input',renderSites);if($('siteStatusFilter'))$('siteStatusFilter').addEventListener('change',renderSites);$('openGimsBtn').onclick=()=>openGims();$('mapMyLocationBtn').onclick=()=>{if(!navigator.geolocation){toast('GPS를 사용할 수 없습니다.');return}navigator.geolocation.getCurrentPosition(p=>{switchSitesMode('map');if(initGroundwaterMap())groundwaterMap.setView([p.coords.latitude,p.coords.longitude],16);toast('현재 위치로 이동했습니다.')},()=>toast('위치 권한을 확인하세요.',4500),{enableHighAccuracy:true,timeout:10000})};document.querySelectorAll('[data-gims-layer]').forEach(b=>b.onclick=()=>openGims(b.dataset.gimsLayer));$('newSiteGpsBtn').onclick=captureNewSiteGps;
$('siteSelect').onchange=()=>{const x=sites.find(s=>s.id===$('siteSelect').value);$('siteAddress').value=x?.site||'';updateRecentCopyButton();updatePhotoLocationState();saveWorklogDraft()};
$('openAddSite').onclick=()=>show('addSitePanel',true);$('closeAddSite').onclick=()=>show('addSitePanel',false);$('quickAddSite').onclick=()=>{switchView('Sites');show('addSitePanel',true);setTimeout(()=>$('newSiteName').focus(),50)};
$('addSiteBtn').onclick=async()=>{const name=$('newSiteName').value.trim(),site=$('newSiteAddress').value.trim();if(!name||!site){toast('현장명과 주소를 확인하세요.');return}const lat=Number($('newSiteLat').value),lng=Number($('newSiteLng').value);const data={name,site,status:$('newSiteStatus').value,client:$('newSiteClient').value.trim(),phone:$('newSitePhone').value.trim(),active:true,companyId:companyId||'demo-company',createdBy:currentUser?.uid||'demo-owner',createdAt:new Date().toISOString(),...(Number.isFinite(lat)&&Number.isFinite(lng)?{lat,lng}:{})};try{if(DEMO){data.id=uid();sites.push(data);demoSet('j365_demo_sites',JSON.stringify(sites))}else{const ref=fb.doc(fb.collection(db,...companyPath('sites')));await fb.setDoc(ref,data)}['newSiteName','newSiteAddress','newSiteClient','newSitePhone','newSiteLat','newSiteLng'].forEach(id=>$(id).value='');newSiteGps={lat:null,lng:null};$('newSiteGpsText').textContent='GPS 미입력';$('newSiteGpsBtn').textContent='현재 GPS 저장';$('newSiteName').dataset.auto='0';show('addSitePanel',false);await loadSites();toast('현장이 등록되었습니다.')}catch(e){toast('현장 등록 실패: '+(e?.message||e),5000)}};
function siteTimelineHtml(x){
  const phase=x.permitPhase||'start',completed=(x.status==='completed');const hasLogs=logs.some(l=>l.siteId===x.id);let level=2;if(hasLogs)level=3;if(phase==='end')level=Math.max(level,4);if(phase==='completion')level=Math.max(level,5);if(completed)level=6;
  const steps=[['현장 등록',1],['굴착·이용 신고',2],['굴착 진행',3],['종료신고',4],['준공신고',5]];
  return `<div class="siteFlow"><div class="siteFlowHead"><b>진행 타임라인</b><small>현재 단계와 다음 업무를 한눈에 확인합니다.</small></div><div class="siteFlowSteps">${steps.map(([label,n])=>`<div class="siteFlowStep ${n<level?'done':n===level?'current':'upcoming'}"><i>${n<level?'✓':n}</i><span>${label}</span></div>`).join('')}</div></div>`;
}
function sitePhotoChecklistHtml(x){const got=new Set(logs.filter(l=>l.siteId===x.id).flatMap(l=>(l.photos||[]).map(p=>p.category).filter(Boolean)));const items=['착공전','굴착중','케이싱','보호공','펌프','준공'];return `<div class="photoChecklist"><div class="siteFlowHead"><b>사진 체크리스트</b><small>공정별 사진 누락을 빠르게 확인합니다.</small></div><div class="photoChecklistGrid">${items.map(k=>`<span class="${got.has(k)?'done':''}"><i>${got.has(k)?'✓':'○'}</i>${k}</span>`).join('')}</div></div>`}
function openSiteDetail(id){const x=sites.find(s=>s.id===id);if(!x)return;$('siteModalName').textContent=x.name||'현장';const count=logs.filter(l=>l.siteId===id).length;const c=siteCoords(x);$('siteModalBody').innerHTML=`<div class="siteDetailHero"><div class="siteDetailTitleRow"><b>${esc(x.site||'주소 미입력')}</b>${statusTag(x)}</div><p>${esc(x.client||'고객 미입력')} ${x.phone?'· '+esc(x.phone):''}</p>${c?`<small class="coordText">GPS ${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}</small>`:'<small class="coordText muted">GPS 좌표 미입력</small>'}</div>${siteTimelineHtml(x)}${sitePhotoChecklistHtml(x)}<div class="actionTiles"><button class="actionTile ready" data-action="log"><b>공사일보 작성</b><small>이 현장을 선택해 바로 기록</small></button><button class="actionTile ready" data-action="photo"><b>현장 사진 촬영</b><small>공정별로 분류해 바로 촬영</small></button><button class="actionTile ready" data-action="map"><b>지하수지도</b><small>관정 위치와 공식 GIMS 확인</small></button><button class="actionTile ready" data-action="docs"><b>행정서류</b><small>5단계 질문식 신고서 작성</small></button><button class="actionTile" data-action="history"><b>기록 ${count}건</b><small>최근 공사일보 확인</small></button></div>`;show('siteModal',true);const body=$('siteModalBody');body.querySelector('[data-action="log"]').onclick=()=>{show('siteModal',false);switchView('Today');$('siteSelect').value=id;$('siteSelect').dispatchEvent(new Event('change'))};body.querySelector('[data-action="photo"]').onclick=()=>{show('siteModal',false);switchView('Today');$('siteSelect').value=id;$('siteSelect').dispatchEvent(new Event('change'));setTimeout(()=>$('cameraBtn').click(),180)};body.querySelector('[data-action="map"]').onclick=()=>{show('siteModal',false);switchView('Sites');setTimeout(()=>switchSitesMode('map',id),80)};body.querySelector('[data-action="history"]').onclick=()=>{show('siteModal',false);switchView('Logs')};body.querySelector('[data-action="docs"]').onclick=()=>{show('siteModal',false);openPermitWizard(id)}}
$('closeSiteModal').onclick=()=>show('siteModal',false);

function recentLogForSelectedSite(){const id=$('siteSelect')?.value;if(!id)return null;return logs.filter(l=>l.siteId===id).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(b.createdAt||'').localeCompare(String(a.createdAt||'')))[0]||null}
function updateRecentCopyButton(){const b=$('copyRecentLogBtn'),hint=$('copyRecentHint');if(!b)return;const x=recentLogForSelectedSite();b.disabled=!x;if(hint){hint.classList.toggle('hidden',!x);hint.textContent=x?`${x.date||'최근'} · ${String(x.work||x.note||'기록').slice(0,48)}`:''}}
function copyRecentWorklog(){const x=recentLogForSelectedSite();if(!x){toast('불러올 이전 공사일보가 없습니다.');return}const map={workers:x.workers||'',work:x.work||'',depth:x.progressDepth||'',equipment:x.equipment||'',materials:x.materials||'',note:x.note||''};Object.entries(map).forEach(([id,v])=>{if($(id))$(id).value=v});saveWorklogDraft();toast(`${x.date||'최근'} 공사일보를 불러왔습니다. 오늘 내용만 수정하세요.`,4500)}
if($('copyRecentLogBtn'))$('copyRecentLogBtn').onclick=copyRecentWorklog;
function buildRecord(){const site=sites.find(s=>s.id===$('siteSelect').value);return{id:uid(),companyId:companyId||'demo-company',siteId:site?.id||'',siteName:site?.name||'',siteAddress:site?.site||'',date:$('date').value,workers:$('workers').value.trim(),work:$('work').value.trim(),progressDepth:$('depth').value.trim(),equipment:$('equipment').value.trim(),materials:$('materials').value.trim(),note:$('note').value.trim(),photos:photos.map(x=>({...x})),createdAt:new Date().toISOString(),createdBy:currentUser?.uid||'demo-owner',createdByEmail:currentUser?.email||'demo@local'} }
function validRecord(r){if(!r.siteId){toast('현장을 선택하세요.');return false}if(!r.date){toast('작업일을 선택하세요.');return false}if(!r.work&&!r.note&&!r.photos.length){toast('작업내용, 특이사항 또는 사진을 입력하세요.');return false}return true}
function dataUrlToBlob(data){const [head,b64]=data.split(','),mime=(head.match(/data:([^;]+)/)||[])[1]||'image/jpeg',bin=atob(b64),arr=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);return new Blob([arr],{type:mime})}
async function uploadRecord(r){
  if(DEMO){const xs=JSON.parse(demoGet('j365_demo_logs','[]'));xs.unshift({...r,photos:r.photos.map(x=>({name:x.name,url:x.data}))});demoSet('j365_demo_logs',JSON.stringify(xs.slice(0,100)));return}
  if(r.companyId!==companyId)throw new Error('다른 업체의 대기 기록입니다.');
  const photoMeta=[];for(let i=0;i<r.photos.length;i++){const p=r.photos[i];const path=`companies/${companyId}/sites/${r.siteId}/worklogs/${r.id}/${currentUser.uid}/${r.date}_${String(i+1).padStart(2,'0')}.jpg`;const sr=fb.ref(storage,path),blob=dataUrlToBlob(p.data);await fb.uploadBytes(sr,blob,{contentType:'image/jpeg',customMetadata:{ownerUid:currentUser.uid,companyId,siteId:r.siteId,worklogId:r.id}});const url=await fb.getDownloadURL(sr);photoMeta.push({name:p.name,path,url,category:p.category||'기타',capturedAt:p.capturedAt||r.createdAt||new Date().toISOString(),...(Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng))?{lat:Number(p.lat),lng:Number(p.lng)}:{})})}
  const data={...r,photos:photoMeta};delete data.id;await fb.setDoc(fb.doc(db,'companies',companyId,'worklogs',r.id),data);
}
$('saveBtn').onclick=async()=>{const r=buildRecord();if(!validRecord(r))return;$('saveBtn').disabled=true;try{setStatus('클라우드에 저장 중...');setSyncState('저장 중…','working');if(!navigator.onLine&&!DEMO)throw new Error('offline');await uploadRecord(r);clearForm();setStatus('클라우드 저장 완료');setSyncState(`동기화 완료 · ${new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}`,'ok');await loadRecentLogs();toast('공사일보가 저장되었습니다.')}catch(e){await qPut(r);setStatus('오프라인 · 기기에 안전하게 저장했습니다.');setSyncState('오프라인 · 전송 대기','offline');toast('기기에 저장됨 · 연결되면 자동 전송합니다.')}finally{$('saveBtn').disabled=false;await refreshQueueCount()}};
function clearForm(){['workers','work','depth','equipment','materials','note'].forEach(id=>$(id).value='');$('galleryInput').value='';$('cameraInput').value='';photos=[];clearWorklogDraft();renderPhotos();updateRecentCopyButton();updatePhotoLocationState()}
async function syncQueue(){if(DEMO){toast('데모에서는 전송 대기함을 사용하지 않습니다.');return}const xs=await qAll(),mine=xs.filter(x=>x.companyId===companyId);if(!mine.length){setSyncState('동기화 완료','ok');toast('전송 대기 기록이 없습니다.');return}if(!navigator.onLine&&!DEMO){setSyncState(`오프라인 · ${mine.length}건 보관`,'offline');toast('인터넷 연결 후 다시 시도하세요.');return}setSyncState(`${mine.length}건 전송 중…`,'working');let ok=0,fail=0;for(const r of mine){try{await uploadRecord(r);await qDel(r.id);ok++}catch(e){fail++}}setStatus(`전송 완료: 성공 ${ok} / 실패 ${fail}`);setSyncState(fail?`전송 실패 ${fail}건`:'동기화 완료',fail?'pending':'ok');await refreshQueueCount();if(ok){await loadRecentLogs();toast(`${ok}건을 클라우드에 전송했습니다.`)}}
$('syncQueueBtn').onclick=syncQueue;$('syncQueueMirror').onclick=syncQueue;window.addEventListener('online',()=>{updateNetworkBadge();setSyncState('연결됨 · 동기화 확인 중','working');syncQueue()});window.addEventListener('offline',()=>{updateNetworkBadge();setStatus('오프라인 · 입력 내용은 기기에 임시저장됩니다.');setSyncState('오프라인 · 기기 저장','offline')});

async function loadRecentLogs(force=false){
  if(DEMO){logs=JSON.parse(demoGet('j365_demo_logs','null'))||[{id:'l1',siteId:'demo1',siteName:'학산리 957',date:localDate(),work:'굴착 진행 및 외부케이싱 설치',note:'',photos:[{}],createdAt:new Date().toISOString(),createdByEmail:'demo@local'},{id:'l2',siteId:'demo2',siteName:'도남동 268',date:localDate(),work:'펌프 설치 및 시험가동',note:'',photos:[{},{}],createdAt:new Date(Date.now()-86400000).toISOString(),createdByEmail:'demo@local'}];renderLogs();return}
  try{const q=fb.query(fb.collection(db,...companyPath('worklogs')),fb.orderBy('createdAt','desc'),fb.limit(60));const s=await fb.getDocs(q);logs=s.docs.map(d=>({id:d.id,...d.data()}));renderLogs()}catch(e){if(force)toast('공사일보를 불러오지 못했습니다.');$('recentLogs').innerHTML='<div class="empty">공사일보를 불러오지 못했습니다.</div>'}
}
function logHtml(x){return `<div class="logRow"><div class="logDate">${esc(x.date||'')}</div><div class="logBody"><b>${esc(x.siteName||'현장')}</b><p>${esc((x.work||x.note||'기록').slice(0,120))}${x.progressDepth?` · ${esc(x.progressDepth)}m`:''}</p></div><span class="photoCount">사진 ${(x.photos||[]).length}</span></div>`}
function renderLogs(){if($('recentLogs'))$('recentLogs').innerHTML=logs.length?logs.map(logHtml).join(''):emptyStateHtml('기록','아직 공사일보가 없습니다','현장에서 첫 작업 기록을 남겨보세요.','공사일보 작성','emptyNewLog');if($('dashLogs'))$('dashLogs').innerHTML=logs.length?logs.slice(0,5).map(logHtml).join(''):emptyStateHtml('기록','최근 기록이 없습니다','첫 공사일보를 작성하면 여기에 표시됩니다.');if($('emptyNewLog'))$('emptyNewLog').onclick=()=>switchView('Today');renderSites();updateRecentCopyButton();refreshDashboard()}
$('refreshLogsBtn').onclick=()=>loadRecentLogs(true);

async function loadMembers(){
  if(!canAdmin()&& !DEMO)return;
  if(DEMO){members=[{uid:'demo-owner',displayName:'김대표',email:'owner@example.com',role:'owner',status:'active'},{uid:'demo-worker',displayName:'현장직원',email:'worker@example.com',role:'worker',status:'active'}];renderMembers();return}
  try{const s=await fb.getDocs(fb.collection(db,'companies',companyId,'members'));members=s.docs.map(d=>({uid:d.id,...d.data()}));renderMembers()}catch(e){toast('직원 목록을 불러오지 못했습니다.')}
}
function renderMembers(){const active=members.filter(x=>x.status==='active');$('statMembers').textContent=active.length;$('memberCountBadge').textContent=`${active.length}명`;$('usersList').innerHTML=members.length?members.map(x=>`<div class="memberRow"><div class="memberIdentity"><div class="avatar">${esc((x.displayName||x.email||'?').slice(0,1))}</div><div><b>${esc(x.displayName||x.email||x.uid)} <span class="roleBadge">${esc(ROLE_LABEL[x.role]||x.role)}</span></b><small>${esc(x.email||'')} · ${x.status==='active'?'사용중':'중지'}</small></div></div>${x.role!=='owner'&&canAdmin()?`<button class="btn soft memberStatus" data-uid="${esc(x.uid)}" data-status="${x.status==='active'?'disabled':'active'}">${x.status==='active'?'사용중지':'다시사용'}</button>`:''}</div>`).join(''):'<div class="empty">등록된 직원이 없습니다.</div>';$('usersList').querySelectorAll('.memberStatus').forEach(b=>b.onclick=()=>setMemberStatus(b.dataset.uid,b.dataset.status))}
async function setMemberStatus(uid,status){if(DEMO){const m=members.find(x=>x.uid===uid);if(m)m.status=status;renderMembers();toast('데모에서 상태를 변경했습니다.');return}try{await callFunction('setMemberStatus',{uid,status});await loadMembers();toast(status==='active'?'직원 사용을 다시 활성화했습니다.':'직원 사용을 중지했습니다.')}catch(e){toast(e?.message||'상태 변경 실패',5000)}}
$('createInviteBtn').onclick=async()=>{try{let r;if(DEMO){r={code:'J365-DEMO-7K',expiresAt:new Date(Date.now()+604800000).toISOString()}}else{r=await callFunction('createInvite',{role:'worker'})}$('inviteResultCode').textContent=r.code;$('inviteExpire').textContent='7일간 유효';show('inviteResult',true);toast('초대코드가 만들어졌습니다.')}catch(e){toast(e?.message||'초대코드 생성 실패',5000)}};
$('copyInviteBtn').onclick=async()=>{try{await navigator.clipboard.writeText($('inviteResultCode').textContent);toast('초대코드를 복사했습니다.')}catch(e){toast('코드를 길게 눌러 복사해 주세요.')}};

function emptyStateHtml(icon,title,desc,action='',id=''){return `<div class="emptyState"><div class="emptyStateIcon">${icon}</div><b>${esc(title)}</b><span>${esc(desc)}</span>${action?`<button ${id?`id="${id}"`:''} class="btn soft" type="button">${esc(action)}</button>`:''}</div>`}
function renderDashboardSites(){$('dashSites').innerHTML=sites.length?sites.slice(0,5).map(x=>`<div class="siteRow" data-dash-site="${esc(x.id)}"><div><b>${esc(x.name||'현장')}</b><small>${esc(x.site||'')}</small></div>${statusTag(x)}</div>`).join(''):emptyStateHtml('첫 현장','첫 현장을 등록해 보세요','현장을 등록하면 공사일보와 서류가 연결됩니다.','새 현장','dashEmptyAdd');$('dashSites').querySelectorAll('[data-dash-site]').forEach(e=>e.onclick=()=>openSiteDetail(e.dataset.dashSite));if($('dashEmptyAdd'))$('dashEmptyAdd').onclick=()=>{$('quickAddSite').click()}}
async function buildTodayTasks(){const tasks=[];const today=localDate(),active=sites.filter(x=>(x.status||'active')==='active');const todaySiteIds=new Set(logs.filter(l=>l.date===today).map(l=>l.siteId));for(const x of active){if(!todaySiteIds.has(x.id))tasks.push({tone:'orange',icon:'i-log',title:`${x.name} · 오늘 공사일보`,desc:'오늘 작업 기록이 아직 없습니다.',action:'log',siteId:x.id});if(!siteCoords(x))tasks.push({tone:'blue',icon:'i-pin',title:`${x.name} · GPS 위치`,desc:'관정 위치를 저장하면 지하수지도에서 바로 찾을 수 있습니다.',action:'site',siteId:x.id})}
  let q=0;try{q=DEMO?0:(await qAll()).filter(x=>x.companyId===companyId).length}catch(e){}if(q)tasks.unshift({tone:'red',icon:'i-sync',title:`전송 대기 ${q}건`,desc:'인터넷 연결 후 클라우드로 전송해 주세요.',action:'sync'});
  return tasks.slice(0,6)}
async function renderTodayTasks(){const box=$('todayTasks');if(!box)return;const tasks=await buildTodayTasks();$('todayTaskCount').textContent=`${tasks.length}건`;box.innerHTML=tasks.length?tasks.map((t,i)=>`<button class="todayTask ${t.tone}" data-task-index="${i}"><span class="todayTaskIcon"><svg><use href="#${t.icon}"/></svg></span><span><b>${esc(t.title)}</b><small>${esc(t.desc)}</small></span><em>›</em></button>`).join(''):emptyStateHtml('완료','오늘 급한 일이 없습니다','현재 등록된 현장 기록이 모두 정리되어 있습니다.');box.querySelectorAll('[data-task-index]').forEach(b=>b.onclick=()=>{const t=tasks[Number(b.dataset.taskIndex)];if(!t)return;if(t.action==='log'){switchView('Today');$('siteSelect').value=t.siteId;$('siteSelect').dispatchEvent(new Event('change'))}else if(t.action==='site'){openSiteDetail(t.siteId)}else if(t.action==='sync')syncQueue()})}
async function refreshDashboard(){if(!$('statSites'))return;$('statSites').textContent=sites.filter(x=>(x.status||'active')!=='completed').length;const ym=localDate().slice(0,7);$('statLogs').textContent=logs.filter(x=>String(x.date||'').startsWith(ym)).length;await refreshQueueCount();renderDashboardSites();await renderTodayTasks();if($('dashLogs'))$('dashLogs').innerHTML=logs.length?logs.slice(0,5).map(logHtml).join(''):emptyStateHtml('기록','최근 기록이 없습니다','첫 공사일보를 작성하면 여기에 표시됩니다.')}




async function clearLocalCompanyData(){
  try{for(const k of Object.keys(localStorage)){if(k.startsWith('j365_worklog_draft_')||k.startsWith('j365_permit_')||k.startsWith('h365_permit_'))localStorage.removeItem(k)}}catch(e){}
  try{const xs=await qAll();for(const x of xs){if(!companyId||x.companyId===companyId)await qDel(x.id)}}catch(e){}
}

async function deleteCurrentAccount(){
  if(DEMO){toast('데모 계정은 삭제할 데이터가 없습니다.');return}
  if(!currentUser){toast('로그인이 필요합니다.');return}
  const owner=currentProfile?.role==='owner';
  const msg=owner
    ? '대표 계정을 삭제하면 현재 업체의 현장, 공사일보, 문서, 사진을 포함한 회사 작업공간 전체가 삭제됩니다. 이 작업은 되돌릴 수 없습니다. 계속할까요?'
    : '내 계정과 개인 식별정보가 삭제됩니다. 회사 업무기록은 회사 소유 자료로 남을 수 있으며 작성자 정보는 익명화됩니다. 계속할까요?';
  if(!confirm(msg))return;
  const typed=prompt('최종 확인을 위해 “삭제”라고 입력해 주세요.');
  if(typed!=='삭제'){toast('계정 삭제가 취소되었습니다.');return}
  const btn=$('deleteAccountBtn'); if(btn){btn.disabled=true;btn.textContent='삭제 처리 중...'}
  try{
    await callFunction('deleteMyAccount',{confirm:true});
    await clearLocalCompanyData();
    try{await fb.signOut(auth)}catch(e){}
    location.replace('/account-deleted.html');
  }catch(e){
    toast(e?.message||'계정 삭제에 실패했습니다.',6000);
    if(btn){btn.disabled=false;btn.textContent='내 계정 삭제'}
  }
}
if($('deleteAccountBtn'))$('deleteAccountBtn').onclick=deleteCurrentAccount;

$('migrateLegacyBtn').onclick=async()=>{
  if(DEMO){toast('데모에서는 기존 자료 이전을 실행하지 않습니다.');return}
  const btn=$('migrateLegacyBtn');btn.disabled=true;const old=btn.textContent;btn.textContent='기존 자료 확인 중...';
  try{
    const check=await callFunction('migrateLegacyData',{dryRun:true});
    if(!check.sites&&!check.worklogs){toast('이전할 기존 자료가 없습니다.');return}
    const ok=confirm(`기존 자료를 현재 업체로 복사합니다.\n\n현장 ${check.sites}건\n공사일보 ${check.worklogs}건\n\n기존 원본은 삭제하지 않습니다. 계속할까요?`);
    if(!ok)return;
    btn.textContent='자료 이전 중...';const r=await callFunction('migrateLegacyData',{dryRun:false});
    toast(`자료 이전 완료 · 현장 ${r.sites}건 · 공사일보 ${r.worklogs}건`,5000);await Promise.all([loadSites(),loadRecentLogs(true)]);refreshDashboard();
  }catch(e){toast(e?.message||'자료 이전에 실패했습니다.',6000)}finally{btn.disabled=false;btn.textContent=old}
};


// -----------------------------------------------------------------------------
// Alpha 0.2 - 안드로이드/PWA 질문식 신고서 작성
// -----------------------------------------------------------------------------
const PERMIT_FORM_LABEL={'22':'굴착행위 신고서','9':'지하수개발·이용 신고서','25':'굴착행위 종료신고서','13':'지하수개발·이용 준공신고서'};
const PERMIT_PHASES={
  start:{label:'굴착 시작 전',desc:'굴착행위 신고 + 개발·이용 신고',codes:['22','9']},
  end:{label:'굴착 종료',desc:'굴착행위 종료 신고',codes:['25']},
  completion:{label:'준공 완료',desc:'지하수개발·이용 준공 신고',codes:['13']},
  all:{label:'4종 모두',desc:'굴착·이용·종료·준공 4종 전체',codes:['22','9','25','13']}
};
const PERMIT_REQ={
 '22':['name','birth','phone','address','site','coord1','coord2','depth','diameter','purpose','use','start_plan','restore_plan'],
 '25':['name','birth','phone','address','site','coord1','coord2','depth','diameter','reportno'],
 '9':['name','birth','phone','address','site','coord1','coord2','use','drink','depth','diameter','planned','hp','pipe','pumpdepth','capacity','start_plan','finish_plan'],
 '13':['name','birth','phone','address','site','coord1','coord2','use','drink','depth','diameter','planned','hp','pipe','pumpdepth','capacity','outlet','meter','level','upper_w','upper_d','upper_h','lower','grout','start_real','finish_real']
};
const PERMIT_LABEL={name:'신고인 성명',birth:'생년월일',phone:'연락처',address:'신고인 주소',site:'현장 주소',coord1:'경도(DMS)',coord2:'위도(DMS)',purpose:'굴착 목적',use:'사용 용도',drink:'먹는물 사용 여부',depth:'굴착 깊이',diameter:'굴착 지름',planned:'취수계획량',hp:'펌프 동력',pipe:'토출관 지름',pumpdepth:'펌프 설치 깊이',capacity:'양수능력',reportno:'굴착 신고번호',start_plan:'착공 예정',finish_plan:'준공 예정',restore_plan:'원상복구 예정',outlet:'출수장치',meter:'적산유량계 번호',level:'수위측정관',upper_w:'상부보호공 가로',upper_d:'상부보호공 세로',upper_h:'상부보호공 높이',lower:'지표하부보호벽',grout:'그라우팅 두께',start_real:'실제 착공',finish_real:'실제 준공',work_note:'공사 내용'};
const PERMIT_META={
 name:{title:'신고인 성명을 입력해 주세요.',hint:'개인인 경우 성명, 법인인 경우 법인명을 입력합니다.',type:'text',placeholder:'예: 김윤호'},
 birth:{title:'신고인의 생년월일은 언제입니까?',hint:'법인은 법인등록번호를 입력할 수 있습니다.',type:'date',placeholder:'예: 1980-01-01'},
 phone:{title:'연락처를 입력해 주세요.',hint:'신고서에 표시될 전화번호입니다.',type:'tel',placeholder:'010-0000-0000'},
 address:{title:'신고인 주소는 어디입니까?',hint:'주소검색을 사용하면 오타를 줄일 수 있습니다.',type:'address',placeholder:'주소를 입력하거나 검색하세요'},
 site:{title:'개발·이용할 현장을 확인해 주세요.',hint:'선택한 현장 주소입니다. 현장 정보에서 변경할 수 있습니다.',type:'readonly'},
 coords:{title:'현장 좌표를 입력해 주세요.',hint:'현장에 있다면 “현재 GPS 사용”을 누르세요. 다른 장소에서는 직접 입력해야 합니다.',type:'coords'},
 use:{title:'지하수 사용 용도는 무엇입니까?',hint:'해당하는 용도를 선택하세요.',type:'choice',options:['생활용수(일반용)','농업용수(전작용)','농업용수(답작용)','공업용수','음용수']},
 drink:{title:'먹는물로 사용할 예정입니까?',hint:'음용 여부에 따라 수질검사 등 후속 절차가 달라질 수 있습니다.',type:'choice',options:['비음용','음용']},
 depth:{title:'굴착 깊이는 몇 m입니까?',hint:'예정 또는 실제 깊이를 숫자로 입력합니다.',type:'number',unit:'m',placeholder:'100'},
 diameter:{title:'굴착 지름은 몇 mm입니까?',hint:'굴착공의 지름을 입력합니다.',type:'number',unit:'mm',placeholder:'150'},
 planned:{title:'하루 취수계획량은 몇 톤(㎥)입니까?',hint:'1톤의 물은 약 1㎥로 계산합니다.',type:'number',unit:'㎥/일',placeholder:'50'},
 hp:{title:'설치할 펌프 동력은 몇 HP입니까?',hint:'1/2마력은 0.5로 입력합니다.',type:'number',unit:'HP',placeholder:'0.5'},
 pipe:{title:'토출관 안쪽 지름은 몇 mm입니까?',hint:'예: 25mm',type:'number',unit:'mm',placeholder:'25'},
 pumpdepth:{title:'펌프 설치 깊이는 몇 m입니까?',hint:'수중펌프가 설치되는 깊이를 입력합니다.',type:'number',unit:'m',placeholder:'80'},
 capacity:{title:'양수능력은 하루 몇 ㎥입니까?',hint:'설비 기준 양수능력을 입력합니다.',type:'number',unit:'㎥/일',placeholder:'50'},
 reportno:{title:'굴착 신고번호를 입력해 주세요.',hint:'굴착행위 종료신고서에 필요한 신고번호입니다.',type:'text',placeholder:'예: 의성-2026-001'},
 start_plan:{title:'착공 예정 월은 언제입니까?',hint:'연·월만 선택하면 됩니다.',type:'month'},
 finish_plan:{title:'준공 예정 월은 언제입니까?',hint:'연·월만 선택하면 됩니다.',type:'month'},
 restore_plan:{title:'원상복구 예정 월은 언제입니까?',hint:'굴착행위 신고 단계의 예정일입니다.',type:'month'},
 outlet:{title:'출수장치 지름은 몇 mm입니까?',hint:'준공신고 시설내역에 들어갑니다.',type:'number',unit:'mm',placeholder:'25'},
 meter:{title:'적산유량계 번호를 입력해 주세요.',hint:'설치된 계량기의 식별번호입니다.',type:'text',placeholder:'예: FM-2026-001'},
 level:{title:'수위측정관 지름은 몇 mm입니까?',hint:'예: 25mm',type:'number',unit:'mm',placeholder:'25'},
 upper_w:{title:'상부보호공 가로 길이는 몇 cm입니까?',hint:'보호공 규격을 입력합니다.',type:'number',unit:'cm',placeholder:'110'},
 upper_d:{title:'상부보호공 세로 길이는 몇 cm입니까?',hint:'보호공 규격을 입력합니다.',type:'number',unit:'cm',placeholder:'100'},
 upper_h:{title:'상부보호공 높이는 몇 cm입니까?',hint:'보호공 규격을 입력합니다.',type:'number',unit:'cm',placeholder:'115'},
 lower:{title:'지표하부보호벽 깊이는 몇 cm입니까?',hint:'예: 600cm',type:'number',unit:'cm',placeholder:'600'},
 grout:{title:'그라우팅 두께는 몇 cm입니까?',hint:'예: 5cm',type:'number',unit:'cm',placeholder:'5'},
 start_real:{title:'실제 착공 월은 언제입니까?',hint:'준공신고 기준 실제 착공 시점을 입력합니다.',type:'month'},
 finish_real:{title:'실제 준공 월은 언제입니까?',hint:'실제 준공 시점을 입력합니다.',type:'month'},
 work_note:{title:'공사 내용을 간단히 적어 주세요.',hint:'선택사항입니다. 예: 굴착 및 펌프 설치 완료',type:'text',placeholder:'공사 내용'}
};
let permitWizard={siteId:'',phase:'start',codes:['22','9'],data:{},questions:[],index:-1,generated:[]};

function defaultPermitData(site){
  return {name:'',birth:'',phone:'',address:'',site:site?.site||'',siteName:site?.name||'',coord1:'',coord2:'',purpose:'지하수개발',use:'생활용수(일반용)',drink:'비음용',depth:'100',diameter:'150',planned:'50',hp:'0.5',pipe:'25',pumpdepth:'80',capacity:'50',reportno:'',start_plan:'',finish_plan:'',restore_plan:'',outlet:'25',meter:'',level:'25',upper_w:'110',upper_d:'100',upper_h:'115',lower:'600',grout:'5',start_real:'',finish_real:'',work_note:''};
}
function permitDraftKey(siteId){return `j365_permit_${companyId||'demo'}_${siteId}`}
function loadPermitDraft(site){
  const base=defaultPermitData(site);let remote=site?.permitProfile||null,local=null;
  try{
    const raw=JSON.parse(demoGet(permitDraftKey(site.id),'null'));
    if(raw?.data&&raw?.updatedAt&&Date.now()-raw.updatedAt<=7*86400000)local=raw.data;
    else if(raw&&!raw.updatedAt)local=raw; // 이전 데모 초안 호환
  }catch(e){}
  const saved=local||remote||null;
  return {...base,...(saved||{}),site:site?.site||base.site,siteName:site?.name||base.siteName};
}
function savePermitLocalDraft(){if(!permitWizard.siteId)return;try{demoSet(permitDraftKey(permitWizard.siteId),JSON.stringify({updatedAt:Date.now(),data:permitWizard.data,phase:permitWizard.phase}))}catch(e){}}
function clearPermitLocalDraft(){if(!permitWizard.siteId)return;try{localStorage.removeItem(permitDraftKey(permitWizard.siteId))}catch(e){}}
function snapshotPermitValue(){
  if(permitWizard.index<0||permitWizard.index>=permitWizard.questions.length)return;
  const key=permitWizard.questions[permitWizard.index],meta=PERMIT_META[key]||{};
  if(key==='coords'){if($('permitCoord1'))permitWizard.data.coord1=$('permitCoord1').value.trim();if($('permitCoord2'))permitWizard.data.coord2=$('permitCoord2').value.trim()}
  else if(meta.type!=='choice'&&$('permitValue'))permitWizard.data[key]=$('permitValue').value.trim();
}
function fieldsForCodes(codes){
  const order=['name','birth','phone','address','site','coords','use','drink','depth','diameter','planned','hp','pipe','pumpdepth','capacity','reportno','start_plan','finish_plan','restore_plan','outlet','meter','level','upper_w','upper_d','upper_h','lower','grout','start_real','finish_real','work_note'];
  const req=new Set(); codes.forEach(c=>(PERMIT_REQ[c]||[]).forEach(k=>req.add(k)));
  if(req.has('coord1')||req.has('coord2')){req.delete('coord1');req.delete('coord2');req.add('coords')}
  if(codes.includes('13')) req.add('work_note');
  return order.filter(k=>req.has(k));
}
const PERMIT_STAGE_KEYS={1:['name','birth','phone','address'],2:['site','coords'],3:['use','drink'],4:['depth','diameter','planned','hp','pipe','pumpdepth','capacity','reportno','start_plan','finish_plan','restore_plan','outlet','meter','level','upper_w','upper_d','upper_h','lower','grout','start_real','finish_real','work_note']};
function permitStageForKey(key){for(const [n,keys] of Object.entries(PERMIT_STAGE_KEYS))if(keys.includes(key))return Number(n);return 4}
function setPermitStage(stage,label=''){document.querySelectorAll('#permitStageNav [data-stage]').forEach(x=>{const n=Number(x.dataset.stage);x.classList.toggle('active',n===stage);x.classList.toggle('done',n<stage)});$('permitProgressText').textContent=label||(stage?`${stage}단계 / 5단계`:'서류 선택');$('permitProgressBar').style.width=stage?`${Math.max(8,stage/5*100)}%`:'4%'}
function phaseChoiceHtml(){return Object.entries(PERMIT_PHASES).map(([key,p])=>`<button type="button" class="permitChoice ${permitWizard.phase===key?'selected':''}" data-phase="${key}"><b>${esc(p.label)}</b><small style="display:block;margin-top:3px;color:#718096">${esc(p.desc)}</small></button>`).join('')}
function renderPermitWizard(){
  const isPhase=permitWizard.index<0; const isReview=permitWizard.index>=permitWizard.questions.length;
  show('permitQuestionWrap',!isReview);show('permitReviewWrap',isReview);show('permitResultWrap',false);show('permitGenerateBtn',isReview);show('permitNextBtn',!isReview);$('permitBackBtn').disabled=isPhase;
  if(isReview){setPermitStage(5);renderPermitReview();return}
  if(isPhase){setPermitStage(0,'서류 선택');$('permitStepTitle').textContent='작성할 신고서 선택';$('permitQuestionWrap').innerHTML=`<span class="qNo">준비</span><h2>지금 어느 단계의 신고서를 작성할까요?</h2><p>단계를 고르면 필요한 질문만 이어서 묻습니다.</p><div class="permitChoiceGrid" id="phaseChoices">${phaseChoiceHtml()}</div>`;$('phaseChoices').querySelectorAll('[data-phase]').forEach(b=>b.onclick=()=>{permitWizard.phase=b.dataset.phase;permitWizard.codes=PERMIT_PHASES[b.dataset.phase].codes;permitWizard.questions=fieldsForCodes(permitWizard.codes);renderPermitWizard()});return}
  const key=permitWizard.questions[permitWizard.index]; const stage=permitStageForKey(key);setPermitStage(stage);const meta=PERMIT_META[key]||{title:PERMIT_LABEL[key]||key,hint:'',type:'text'}; const val=key==='coords'?'':(permitWizard.data[key]??'');
  $('permitStepTitle').textContent=PERMIT_LABEL[key]||'신고서 작성';
  let control='';
  if(meta.type==='choice') control=`<div class="permitChoiceGrid">${meta.options.map(o=>`<button type="button" class="permitChoice ${String(val)===o?'selected':''}" data-choice="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
  else if(meta.type==='address') control=`<div class="permitAddressRow"><input id="permitValue" class="permitInput" value="${esc(val)}" placeholder="${esc(meta.placeholder||'')}"><button id="permitAddressBtn" type="button" class="btn soft">주소검색</button></div>`;
  else if(meta.type==='coords') control=`<div class="coordGrid"><input id="permitCoord1" class="permitInput" value="${esc(permitWizard.data.coord1||'')}" placeholder="경도 예: 128° 21′ 30.0″"><input id="permitCoord2" class="permitInput" value="${esc(permitWizard.data.coord2||'')}" placeholder="위도 예: 36° 28′ 15.0″"><button id="permitGpsBtn" type="button" class="btn soft coordGpsBtn">◎ 현재 GPS로 입력</button></div><div class="permitHint">GPS는 현장에 있을 때만 사용하세요.</div>`;
  else if(meta.type==='readonly') control=`<input id="permitValue" class="permitInput" value="${esc(val)}" readonly>`;
  else control=`<input id="permitValue" class="permitInput" type="${meta.type||'text'}" value="${esc(val)}" ${meta.type==='number'?'inputmode="decimal"':''} placeholder="${esc(meta.placeholder||'')}">${meta.unit?`<div class="permitHint">단위: ${esc(meta.unit)}</div>`:''}`;
  $('permitQuestionWrap').innerHTML=`<span class="qNo">${stage}단계</span><h2>${esc(meta.title)}</h2><p>${esc(meta.hint||'')}</p>${control}`;
  if(meta.type==='choice')$('permitQuestionWrap').querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{permitWizard.data[key]=b.dataset.choice;savePermitLocalDraft();renderPermitWizard();setTimeout(()=>permitNext(),120)});
  if(meta.type==='address')$('permitAddressBtn').onclick=()=>openPermitAddressSearch();
  if(meta.type==='coords')$('permitGpsBtn').onclick=()=>fillPermitGps();
  const inp=$('permitValue');if(inp&&!inp.readOnly)setTimeout(()=>inp.focus(),80);
}
function saveCurrentPermitValue(){
  if(permitWizard.index<0||permitWizard.index>=permitWizard.questions.length)return true;
  const key=permitWizard.questions[permitWizard.index]; const meta=PERMIT_META[key]||{};
  if(key==='coords'){permitWizard.data.coord1=$('permitCoord1').value.trim();permitWizard.data.coord2=$('permitCoord2').value.trim();if(!permitWizard.data.coord1||!permitWizard.data.coord2){toast('경도와 위도를 모두 입력하세요.');return false}return true}
  if(meta.type==='choice')return !!permitWizard.data[key];
  const inp=$('permitValue');if(inp)permitWizard.data[key]=inp.value.trim();
  if(key!=='work_note'&&!permitWizard.data[key]){toast(`${PERMIT_LABEL[key]||'값'}을 입력하세요.`);return false}return true;
}
function permitNext(){
  if(permitWizard.index<0){permitWizard.codes=PERMIT_PHASES[permitWizard.phase].codes;permitWizard.questions=fieldsForCodes(permitWizard.codes);permitWizard.index=0;renderPermitWizard();return}
  if(!saveCurrentPermitValue())return;savePermitLocalDraft();permitWizard.index++;renderPermitWizard();
}
function permitBack(){if(permitWizard.index<0)return;if(permitWizard.index>=permitWizard.questions.length){permitWizard.index=permitWizard.questions.length-1}else permitWizard.index--;renderPermitWizard()}
function renderPermitReview(){
  $('permitStepTitle').textContent='입력내용 확인'; const labels=permitWizard.codes.map(c=>`<span>${esc(PERMIT_FORM_LABEL[c])}</span>`).join('');
  const keys=['name','birth','phone','address','site','coord1','coord2','use','drink','depth','diameter','planned','hp','pipe','pumpdepth','capacity','reportno','start_plan','finish_plan','restore_plan','outlet','meter','level','upper_w','upper_d','upper_h','lower','grout','start_real','finish_real','work_note'];
  const rows=keys.filter(k=>String(permitWizard.data[k]??'').trim()).map(k=>`<div class="reviewRow"><span>${esc(PERMIT_LABEL[k]||k)}</span><b>${esc(permitWizard.data[k])}</b></div>`).join('');
  $('permitReviewWrap').innerHTML=`<h2>신고서 생성 전 마지막 확인</h2><p>틀린 항목이 있으면 이전 버튼으로 돌아가 수정하세요.</p><div class="reviewForms">${labels}</div><div class="reviewTable">${rows}</div>`;
}
function ddToDms(v){const a=Math.abs(Number(v));const d=Math.floor(a),mf=(a-d)*60,m=Math.floor(mf),sec=((mf-m)*60).toFixed(1);return `${d}° ${m}′ ${sec}″`}
function fillPermitGps(){if(!navigator.geolocation){toast('이 기기에서는 GPS를 사용할 수 없습니다.');return}const btn=$('permitGpsBtn');btn.disabled=true;btn.textContent='GPS 확인 중...';navigator.geolocation.getCurrentPosition(pos=>{permitWizard.data.coord1=ddToDms(pos.coords.longitude);permitWizard.data.coord2=ddToDms(pos.coords.latitude);$('permitCoord1').value=permitWizard.data.coord1;$('permitCoord2').value=permitWizard.data.coord2;btn.disabled=false;btn.textContent='◎ 현재 GPS로 다시 입력';toast('현재 GPS 좌표를 입력했습니다.')},e=>{btn.disabled=false;btn.textContent='◎ 현재 GPS로 입력';toast('GPS를 가져오지 못했습니다. 위치 권한을 확인하세요.',5000)},{enableHighAccuracy:true,timeout:10000,maximumAge:0})}
async function openPermitAddressSearch(){const wrap=$('postcodeWrap');try{await ensureDaumPostcode()}catch(e){toast('주소검색을 불러오지 못했습니다.',5000);return}wrap.innerHTML='';show('addressModal',true);new daum.Postcode({oncomplete:d=>{const addr=(d.jibunAddress||d.autoJibunAddress||d.roadAddress||d.address||'').trim();permitWizard.data.address=addr;if($('permitValue'))$('permitValue').value=addr;show('addressModal',false);toast('신고인 주소가 입력되었습니다.')},width:'100%',height:'100%'}).embed(wrap)}
async function savePermitDraft(){const site=sites.find(s=>s.id===permitWizard.siteId);if(!site)return;if(DEMO){savePermitLocalDraft();site.permitProfile={...permitWizard.data};return}await fb.setDoc(fb.doc(db,...companyPath('sites'),site.id),{permitProfile:permitWizard.data,permitPhase:permitWizard.phase,permitUpdatedAt:fb.serverTimestamp()},{merge:true});site.permitProfile={...permitWizard.data};clearPermitLocalDraft()}
function b64Blob(b64,type='application/pdf'){const raw=atob(b64),u=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)u[i]=raw.charCodeAt(i);return new Blob([u],{type})}
async function generatePermitPdfs(){
  const btn=$('permitGenerateBtn');btn.disabled=true;$('permitReviewWrap').innerHTML='<div class="permitLoading"><div><div class="spinner"></div><b>신고서 PDF를 생성하고 있습니다.</b><p>잠시만 기다려 주세요.</p></div></div>';show('permitBackBtn',false);show('permitGenerateBtn',false);
  try{
    await savePermitDraft();let forms=[];
    if(DEMO){
      const r=await fetch('/api/forms/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({siteId:permitWizard.siteId,codes:permitWizard.codes,data:permitWizard.data})});if(!r.ok)throw new Error((await r.text())||`HTTP ${r.status}`);const j=await r.json();forms=(j.files||[]).map(x=>{const url=URL.createObjectURL(b64Blob(x.base64));return{code:x.code,name:x.name,url}})
    }else{
      const j=await callFunction('generateForms',{siteId:permitWizard.siteId,codes:permitWizard.codes,data:permitWizard.data});for(const x of (j.forms||[])){const url=await fb.getDownloadURL(fb.ref(storage,x.storagePath));forms.push({...x,url})}
    }
    permitWizard.generated=forms;show('permitReviewWrap',false);show('permitResultWrap',true);$('permitProgressBar').style.width='100%';$('permitProgressText').textContent='완료';$('permitStepTitle').textContent='신고서 생성 완료';$('permitResultWrap').innerHTML=`<div class="resultHero"><div class="okMark">✓</div><h2>${forms.length}개 신고서가 생성되었습니다.</h2><p>파일명을 눌러 PDF를 확인하세요.</p></div><div class="generatedList">${forms.map(x=>`<div class="generatedFile"><div><b>${esc(x.name)}</b><small>${esc(PERMIT_FORM_LABEL[x.code]||x.code)}</small></div><a class="btn soft permitDownload" href="${x.url}" download="${esc(x.name)}" target="_blank" rel="noopener">PDF 열기</a></div>`).join('')}</div>`;$('permitBackBtn').textContent='작성 종료';show('permitBackBtn',true);$('permitBackBtn').disabled=false;$('permitBackBtn').onclick=closePermitWizard;toast('신고서 PDF 생성이 완료되었습니다.',5000)
  }catch(e){show('permitReviewWrap',true);renderPermitReview();show('permitBackBtn',true);show('permitGenerateBtn',true);btn.disabled=false;toast('신고서 생성 실패: '+(e?.message||e),7000)}
}
function openPermitWizard(siteId){
  if(!canManage()){toast('대표·관리자·현장관리자만 신고서를 작성할 수 있습니다.');return}const site=sites.find(s=>s.id===siteId);if(!site){toast('현장을 먼저 선택하세요.');return}
  permitWizard={siteId,phase:site.permitPhase||'start',codes:['22','9'],data:loadPermitDraft(site),questions:[],index:-1,generated:[]};permitWizard.codes=PERMIT_PHASES[permitWizard.phase]?.codes||['22','9'];permitWizard.questions=fieldsForCodes(permitWizard.codes);$('permitSiteLabel').textContent=`${site.name||'현장'} · ${site.site||''}`;$('permitBackBtn').textContent='이전';$('permitBackBtn').onclick=permitBack;show('permitWizardModal',true);renderPermitWizard()
}
function closePermitWizard(){if(!permitWizard.generated.length){snapshotPermitValue();savePermitLocalDraft()}show('permitWizardModal',false);permitWizard.generated.forEach(x=>{if(DEMO&&x.url?.startsWith('blob:'))URL.revokeObjectURL(x.url)});renderDocsView()}
function renderDocsView(){
  if(!$('docsSiteSelect'))return;const sel=$('docsSiteSelect'),old=sel.value;sel.innerHTML='<option value="">현장을 선택하세요</option>'+sites.map(x=>`<option value="${esc(x.id)}">${esc(x.name)} · ${esc(x.site||'')}</option>`).join('');if(sites.some(x=>x.id===old))sel.value=old;else if(sites.length)sel.value=sites[0].id;renderDocsSiteSummary()
}
function renderDocsSiteSummary(){const id=$('docsSiteSelect')?.value,x=sites.find(s=>s.id===id);if(!$('docsSiteSummary'))return;$('docsSiteSummary').innerHTML=x?`<div class="docsSiteCard"><b>${esc(x.name)}</b><span>${esc(x.site||'')}</span><small style="display:block;margin-top:7px;color:#718096">${x.permitProfile?'이전에 입력한 신고서 정보가 있습니다.':'아직 신고서 정보가 없습니다.'}</small></div>`:'<div class="empty">현장을 선택하세요.</div>'}
if($('docsSiteSelect'))$('docsSiteSelect').onchange=renderDocsSiteSummary;
if($('docsStartBtn'))$('docsStartBtn').onclick=()=>{const id=$('docsSiteSelect').value;if(!id){toast('현장을 선택하세요.');return}openPermitWizard(id)};
if($('docsStartBtn2'))$('docsStartBtn2').onclick=()=>{const id=$('docsSiteSelect').value;if(!id){toast('현장을 선택하세요.');return}openPermitWizard(id)};
if($('permitCloseBtn'))$('permitCloseBtn').onclick=closePermitWizard;
if($('permitNextBtn'))$('permitNextBtn').onclick=permitNext;
if($('permitBackBtn'))$('permitBackBtn').onclick=permitBack;
if($('permitGenerateBtn'))$('permitGenerateBtn').onclick=generatePermitPdfs;

function startDemo(){currentUser={uid:'demo-owner',email:'demo@jihasu365.local',displayName:'김대표'};currentProfile={companyId:'demo-company',role:'owner',status:'active'};companyId='demo-company';currentCompany={id:companyId,name:'경일지하수',plan:'alpha'};show('loginCard',false);enterApp()}

function closeQuickAction(){show('quickActionSheet',false)}
function openQuickAction(){show('quickActionSheet',true)}
if($('quickActionBtn'))$('quickActionBtn').onclick=openQuickAction;if($('quickActionClose'))$('quickActionClose').onclick=closeQuickAction;if($('quickActionBackdrop'))$('quickActionBackdrop').onclick=closeQuickAction;
document.querySelectorAll('[data-quick]').forEach(b=>b.onclick=()=>{const action=b.dataset.quick;closeQuickAction();if(action==='log'){switchView('Today')}else if(action==='photo'){switchView('Today');setTimeout(()=>{if(!$('siteSelect').value&&sites.length){$('siteSelect').value=sites[0].id;$('siteSelect').dispatchEvent(new Event('change'))}if($('siteSelect').value)$('cameraBtn').click();else toast('사진을 저장할 현장을 먼저 등록해 주세요.')},160)}else if(action==='site'){switchView('Sites');show('addSitePanel',true);setTimeout(()=>$('newSiteName').focus(),80)}else if(action==='docs'){switchView('Docs')}});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('installBtn').hidden=false});$('installBtn').onclick=async()=>{if(!deferredPrompt){toast('브라우저 메뉴에서 홈 화면에 추가를 선택하세요.');return}deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('installBtn').hidden=true};
if('serviceWorker' in navigator&&!DEMO)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js?v=j365v120').catch(()=>{}));
initFirebase().catch(e=>{$('loginMsg').textContent='Firebase 초기화 오류: '+(e?.message||e);$('loginBtn').disabled=true});
