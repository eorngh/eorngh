import {esc} from './core.js';
export function entryPanel(trip,record){
 if(trip.kind!=='overseas')return '';
 const entry=record?.entry,verified=entry?.status==='verified-source';
 const sources=(entry?.sources||[]).filter(s=>{try{return new URL(s.url).origin==='https://www.mofa.go.jp';}catch{return false;}});
 return '<section class="panel entry-panel" id="entry-panel"><h2>입국 준비</h2><p role="status">'+(verified?(entry.carriedForward?'공식 안내 저장본':'공식 안내 확인됨'):'공식 안내 확인 필요')+'</p><details><summary>여권·목적에 맞는 조건 확인</summary>'+(verified?'<p>'+esc(entry.summary)+'</p><p class="note">'+esc(entry.scope)+(entry.carriedForward?' · 현재 재조회 지연, 아래 확인 시각의 자료':'')+' · 확인 '+esc(entry.checkedAt)+'</p>'+(entry.conditions||[]).map(s=>'<p class="note">'+esc(s)+'</p>').join(''):'<p class="note">국적·여권 종류·방문 목적·체류기간을 기준으로 공식 기관에서 확인하세요. '+(trip.parentId==='jp'?'온라인 준비 허용 시 일본 외무성 안내를 확인합니다.':'이 국가의 조건 자동 수집은 개발 상태에서 확인할 수 있습니다.')+'</p>')+sources.map(s=>'<p><a href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">'+esc(s.title)+' ↗</a></p>').join('')+(trip.parentId==='jp'&&!sources.length?'<p><a href="https://www.mofa.go.jp/j_info/visit/visa/short/novisa.html" target="_blank" rel="noopener noreferrer">일본 외무성 공식 안내 ↗</a></p>':'')+'<a href="#about">지원 범위·개발 상태</a></details></section>';
}
