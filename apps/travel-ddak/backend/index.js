import {initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {onCall,HttpsError} from 'firebase-functions/v2/https';
import {onSchedule} from 'firebase-functions/v2/scheduler';
import {createAutoJobs} from './auto-jobs.mjs';
import {preparationPrompt,parsePreparation} from './preparation-output.mjs';
import {loadEntryGuidance} from './entry-guidance.mjs';
import {approvedTravelTester} from './test-access.mjs';
import {defineSecret} from 'firebase-functions/params';
import {normalizeRequest,checkQuota,buildPrompt,LIMITS,MAP_LIMITS} from './policy.mjs';
import {loadOfficialFacts} from './tour.mjs';
import {loadOfficialPhotos} from './tour-photo.mjs';
import {createOfficialCache} from './official-cache.mjs';
initializeApp();
const key=defineSecret('TRAVEL_DDAK_GEMINI_KEY');
const tourKey=defineSecret('TRAVEL_DDAK_TOUR_KEY');
const photoKey=defineSecret('TRAVEL_DDAK_TOUR_PHOTO_KEY');
const mapsKey=defineSecret('TRAVEL_DDAK_MAPS_EMBED_KEY');
const db=getFirestore();
const officialBundle=createOfficialCache(async trip=>{
 const [official,photos]=await Promise.all([
  loadOfficialFacts(trip,tourKey.value()).catch(()=>({status:'unavailable',records:[],note:'공식 자료를 가져오지 못했습니다. 장소·행사를 생성하지 않습니다.'})),
  loadOfficialPhotos(trip,photoKey.value()).catch(()=>[])
 ]);
 if(trip.kind==='overseas')official.entry=await loadEntryGuidance(trip);
 return {official,photos};
});
export const travelDdakHybrid=onCall({region:'asia-northeast3',secrets:[key,tourKey,photoKey,mapsKey],minInstances:0,maxInstances:1,concurrency:1,memory:'256MiB',cpu:'gcf_gen1',timeoutSeconds:60,cors:['https://travel-ddak-mj-20261015.ablecrab2.chatgpt.site','https://localhost','http://localhost','http://127.0.0.1:4173'],consumeAppCheckToken:false},async request=>{
 if(!request.auth)throw new HttpsError('unauthenticated','딱모둠 계정으로 먼저 로그인하세요.');
 if(!approvedTravelTester(request.auth))throw new HttpsError('permission-denied','현재 승인된 여행딱 테스트 계정만 사용할 수 있습니다.');
 let input;try{input=normalizeRequest(request.data);}catch{throw new HttpsError('invalid-argument','입력 길이·언어·여행 기간을 확인하세요.');}
 await reserveQuota(request.auth.uid,input.mode==='map'||input.mode==='official');
 if(input.mode==='map'){
  const url=new URL('https://www.google.com/maps/embed/v1/place');url.search=new URLSearchParams({key:mapsKey.value(),q:input.query,language:'ko'});
  return {kind:'map',url:url.href};
 }
 const {official,photos}=input.mode==='prepare'||input.mode==='official'?await officialBundle(input.trip):{official:{status:'not-requested',records:[]},photos:[]};
 if(official.errorCodes?.length)console.warn('tour-provider-error-codes',JSON.stringify(official.errorCodes));
 if(input.mode==='official')return {kind:'official',officialSources:official.records,officialStatus:official.status,officialNote:official.note||'',entry:official.entry||null,photos,generatedAt:new Date().toISOString()};
 return generateAdvice(input,official,photos);
});

async function reserveQuota(uid,lookup){
 const day=new Date().toISOString().slice(0,10),month=day.slice(0,7);
 const collection=lookup?'travelDdakLookupLimits':'travelDdakAiLimits',limits=lookup?MAP_LIMITS:LIMITS;
 const globalRef=db.doc(`${collection}/${month}`),userRef=db.doc(`${collection}/${month}/users/${uid}`);
 await db.runTransaction(async tx=>{
  const [global,user]=await Promise.all([tx.get(globalRef),tx.get(userRef)]);
  const g=global.data()?.count||0,u=user.data()?.count||0,d=user.data()?.day===day?user.data()?.dayCount||0:0;
  if(!checkQuota(g,u,d,limits))throw new HttpsError('resource-exhausted','호출 한도에 도달했습니다. 기기 내 기능은 계속 사용할 수 있습니다.');
  // Reserve before contacting the supplier. Failed requests also consume a slot.
  tx.set(globalRef,{count:g+1,month});tx.set(userRef,{count:u+1,day,dayCount:d+1});
 });
}
async function generateAdvice(input,official,photos){
 let response;
 try{response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key.value()},body:JSON.stringify(preparationPrompt(input,official.records)),signal:AbortSignal.timeout(25_000)});}catch{throw new HttpsError('unavailable','Gemini 연결에 실패했습니다. 로컬 여행은 보존됩니다.');}
 if(!response.ok)throw new HttpsError('unavailable',response.status===402?'Gemini 크레딧 확인이 필요합니다.':'Gemini가 응답하지 못했습니다. 잠시 후 다시 시도하세요.');
 const data=await response.json();
 const result=data.candidates?.[0]?.content?.parts?.filter(p=>!p.thought).map(p=>p.text||'').join('').trim();
 if(!result)throw new HttpsError('unavailable','생성된 답변이 없습니다.');
 let prepared={text:result.slice(0,6000)};if(input.mode==='prepare'){try{prepared=parsePreparation(result,input.trip,official.records);}catch{throw new HttpsError('unavailable','AI 일정 후보의 공식 근거를 확인하지 못했습니다. 공식 자료는 유지됩니다.');}}
 return {...prepared,entry:official.entry||null,model:'gemini-3.1-flash-lite',generatedAt:new Date().toISOString(),officialSources:official.records,officialStatus:official.status,officialNote:official.note||'',photos,rules:input.rules||[],disclaimer:'AI 조언과 아래 공식 API 조회 결과를 구분해 확인하세요. 영업·취소·예약·입국 조건을 확정한 결과가 아닙니다.'};
}

const autoJobs=createAutoJobs({db,reserveQuota,officialBundle,generateAdvice});
export const travelDdakAuto=onCall({region:'asia-northeast3',secrets:[key,tourKey,photoKey],minInstances:0,maxInstances:1,concurrency:1,memory:'256MiB',cpu:'gcf_gen1',timeoutSeconds:60,cors:['https://travel-ddak-mj-20261015.ablecrab2.chatgpt.site','https://localhost','http://localhost','http://127.0.0.1:4173']},autoJobs.call);
export const travelDdakRefresh=onSchedule({schedule:'0 * * * *',timeZone:'Asia/Seoul',region:'asia-northeast3',secrets:[key,tourKey,photoKey],minInstances:0,maxInstances:1,concurrency:1,memory:'256MiB',cpu:'gcf_gen1',timeoutSeconds:180,retryCount:0},autoJobs.tick);
