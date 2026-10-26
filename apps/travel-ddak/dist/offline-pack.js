import {checklistFor} from './core.js';
import {candidateDraft} from './autopilot.js';
export const PHRASES=Object.freeze({
 en:[['도움 요청','Could you help me, please?'],['식당 주문','I would like this, please.'],['숙소 체크인','I have a reservation.'],['택시','Please take me to this address.'],['화장실','Where is the restroom?'],['물 요청','May I have some water, please?'],['알레르기 확인','Does this contain any allergens?'],['카드 결제','Can I pay by card?'],['탑승구','Where is the boarding gate?'],['분실물','I have lost my bag.'],['병원','I need to see a doctor.'],['언어 도움','Do you speak English?']],
 jp:[['도움 요청','手伝っていただけますか。'],['식당 주문','これをお願いします。'],['숙소 체크인','予約しています。'],['택시','この住所までお願いします。'],['화장실','トイレはどこですか。'],['물 요청','お水をいただけますか。'],['알레르기 확인','アレルギーの原因となる食材は入っていますか。'],['카드 결제','カードで払えますか。'],['탑승구','搭乗口はどこですか。'],['분실물','かばんをなくしました。'],['병원','医師の診察を受けたいです。'],['언어 도움','英語を話せますか。']]
});
export function makeOfflinePack(trip,record){
 return {version:1,tripId:trip.id,savedAt:new Date().toISOString(),trip:{id:trip.id,city:trip.city,parentId:trip.parentId,kind:trip.kind,start:trip.start,end:trip.end,days:trip.days,notes:trip.notes,checks:trip.checks,stops:trip.stops||[]},checklist:checklistFor(trip),sources:record?.sources||[],draft:candidateDraft(trip,record),entry:record?.entry||null,summary:record?.text||'',phrases:PHRASES[trip.parentId==='jp'?'jp':'en'],limits:['오프라인 지도·예약 티켓은 포함되지 않음','영업시간·예약·입국요건 미검증','사진·위치·인증정보는 이 여행팩에 포함되지 않음']};
}
export function createPackStore(factory=globalThis.indexedDB){
 let connection;
 async function open(){if(!factory)throw Error('이 환경에서는 기기 내 여행팩 저장을 지원하지 않습니다.');if(!connection)connection=new Promise((resolve,reject)=>{const r=factory.open('travel-ddak-packs',2);r.onupgradeneeded=()=>{for(const name of ['packs','albums'])if(!r.result.objectStoreNames.contains(name))r.result.createObjectStore(name,{keyPath:'tripId'});};r.onsuccess=()=>{r.result.onversionchange=()=>{r.result.close();connection=null;};resolve(r.result);};r.onerror=()=>{connection=null;reject(Error('여행팩 저장소를 열지 못했습니다.'));};r.onblocked=()=>{connection=null;reject(Error('다른 창의 여행팩 저장소를 닫은 뒤 다시 시도하세요.'));};});return connection;}
 async function run(mode,operation,name='packs'){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(name,mode),r=operation(tx.objectStore(name));let value;r.onsuccess=()=>{value=r.result;};tx.oncomplete=()=>resolve(value);tx.onerror=tx.onabort=()=>reject(Error('여행팩을 기기에 보관하지 못했습니다. 기존 여행은 유지됩니다.'));});}
 return {save:pack=>run('readwrite',s=>s.put(pack)),read:id=>run('readonly',s=>s.get(id)),remove:id=>run('readwrite',s=>s.delete(id)),saveAlbum:album=>run('readwrite',s=>s.put(album),'albums'),readAlbum:id=>run('readonly',s=>s.get(id),'albums'),removeAlbum:id=>run('readwrite',s=>s.delete(id),'albums'),clear:()=>Promise.all([run('readwrite',s=>s.clear()),run('readwrite',s=>s.clear(),'albums')])};
}
