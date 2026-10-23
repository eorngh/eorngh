import {readFileSync} from 'node:fs';
const verifiedSnapshot=JSON.parse(readFileSync(new URL('./japan-entry.snapshot.json',import.meta.url),'utf8'));
const SOURCE='https://www.mofa.go.jp/j_info/visit/visa/short/novisa.html';
let cached,pending;
export function parseJapanEntry(html,checkedAt){
 const text=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/\s+/g,' ');
 if(!/Exemption of Visa/i.test(text)||!/Republic of Korea/.test(text))throw Error('official-page-changed');
 return {status:'verified-source',country:'jp',checkedAt,scope:'공식 단기체류 안내 · 개인별 입국 허가 판정 아님',summary:'일본 외무성의 단기체류 비자면제 대상 목록에 대한민국이 기재되어 있습니다. 적용 조건과 체류기간은 공식 원문에서 확인하세요.',sources:[{title:'일본 외무성 · 단기체류 비자면제 안내',url:SOURCE,checkedAt}],conditions:['국적·여권 종류·방문 목적·체류기간에 따라 조건이 달라집니다.','취업·유학·장기체류 및 과거 입국 이력 등 개별 조건은 대사관·출입국 기관에 확인하세요.']};
}
export async function loadEntryGuidance(trip,fetcher=fetch){
 if(trip.kind!=='overseas'||trip.parentId!=='jp')return null;
 if(cached&&cached.expires>Date.now())return structuredClone(cached.value);
 if(pending)return structuredClone(await pending);
 pending=(async()=>{try{const r=await fetcher(SOURCE,{signal:AbortSignal.timeout(8000),redirect:'error',headers:{'User-Agent':'TravelDdak/0.3.1 official-source-check'}});if(!r.ok)throw Error('http-'+r.status);const html=await r.text();if(html.length>500000)throw Error('page-too-large');const value=parseJapanEntry(html,new Date().toISOString());cached={value,expires:Date.now()+6*3600000};return value;}catch(error){const failureCode=/^http-\d+$/.test(error?.message||'')?error.message:String(error?.name||'unknown').replace(/[^A-Za-z0-9_-]/g,'').slice(0,40);const value={...structuredClone(verifiedSnapshot),carriedForward:true,refreshStatus:'unavailable',failureCode,lastAttemptAt:new Date().toISOString()};cached={value,expires:Date.now()+10*60000};return value;}})();
 try{return structuredClone(await pending);}finally{pending=null;}
}
