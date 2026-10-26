import {createHash,randomUUID} from 'node:crypto';
import {HttpsError} from 'firebase-functions/v2/https';
import {normalizeAuto,refreshPhase,autoFingerprint} from './auto-policy.mjs';
import {approvedTravelTester} from './test-access.mjs';
// Explicitly approved test accounts, at most 10 trips; no notes, photos, reservations or GPS.
export function createAutoJobs({db,reserveQuota,officialBundle,generateAdvice}){
 const root=db.collection('travelDdakAutoUsers');
 const jobKey=id=>createHash('sha256').update(id).digest('hex');
 const publicJob=j=>j?{...j.result,...(j.state==='unavailable'?{officialStatus:'unavailable'}:{}),state:j.state,changed:!!j.changed,checkedAt:j.checkedAt||null,nextCheckAt:j.nextCheckAt,background:true}:null;
 async function refresh(uid,id){
  const ref=root.doc(uid),lease=randomUUID(),now=Date.now();let claimed;
  await db.runTransaction(async tx=>{
   claimed=undefined; // Each retry must acquire its own committed lease.
   const snap=await tx.get(ref),data=snap.data(),job=data?.jobs?.[id];
   if(!job||job.leaseUntil>now||job.nextCheckAt>now)return;
   const jobs={...data.jobs};
   if(now>job.expiresAt){delete jobs[id];tx.set(ref,{jobs});return;}
   const phase=refreshPhase(job.trip,job.timeZone,now);
   if(phase==='complete'||phase===job.phase){jobs[id]={...job,nextCheckAt:now+6*3600000,state:phase==='complete'?'complete':job.state};tx.set(ref,{jobs});return;}
   claimed={...job,phase};jobs[id]={...job,lease,leaseUntil:now+180000,nextCheckAt:now+6*3600000};tx.set(ref,{jobs});
  });
  if(!claimed)return;
  let result=claimed.result,state='unavailable',changed=claimed.changed||false,successful=false;
  try{
   await reserveQuota(uid,true);
   const {official,photos}=await officialBundle(claimed.trip);
   if(official.status==='unavailable')throw Error('official-unavailable');
   const retained=official.status==='partial'?(result?.officialSources||[]).map(r=>({...r,carriedForward:true})):[];
   const sources=[...new Map([...retained,...official.records].map(r=>[r.id,r])).values()].slice(0,30);
   const current={officialSources:sources,officialStatus:official.status,officialNote:official.note||'',entry:official.entry||null,photos,generatedAt:new Date().toISOString()};
   changed=changed||(!!result?.officialSources?.length&&official.status==='ok'&&autoFingerprint(result.officialSources)!==autoFingerprint(official.records));
   result=current;state='partial';successful=true;
   try{await reserveQuota(uid,false);result={...await generateAdvice({mode:'prepare',trip:claimed.trip},official,photos),...current};state=official.status==='partial'?'partial':'ready';}catch{/* Official facts survive AI quota/provider failure. */}
  }catch{/* Keep previously verified sources; do not invent an empty success. */}
  await db.runTransaction(async tx=>{
   const snap=await tx.get(ref),data=snap.data(),job=data?.jobs?.[id];
   if(!job||job.lease!==lease)return; // A deleted/replaced trip cannot reappear.
   const jobs={...data.jobs};jobs[id]={...job,result:result||null,state,changed,lastAttemptAt:new Date().toISOString(),checkedAt:successful?new Date().toISOString():job.checkedAt||null,phase:successful?claimed.phase:job.phase||'',lease:'',leaseUntil:0};tx.set(ref,{jobs});
  });
 }
 async function call(request){
  if(!request.auth)throw new HttpsError('unauthenticated','먼저 로그인하세요.');
  if(!approvedTravelTester(request.auth))throw new HttpsError('permission-denied','승인된 테스트 계정만 사용할 수 있습니다.');
  let input;try{input=normalizeAuto(request.data);}catch{throw new HttpsError('invalid-argument','여행 정보와 자동 준비 동의를 확인하세요.');}
  const uid=request.auth.uid,ref=root.doc(uid),id=input.id?jobKey(input.id):'';
  await db.runTransaction(async tx=>{
   const snap=await tx.get(ref),jobs={...(snap.data()?.jobs||{})};
   if(input.operation==='removeAll'){tx.set(ref,{jobs:{}});return;}
   if(input.operation==='remove'){delete jobs[id];tx.set(ref,{jobs});return;}
   if(input.operation!=='register')return;
   if(!jobs[id]&&Object.keys(jobs).length>=10)throw new HttpsError('resource-exhausted','서버 자동 준비는 최대 10개 여행까지 지원합니다.');
   const expiresAt=Date.parse(input.trip.end+'T23:59:59Z')+7*86400000;
   if(expiresAt<Date.now())throw new HttpsError('invalid-argument','이미 보관 기간이 지난 여행입니다.');
   const previous=jobs[id];
   if(previous&&JSON.stringify(previous.trip)===JSON.stringify(input.trip)&&previous.timeZone===input.timeZone)return;
   jobs[id]={trip:input.trip,timeZone:input.timeZone,expiresAt,nextCheckAt:0,state:'waiting',phase:'',registeredAt:new Date().toISOString(),result:null};tx.set(ref,{jobs});
  });
  if(input.operation==='remove'||input.operation==='removeAll')return {removed:true};
  if(input.operation==='register')await refresh(uid,id);
  return publicJob((await ref.get()).data()?.jobs?.[id]);
 }
 async function tick(){
  const snapshots=await root.limit(2).get();let processed=0;
  for(const snap of snapshots.docs){for(const [id,job] of Object.entries(snap.data().jobs||{}).sort((a,b)=>a[1].nextCheckAt-b[1].nextCheckAt)){
   if(job.nextCheckAt>Date.now())continue;
   await refresh(snap.id,id);if(++processed>=3)break;
  }if(processed>=3)break;}
  console.info('travel-ddak-auto-tick',JSON.stringify({processed,at:new Date().toISOString()}));
 }
 return {call,tick};
}
