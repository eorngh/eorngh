import {esc,dayAt} from './core.js';
export function validateStops(input,days){
 if(input===undefined)return [];
 if(!Array.isArray(input)||input.length>200)throw Error('장소는 여행당 최대 200개입니다.');
 const stops=input.map(stop=>{
  if(!stop||typeof stop.id!=='string'||!stop.id||stop.id.length>100||!Number.isInteger(stop.day)||stop.day<0||stop.day>=days)throw Error('장소의 여행 일차가 올바르지 않습니다.');
  if(typeof stop.name!=='string'||!stop.name.trim()||stop.name.length>120||typeof stop.address!=='string'||stop.address.length>500||typeof stop.time!=='string'||(stop.time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(stop.time)))throw Error('장소 이름·주소·시간을 확인하세요.');
  if(typeof stop.source!=='string'||stop.source.length>2000)throw Error('출처 주소를 확인하세요.');
  if(stop.source){let url;try{url=new URL(stop.source);}catch{throw Error('출처는 전체 HTTPS 주소로 입력하세요.');}if(url.protocol!=='https:'||url.username||url.password)throw Error('출처는 로그인 정보가 없는 HTTPS 주소만 지원합니다.');}
  return {id:stop.id,day:stop.day,time:stop.time,name:stop.name.trim(),address:stop.address.trim(),source:stop.source};
 });if(new Set(stops.map(s=>s.id)).size!==stops.length)throw Error('장소 ID가 중복됐습니다.');return stops;
}
export function stopsHtml(trip,day,interactive=false){
 const stops=(trip.stops||[]).filter(s=>s.day===day).sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99'));
 return stops.map((s,i)=>'<article class="stop"><strong>'+esc(s.time||'시간 미정')+' · '+esc(s.name)+'</strong><p>'+esc(s.address||'주소 미입력')+'</p>'+(s.source?'<a href="'+esc(s.source)+'" target="_blank" rel="noopener noreferrer">기록한 출처 열기 ↗</a> ':'')+(interactive?'<a href="https://www.google.com/maps/search/?api=1&amp;query='+encodeURIComponent(s.address||s.name)+'" target="_blank" rel="noopener noreferrer">Google 지도에서 찾기 ↗</a> <button class="linkbtn" data-action="stop-delete" data-stop="'+esc(s.id)+'">장소 삭제</button>':'')+'</article>').join('')||'<p class="muted">아직 기록한 장소가 없습니다.</p>';
}
export function itineraryPanel(trip,day){return '<section class="panel itinerary-panel"><h2>'+dayAt(trip.start,day)+' · 장소 일정</h2><p>직접 확인한 장소와 예약 정보를 기록하세요. 자동 추천·영업시간 검증 결과가 아닙니다. 시간은 방문지 현지 시각 기준으로 입력하세요.</p>'+stopsHtml(trip,day,true)+'<label for="stop-name">장소 이름</label><input id="stop-name" maxlength="120"><label for="stop-address">주소</label><input id="stop-address" maxlength="500"><label for="stop-time">방문 시간 · 선택</label><input id="stop-time" type="time"><label for="stop-source">공식·예약 출처 HTTPS 주소 · 선택</label><input id="stop-source" type="url" maxlength="2000" placeholder="https://"><button class="secondary" data-action="stop-add" style="margin-top:16px">이 일차에 장소 저장</button><p class="note">지도 링크는 외부 Google 지도에서 주소를 찾습니다. 오프라인 지도 다운로드나 최적 동선 계산은 제공하지 않습니다.</p></section>';}
