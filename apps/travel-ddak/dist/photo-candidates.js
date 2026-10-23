import {esc} from './core.js';
export function tripTimeZone(trip){
 if(trip.kind==='domestic')return 'Asia/Seoul';
 if(trip.parentId==='us')return trip.city==='하와이'?'Pacific/Honolulu':trip.city==='뉴욕'?'America/New_York':'America/Los_Angeles';
 if(trip.parentId==='au')return trip.city==='브리즈번'?'Australia/Brisbane':'Australia/Sydney';
 if(trip.parentId==='id')return trip.city==='자카르타'?'Asia/Jakarta':'Asia/Makassar';
 return ({jp:'Asia/Tokyo',vn:'Asia/Ho_Chi_Minh',th:'Asia/Bangkok',tw:'Asia/Taipei',ph:'Asia/Manila',sg:'Asia/Singapore',my:'Asia/Kuala_Lumpur',id:'Asia/Makassar',hk:'Asia/Hong_Kong',cn:'Asia/Shanghai',fr:'Europe/Paris',it:'Europe/Rome'})[trip.parentId]||'Asia/Seoul';
}
export function distanceKm(a,b){
 if(![a?.latitude,a?.longitude,b?.latitude,b?.longitude].every(Number.isFinite))return Infinity;
 const rad=d=>d*Math.PI/180,lat=rad(b.latitude-a.latitude),lng=rad(b.longitude-a.longitude);
 const n=Math.sin(lat/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(lng/2)**2;
 return 6371*2*Math.atan2(Math.sqrt(n),Math.sqrt(Math.max(0,1-n)));
}
export function classifyPhotos(photos,trip,center=null){
 const zone=tripTimeZone(trip),format=new Intl.DateTimeFormat('sv-SE',{timeZone:zone}),seen=new Set(),result=[];
 for(const p of photos.slice(0,5000)){
  if(!p||!/^\d+$/.test(p.id)||seen.has(p.id)||!Number.isFinite(p.takenAt)||p.takenAt<=0)continue;
  let date;try{date=format.format(new Date(p.takenAt));}catch{continue;}
  if(date<trip.start||date>trip.end)continue;seen.add(p.id);
  const gps=p.hasLocation===true&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180;
  result.push({id:p.id,takenAt:p.takenAt,date,timeEstimated:!!p.timeEstimated,width:p.width||0,height:p.height||0,hasLocation:gps,latitude:gps?p.latitude:null,longitude:gps?p.longitude:null,match:gps?(center?.verified?(distanceKm(p,center)<=40?'near':'away'):'gps'):'unknown'});
 }
 result.sort((a,b)=>a.takenAt-b.takenAt||a.id.localeCompare(b.id));
 const previous=[],next=[];let anchor;
 for(let i=0;i<result.length;i++){previous[i]=anchor;if(result[i].hasLocation)anchor=result[i];}
 anchor=undefined;for(let i=result.length-1;i>=0;i--){next[i]=anchor;if(result[i].hasLocation)anchor=result[i];}
 for(let i=0;i<result.length;i++){
  const p=result[i];if(p.hasLocation||p.timeEstimated)continue;
  const before=previous[i],after=next[i];
  if(before&&after&&p.takenAt-before.takenAt<=3600000&&after.takenAt-p.takenAt<=3600000&&distanceKm(before,after)<20){p.match='inferred';p.inferredLocation={latitude:(before.latitude+after.latitude)/2,longitude:(before.longitude+after.longitude)/2};}
 }
 return {tripId:trip.id,title:trip.city+' '+trip.start.slice(0,4),timeZone:zone,photos:result,days:[...new Set(result.map(p=>p.date))],createdAt:new Date().toISOString()};
}
export function nativeAlbumPanel(trip,state={}){
 const album=state.album,photos=album?.photos||[];const label={near:'목적지 주변 촬영',away:'다른 지역일 수 있음 · 검토 필요',gps:'GPS 있음 · 목적지 대조 전',unknown:'GPS 없음 · 날짜 기준 후보',inferred:'앞뒤 사진 위치로 추정'};
 return '<section class="panel" id="native-photos"><h2>여행 사진 자동 정리</h2><p>여행 기간의 사진을 허용된 범위에서 기기 안에서 찾습니다. 원본·얼굴·표정은 수정하지 않고 서버에 전송하지 않습니다. 촬영 위치는 사진의 EXIF이며 현재 위치를 추적하지 않습니다.</p><p role="status">'+esc(state.message||'사진 접근을 한 번 허용하면 여행 날짜로 사진 후보를 찾습니다.')+'</p>'+(state.access==='limited'?'<p class="notice">선택한 사진만 접근 가능한 상태입니다. 휴대폰 전체 사진을 검색한 결과가 아닙니다.</p>':'')+'<div class="inline-actions"><button class="secondary" data-action="photos-allow">사진 접근 설정</button>'+(album?'<button class="secondary" data-action="photos-confirm">이 후보를 앱 앨범으로 보관</button>':'')+'</div><p class="note">부분 구현: 날짜·GPS 기반 후보 분류입니다. 음식·랜드마크 등 이미지 의미 분류와 앱 종료 중 자동 스캔은 미구현입니다. 저장일을 사용한 사진과 위치 추정은 별도로 표시합니다.</p>'+(album?'<h3>'+esc(album.title)+' · '+photos.length+'장 후보</h3><p class="note">여행 날짜만으로 여행 사진임을 확정하지 않습니다. 휴대폰 갤러리의 원본을 이동·삭제하지 않으며 앱 안에 분류 결과만 저장합니다.</p><div class="native-photo-grid">'+photos.slice(0,state.visible||24).map(p=>'<article><img data-photo-id="'+p.id+'" alt="여행 사진 후보 미리보기"><small>'+esc(p.date)+' · '+esc(label[p.match])+(p.timeEstimated?' · 저장일 기준 추정':'')+'</small></article>').join('')+'</div>'+(photos.length>(state.visible||24)?'<button class="secondary" data-action="photos-more">다음 후보 보기</button>':''):'')+'</section>';
}
