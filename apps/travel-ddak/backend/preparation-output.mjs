import {buildPrompt} from './policy.mjs';
export function preparationPrompt(input,facts){
 const prompt=buildPrompt(input,facts);
 if(input.mode!=='prepare')return prompt;
 prompt.systemInstruction.parts[0].text+=' 공식 목록 안에서만 날짜별 방문 후보를 제안한다. 확정 동선·영업시간·예약시간은 만들지 않는다. JSON만 반환: {"summary":"한국어 준비 요약 200자 이내","itinerary":[{"day":0,"sourceId":"officialFacts의 id"}]}. day는 0부터 여행 일수-1. 중복 장소 금지. 행사 기간에 맞는 날짜만 사용. 공식 자료가 없으면 itinerary는 빈 배열. 최대 10개 후보.';
 prompt.generationConfig.responseMimeType='application/json';return prompt;
}
export function parsePreparation(raw,trip,facts){
 const value=JSON.parse(raw);if(!value||typeof value.summary!=='string'||!value.summary.trim()||!Array.isArray(value.itinerary)||value.itinerary.length>10)throw Error('invalid-ai-plan');
 const byId=new Map(facts.map(s=>[s.id,s])),seen=new Set();
 const itinerary=value.itinerary.map(item=>{
  const fact=byId.get(item?.sourceId);if(!fact||!Number.isInteger(item.day)||item.day<0||item.day>=trip.days||seen.has(item.sourceId))throw Error('ungrounded-ai-plan');
  const date=new Date(Date.parse(trip.start+'T00:00:00Z')+item.day*86400000).toISOString().slice(0,10).replaceAll('-','');
  if(fact.kind==='event'&&(!fact.start||!fact.end||date<fact.start||date>fact.end))throw Error('event-outside-date');
  seen.add(item.sourceId);return {day:item.day,sourceId:item.sourceId};
 });return {text:value.summary.trim().slice(0,2000),itinerary};
}
