import {validateStops,stopsHtml} from './itinerary.js';
export const VERSION = 1;
export const COUNTRIES = [
 ['jp','일본','🇯🇵','아시아','japan','후쿠오카,오사카,교토,도쿄,삿포로,오키나와,나고야,고베,나가사키,구마모토,가고시마'],
 ['vn','베트남','🇻🇳','아시아','coast','다낭,나트랑,하노이,호찌민,푸꾸옥,달랏,호이안'],
 ['us','미국','🇺🇸','미주','city','하와이,뉴욕,로스앤젤레스,라스베이거스,샌프란시스코'],
 ['th','태국','🇹🇭','아시아','coast','방콕,치앙마이,푸껫,파타야'],
 ['tw','대만','🇹🇼','아시아','city','타이베이,타이중,가오슝,타이난'],
 ['ph','필리핀','🇵🇭','아시아','coast','세부,보라카이,보홀,마닐라'],
 ['sg','싱가포르','🇸🇬','아시아','city','싱가포르,센토사'],
 ['my','말레이시아','🇲🇾','아시아','coast','쿠알라룸푸르,코타키나발루,랑카위'],
 ['id','인도네시아','🇮🇩','아시아','coast','발리,자카르타,롬복'],
 ['hk','홍콩','🇭🇰','아시아','city','홍콩섬,카오룽,란타우섬'],
 ['cn','중국','🇨🇳','아시아','city','상하이,베이징,칭다오,장자제'],
 ['au','호주','🇦🇺','오세아니아','coast','시드니,멜버른,브리즈번,골드코스트'],
 ['fr','프랑스','🇫🇷','유럽','city','파리,니스,리옹'],
 ['it','이탈리아','🇮🇹','유럽','city','로마,피렌체,베네치아,밀라노']
].map(([id,name,flag,group,image,cities])=>({id,name,flag,group,image,cities:cities.split(','),kind:'overseas'}));
export const PROVINCES = [
 ['seoul','서울','종로,명동,성수,홍대,잠실,여의도'],['busan','부산','해운대,광안리,남포동,송정,기장,서면,영도'],
 ['daegu','대구','동성로,수성못,앞산'],['incheon','인천','송도,강화,영종도'],['gwangju','광주','동명동,양림동,무등산'],
 ['daejeon','대전','유성,대청호,은행동'],['ulsan','울산','대왕암,간절곶,태화강'],['sejong','세종','세종호수공원,조치원'],
 ['gyeonggi','경기도','수원,가평,양평,파주,용인,포천'],['gangwon','강원특별자치도','강릉,속초,양양,춘천,홍천,평창,정선,동해,삼척,원주,고성,인제'],
 ['chungbuk','충청북도','청주,충주,제천,단양'],['chungnam','충청남도','천안,아산,공주,보령,태안,서산,부여,논산,예산,당진'],
 ['jeonbuk','전북특별자치도','전주,군산,남원,고창'],['jeonnam','전라남도','여수,순천,목포,담양,해남'],
 ['gyeongbuk','경상북도','경주,안동,포항,울릉도'],['gyeongnam','경상남도','통영,거제,남해,진주,창원'],
 ['jeju','제주특별자치도','제주시,서귀포,성산,애월,중문,우도']
].map(([id,name,cities])=>({id,name,cities:cities.split(','),kind:'domestic',flag:'🇰🇷',image:id==='seoul'?'city':'coast'}));
export const ALL = [...COUNTRIES,...PROVINCES];
export const CHECKS=['여권 유효기간·입국 요건 공식 확인','항공권·숙소 예약 내역 보관','공항 이동·현지 교통 확인','보험·비상 연락처 준비','통신·충전기·결제 수단 준비','여행팩 저장 후 비행기 모드 확인'];
export function checklistFor(trip){return trip.kind==='domestic'?['예약한 교통편·이동 일정 확인','숙소·이용권 예약 내역 보관','현지 이동·주차·교통 확인','비상 연락처·상비약 준비','충전기·결제 수단 준비','여행팩 저장 후 비행기 모드 확인']:CHECKS;}
export const SUGGESTIONS = [
 {parent:'jp',city:'후쿠오카',tags:['맛집','쇼핑','가족'],reason:'음식과 도심 산책을 중심으로 여행을 구상해 보세요.'},
 {parent:'vn',city:'다낭',tags:['자연','휴식','가족'],reason:'바다와 쉬어가는 시간을 중심으로 여행을 구상해 보세요.'},
 {parent:'jeju',city:'제주시',tags:['자연','휴식','사진'],reason:'자연 풍경과 여유로운 일정을 중심으로 구상해 보세요.'},
 {parent:'gangwon',city:'강릉',tags:['자연','맛집','가족'],reason:'해안 산책과 음식 탐방을 중심으로 구상해 보세요.'},
 {parent:'jp',city:'교토',tags:['문화','사진','산책'],reason:'문화 공간과 산책을 중심으로 여행을 구상해 보세요.'},
 {parent:'busan',city:'해운대',tags:['맛집','쇼핑','사진'],reason:'도시와 해안 풍경을 함께 즐기는 여행을 구상해 보세요.'}
];
export function today(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());}
export function validDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(value+'T00:00:00Z');return Number.isFinite(+date)&&date.toISOString().slice(0,10)===value;}
export function daysBetween(start,end){if(!validDate(start)||!validDate(end)||end<start)throw Error('여행 날짜를 다시 선택하세요.');const n=(Date.parse(end)-Date.parse(start))/86400000+1;if(n>90)throw Error('첫 개발판은 최대 90일 여행을 지원합니다.');return n;}
export function dayAt(start,index){const date=new Date(start+'T00:00:00Z');date.setUTCDate(date.getUTCDate()+index);return date.toISOString().slice(0,10);}
export function pickDate(start,end,chosen){if(!validDate(chosen))throw Error('유효하지 않은 날짜입니다.');if(!start||end||chosen<start)return {start:chosen,end:''};return {start,end:chosen};}
export function esc(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
export function place(parentId,city){const parent=ALL.find(p=>p.id===parentId);if(!parent||typeof city!=='string'||!city.trim()||city.length>80)throw Error('여행지를 다시 선택하세요.');return {parentId:parent.id,parentName:parent.name,city:city.trim(),kind:parent.kind};}
export function makeTrip(draft,now=today()){
 const destination=place(draft.parentId,draft.city);const days=daysBetween(draft.start,draft.end);if(draft.start<now)throw Error('출발일은 오늘 이후로 선택하세요.');
 return {id:globalThis.crypto?.randomUUID?.()||'trip-'+Date.now()+'-'+Math.random().toString(36).slice(2),...destination,start:draft.start,end:draft.end,days,createdAt:new Date().toISOString(),checks:[],notes:'',stops:[]};
}
export function validateState(raw){
 if(!raw||raw.version!==VERSION||!Array.isArray(raw.trips)||!Array.isArray(raw.recents))throw Error('지원하지 않는 여행 파일입니다.');
 if(raw.trips.length>100||raw.recents.length>8)throw Error('저장 가능한 여행 수를 초과했습니다.');
 const trips=raw.trips.map(t=>{
  const dest=place(t.parentId,t.city);const days=daysBetween(t.start,t.end);
  if(typeof t.id!=='string'||t.id.length>100||!t.id||typeof t.notes!=='string'||t.notes.length>5000)throw Error('여행 파일 내용이 올바르지 않습니다.');
  return {id:t.id,...dest,start:t.start,end:t.end,days,createdAt:String(t.createdAt||''),notes:t.notes,stops:validateStops(t.stops,days),checks:Array.isArray(t.checks)?[...new Set(t.checks.filter(n=>Number.isInteger(n)&&n>=0&&n<CHECKS.length))]:[]};
 });
 if(new Set(trips.map(t=>t.id)).size!==trips.length)throw Error('중복된 여행 ID가 있습니다.');
 return {version:VERSION,trips,recents:raw.recents.map(p=>place(p.parentId,p.city))};
}
export function addRecent(recents,dest){return [dest,...recents.filter(p=>p.parentId!==dest.parentId||p.city!==dest.city)].slice(0,8);}
export function recommend(tags,kind='all'){return SUGGESTIONS.filter(x=>kind==='all'||ALL.find(p=>p.id===x.parent).kind===kind).map((x,i)=>({...x,order:i,matches:tags.filter(t=>x.tags.includes(t))})).sort((a,b)=>b.matches.length-a.matches.length||a.order-b.order).slice(0,3);}
export function offlineHtml(trip){
 const t=validateState({version:1,trips:[trip],recents:[]}).trips[0];
 const itinerary=(t.stops||[]).length?'<h2>직접 기록한 장소 일정</h2>'+Array.from({length:t.days},(_,i)=>'<h3>'+dayAt(t.start,i)+'</h3>'+stopsHtml(t,i)).join(''):'';
 const phrases=t.kind==='domestic'?'': '<h2>기본 회화 · 고정 예문</h2><p>도와주세요: Please help me.<br>이 주소로 가 주세요: Please take me to this address.<br>이것은 얼마인가요?: How much is this?</p>'+(t.parentId==='jp'?'<p>일본어: すみません (실례합니다) · ありがとうございます (감사합니다)</p>':'');
 return '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(t.city)+' 여행팩 — 여행딱</title><style>body{max-width:800px;margin:32px auto;padding:20px;font:17px/1.8 system-ui;color:#173052}h1{color:#1478f4}.box{background:#eff6ff;padding:20px;border-radius:16px;white-space:pre-wrap}li{margin:12px 0}small{color:#66768e}</style><h1>여행딱 · '+esc(t.city)+'</h1><p>'+esc(t.parentName)+' · '+t.start+' ~ '+t.end+' · '+t.days+'일</p><h2>나의 여행 메모</h2><div class="box">'+esc(t.notes||'아직 작성한 메모가 없습니다.')+'</div><h2>준비 체크리스트</h2><ul>'+checklistFor(t).map((c,i)=>'<li>'+(t.checks.includes(i)?'☑ ':'☐ ')+esc(c)+'</li>').join('')+'</ul>'+itinerary+phrases+'<small>내보낸 시각: '+esc(new Date().toISOString())+'<br>이 파일은 인터넷 없이 열립니다. 행사·영업시간·입국 요건·지도·예약 내역은 포함되지 않습니다. 현재 작성한 메모와 체크 상태의 사본입니다.</small></html>';
}
