import {esc} from './core.js';
export function officialPanel(answer){
 const records=Array.isArray(answer.officialSources)?answer.officialSources:[];
 return '<h3>공식 API 조회 결과 · AI 생성문과 별도</h3><p>'+esc(answer.officialNote||'공식 관광 자료를 요청하지 않았습니다.')+'</p>'+(records.length?records.map(r=>'<article><h4>'+esc(r.title)+'</h4><p>'+esc(r.address)+(r.kind==='event'?'<br>행사 기간 '+esc(r.start)+' ~ '+esc(r.end)+' · 한국 시간':'')+'</p><p class="note">한국관광공사 TourAPI · 콘텐츠 '+esc(r.id)+'<br>조회 '+esc(r.checkedAt)+' · 영업시간·예약·취소 여부 미확인</p><a href="https://www.data.go.kr/data/15101578/openapi.do" target="_blank" rel="noopener">공식 데이터 출처 ↗</a></article>').join(''):'<p>표시할 공식 관광 결과가 없습니다. 행사·장소를 대신 생성하지 않습니다.</p>');
}
export function mapFrameUrl(value){
 const u=new URL(value);
 if(u.origin!=='https://www.google.com'||u.pathname!=='/maps/embed/v1/place'||u.username||u.password)throw Error('지도 응답 주소를 확인하지 못했습니다.');
 return u.href;
}
export function photoPanel(photos){
 return (Array.isArray(photos)?photos:[]).slice(0,1).map(p=>{
  let u;try{u=new URL(p.imageUrl);}catch{return '';}
  if(u.protocol!=='https:'||u.hostname!=='tong.visitkorea.or.kr'||u.username||u.password||!p.photographer)return '';
  return '<figure><img loading="lazy" style="width:100%;max-width:600px;height:auto" src="'+esc(u.href)+'" alt="'+esc(p.title)+'"><figcaption>'+esc(p.title)+' · '+esc(p.location)+'<br>한국관광공사 포토코리아 / 촬영 '+esc(p.photographer)+' / 공공누리 제1유형 · 출처표시<br><a href="https://www.data.go.kr/data/15101914/openapi.do" target="_blank" rel="noopener">사진 데이터 출처 ↗</a></figcaption></figure>';
 }).join('');
}
export function hybridPanel(){return '<section class="panel hybrid-panel"><h2>하이브리드 AI 여행 도우미</h2><p>기기 내 준비 규칙을 바탕으로 Gemini가 준비 조언·번역을 보완합니다. 국내 여행은 한국관광공사 관광지·행사 API 조회 결과를 별도로 표시합니다. 해외 공식 관광 데이터는 아직 없으며, 영업·취소·예약·입국 요건과 최적 동선을 확정하지 않습니다.</p><p class="note">내 여행에서 딱모둠 계정으로 먼저 로그인하세요. 테스트 계정에 한해 하루 3회·월 20회, 서비스 전체 월 200회까지 사용합니다. 오류 요청도 한도에 포함됩니다. 공식 조회·지도는 AI 한도와 별도로 계정 하루 20회·월 100회까지 사용합니다.</p><label for="ai-consent"><input id="ai-consent" type="checkbox"> 버튼을 누를 때 여행지·지역·유형·기간·일수·공식 조회 자료 또는 입력한 번역 문장을 Google Gemini로 보내고, 국내 관광 조회에 지역·기간·여행지를 한국관광공사 API로 보내는 데 동의합니다. 지도 열기는 여행지를 Google 지도에 전송합니다. 메모·사진·예약·직접 기록한 장소는 보내지 않습니다.</label><div class="inline-actions"><button class="secondary" data-action="hybrid-prepare">준비 조언 받기</button><button class="secondary" data-action="hybrid-official">공식 정보만 새로 조회</button><button class="secondary" data-action="hybrid-map">여행지 지도 열기</button></div><div id="ai-map"></div><label for="ai-language">번역할 언어</label><select id="ai-language">'+['영어','일본어','중국어','스페인어','프랑스어','독일어','태국어','베트남어','한국어'].map(x=>'<option>'+esc(x)+'</option>').join('')+'</select><label for="ai-text">번역할 문장 · 최대 1,000자</label><textarea id="ai-text" maxlength="1000" rows="3" placeholder="개인정보·여권·결제 정보를 입력하지 마세요."></textarea><button class="secondary" data-action="hybrid-translate">문장 번역</button><p id="ai-status" role="status">답변은 참고용입니다. 원문·공식 기관 정보와 대조해 주세요.</p><div id="ai-sources"></div><div id="ai-photos"></div><pre id="ai-result" style="white-space:pre-wrap;overflow-wrap:anywhere;font:inherit"></pre></section>';}
