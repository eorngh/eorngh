import {dayAt,esc,today} from './core.js';
import {tripTimeZone} from './photo-candidates.js';

const DATE=/^\d{4}-\d{2}-\d{2}$/;
export function journeyStage(trip,date=new Intl.DateTimeFormat('sv-SE',{timeZone:tripTimeZone(trip)}).format(new Date())){
 if(!DATE.test(date)||!DATE.test(trip.start)||!DATE.test(trip.end))throw Error('여행 날짜를 확인하세요.');
 const left=Math.round((Date.parse(trip.start)-Date.parse(date))/86400000);
 if(date>trip.end)return {id:'after',label:'여행 후',day:trip.days-1,left};
 if(left<=0)return {id:'during',label:'여행 중',day:Math.min(trip.days-1,-left),left};
 const milestone=left>30?30:left>14?14:left>7?7:left>3?3:left>1?1:0;
 return {id:'before-'+milestone,label:'D-'+left,day:0,left};
}
export function preparationKey(trip){return JSON.stringify([trip.kind,trip.parentId,trip.city,trip.start,trip.end]);}
export function factsFingerprint(facts){return JSON.stringify((facts||[]).map(r=>[r.id,r.title,r.address,r.start,r.end]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));}
export function factualDraft(trip,facts=[]){
 const seen=new Set(),days=Array.from({length:trip.days},(_,i)=>({date:dayAt(trip.start,i),items:[]}));
 for(const r of facts.slice(0,30)){
  if(!r||!/^\d+$/.test(r.id)||typeof r.title!=='string'||!r.checkedAt||seen.has(r.id))continue;
  seen.add(r.id);
  const eligible=days.filter(d=>r.kind!=='event'||(r.start?.length===8&&r.end?.length===8&&d.date.replaceAll('-','')>=r.start&&d.date.replaceAll('-','')<=r.end));
  const target=eligible.filter(d=>d.items.length<3).sort((a,b)=>a.items.length-b.items.length)[0];
  if(target)target.items.push({sourceId:r.id,title:r.title,address:r.address||'',kind:r.kind,checkedAt:r.checkedAt,source:r.source,sourceUrl:r.sourceUrl,status:'candidate',note:'방문 후보 · 영업시간·이동시간·예약 확인 전'});
 }
 return days;
}
export function candidateDraft(trip,record){
 const facts=record?.sources||[];
 if(!Array.isArray(record?.itinerary)||!record.itinerary.length)return factualDraft(trip,facts);
 const days=Array.from({length:trip.days},(_,i)=>({date:dayAt(trip.start,i),items:[]})),byId=new Map(facts.map(s=>[s.id,s])),seen=new Set();
 for(const item of record.itinerary){const source=byId.get(item?.sourceId);if(!source||!Number.isInteger(item.day)||!days[item.day]||seen.has(item.sourceId))continue;const candidate=factualDraft({...trip,start:days[item.day].date,end:days[item.day].date,days:1},[source])[0]?.items[0];if(candidate){days[item.day].items.push(candidate);seen.add(item.sourceId);}}
 return days;
}
export function createPreparation({storage,request,onChange=()=>{},now=()=>Date.now()}){
 const key='travel-ddak.autopilot.v1';let consent=false,records=Object.create(null);const running=new Map(),epochs=new Map();
 try{const raw=JSON.parse(storage.getItem(key)||'{}');consent=raw.consent===true;if(raw.records&&typeof raw.records==='object')records=Object.assign(Object.create(null),Object.fromEntries(Object.entries(raw.records).slice(0,100).filter(([,r])=>r&&typeof r.key==='string'&&Array.isArray(r.sources))));}catch{/* Keep the independent schema1 travel store intact. */}
 function persist(){storage.setItem(key,JSON.stringify({consent,records}));}
 function emit(id,patch){records[id]={...records[id],...patch};persist();onChange(id,records[id]);return records[id];}
 function get(trip){const r=records[trip.id];return r?.key===preparationKey(trip)?r:null;}
 function setConsent(value){consent=value===true;for(const id of running.keys())epochs.set(id,(epochs.get(id)||0)+1);persist();}
 function remove(id){epochs.set(id,(epochs.get(id)||0)+1);delete records[id];persist();}
 function clear(){for(const id of running.keys())epochs.set(id,(epochs.get(id)||0)+1);records=Object.create(null);consent=false;persist();}
 async function ensure(trip,{online=true,force=false,date}={}){
  const old=get(trip),stage=journeyStage(trip,date);if(stage.id==='after')return old;
  if(!consent||!online)return old;
  if(running.has(trip.id))return running.get(trip.id);
  const stamp=now(),refresh=stage.left<=7?6*3600000:24*3600000;
  if(!force&&old&&(old.retryAt>stamp||(old.stage===stage.id&&stamp-old.attemptedAt<refresh)))return old;
  const epoch=epochs.get(trip.id)||0;
  const valid=()=>consent&&(epochs.get(trip.id)||0)===epoch;
  const payload={kind:trip.kind,parentId:trip.parentId,city:trip.city,start:trip.start,end:trip.end,days:trip.days};
  const task=(async()=>{
   emit(trip.id,{key:preparationKey(trip),sources:old?.sources||[],text:old?.text||'',stage:stage.id,attemptedAt:stamp,status:'researching',error:'',aiStatus:'waiting'});
   try{
    const official=await request({mode:'official',id:trip.id,trip:payload});if(!valid())return null;
    if(official.officialStatus==='unavailable')throw Error('official-unavailable');
    const fresh=Array.isArray(official.officialSources)?official.officialSources:[];
    const retained=official.officialStatus==='partial'?(old?.sources||[]).map(r=>({...r,carriedForward:true})):[];
    const sources=[...new Map([...retained,...fresh].map(r=>[r.id,r])).values()].slice(0,30);
    const changes=old?.sources?.length&&factsFingerprint(old.sources)!==factsFingerprint(sources)&&official.officialStatus==='ok';
    emit(trip.id,{sources,text:'',itinerary:[],entry:official.entry||old?.entry||null,officialStatus:official.officialStatus,officialNote:String(official.officialNote||'').slice(0,2000),checkedAt:official.generatedAt,changed:!!changes,status:'summarizing'});
    try{
     const ai=await request({mode:'prepare',id:trip.id,trip:payload});if(!valid())return null;
     return emit(trip.id,{text:String(ai.text||'').slice(0,6000),itinerary:Array.isArray(ai.itinerary)?ai.itinerary.slice(0,10):[],entry:ai.entry||official.entry||old?.entry||null,aiStatus:'ready',status:official.officialStatus==='partial'?'partial':'ready',retryAt:0});
    }catch(error){if(!valid())return null;return emit(trip.id,{status:'partial',aiStatus:'unavailable',error:publicError(error),retryAt:now()+6*3600000});}
   }catch(error){if(!valid())return null;return emit(trip.id,{status:'unavailable',error:publicError(error),retryAt:now()+6*3600000});}
  })();
  running.set(trip.id,task);try{return await task;}finally{running.delete(trip.id);}
 }
 return {get,ensure,remove,clear,setConsent,hasConsent:()=>consent};
}
function publicError(error){const code=String(error?.code||'');if(/unauthenticated|auth\//.test(code)||/먼저.*로그인/.test(error?.message||''))return '계정 인증이 필요합니다. 로그인하면 자동 준비를 이어갑니다.';if(/resource-exhausted/.test(code))return '사용 한도에 도달했습니다. 저장된 정보와 기기 내 준비는 계속 이용할 수 있습니다.';return '온라인 준비를 완료하지 못했습니다. 기존 자료를 보존하고 나중에 다시 확인합니다.';}
export function preparationPanel(trip,record,{consent=false,background=false,pack=false,date}={}){
 const stage=journeyStage(trip,date),sources=record?.sources||[],plan=candidateDraft(trip,record),events=sources.filter(s=>s.kind==='event');
 const busy=record?.status==='researching'?'관광 자료 확인 중':record?.status==='summarizing'?'Gemini 요약 중':record?.error||'저장된 준비 내용을 확인하세요.';
 return '<section class="panel autopilot-panel" id="autopilot-panel" aria-label="자동 여행 준비"><div class="section-heading"><div><span class="pill">'+esc(stage.label)+'</span><h2>'+(stage.id==='after'?'이번 여행의 기록':stage.id==='during'?'오늘 필요한 여행 준비':'여행딱이 준비하고 있어요')+'</h2></div></div><p role="status">'+esc(consent?busy:'기기 내 준비는 자동으로 시작했습니다. 온라인 조사는 아래에서 한 번만 허용해 주세요.')+'</p>'+(record?.officialStatus==='partial'?'<p class="notice">일부 공식 자료를 확인하지 못했습니다. 이전에 확인한 자료는 당시 확인 시각으로 보관하며 최신 정보가 아닐 수 있습니다.</p>':'')+(record?.changed?'<p class="notice">공식 조회 내용이 이전 확인과 달라졌습니다. 새 후보와 일정 충돌을 확인하세요.</p>':'')+'<div class="prep-grid"><div><strong>기본 준비 ✓</strong><small>날짜별 준비 항목 구성</small></div><div><strong>관광지 '+(sources.some(s=>s.kind==='place')?'조회됨':'확인 필요')+'</strong><small>'+sources.filter(s=>s.kind==='place').length+'개 공식 후보</small></div><div><strong>행사 '+(record?.officialStatus==='ok'?'조회됨':'확인 필요')+'</strong><small>'+events.length+'건 · 검색 범위 내 결과</small></div><div><strong>날씨 확인 필요</strong><small>출발 전 공식 예보 확인 항목</small></div><div><strong>여행팩 '+(pack?'기기에 저장됨':'저장 준비 중')+'</strong><small>주소·메모·회화 · 지도/티켓 제외</small></div><div><strong>자동 갱신 '+(background?'서버 등록 허용':'앱 실행 중')+'</strong><small>서버 허용 시 D-30·14·7 이후 날짜별 확인 · 한도 적용</small></div></div>'+(consent?'<button class="linkbtn" data-action="auto-disable">온라인 자동 준비 끄기</button>':'<p class="note">허용하면 여행지·지역·날짜·일수만 Firebase와 한국관광공사에 전송하고, Gemini가 공식 자료를 요약합니다. 사진·메모·예약은 전송하지 않습니다. 로그인과 기존 호출 한도가 적용됩니다.</p><button class="secondary" data-action="auto-enable">온라인 자동 준비 허용</button>')+(record?.error?.includes('인증')?'<button class="secondary" data-action="auto-login">Google 계정 인증</button>':'')+(background?'<button class="linkbtn" data-action="background-disable">서버 자동 준비 중단·자료 삭제</button>':'<details><summary>앱을 닫아도 준비하도록 설정</summary><p class="note">여행지·지역·날짜·일수·시간대를 Firebase에 보관하고 공식 관광 자료와 Gemini 요약을 갱신합니다. 사진·메모·예약은 제외합니다. 종료 후 최대 8일 내 자동 삭제하며 언제든 중단·삭제할 수 있습니다. 푸시 알림은 미연결이고 기존 호출 한도가 적용됩니다.</p><button class="secondary" data-action="background-enable">서버 자동 준비 허용</button></details>')+(record?.text?'<details><summary>Gemini 준비 요약 · 참고용</summary><p class="ai-summary">'+esc(record.text)+'</p></details>':'')+'<h3>'+((stage.id==='during')?'오늘의 방문 후보':record?.itinerary?.length?'Gemini가 구성한 날짜별 방문 후보':'공식 자료로 나눈 날짜별 방문 후보')+'</h3><details><summary>방문 후보의 확인 범위</summary><p class="note">부분 구현: 후보를 날짜별로 배분했습니다. 영업시간·이동시간·예약·날씨를 확인한 실행 일정은 아직 아닙니다. 직접 기록한 일정은 보존합니다.</p></details>'+plan.filter((d,i)=>stage.id==='during'?i===stage.day:d.items.length||i===0).map(d=>'<article class="auto-day"><strong>'+d.date+'</strong>'+(d.items.length?d.items.map(s=>'<p>'+esc(s.title)+'<small>'+esc(s.address)+' · '+esc(s.note)+'</small></p>').join(''):'<p class="muted">확인된 관광 후보가 아직 없습니다.</p>')+'</article>').join('')+(record?.checkedAt?'<p class="note">마지막 조회 '+esc(record.checkedAt)+'<br>'+esc(record.officialNote||'')+'</p>':'')+'</section>';
}
