import {normalizeRequest} from './policy.mjs';
export function normalizeAuto(data){
 if(!data||!['register','get','remove','removeAll'].includes(data.operation))throw Error('invalid');
 if(data.operation==='removeAll')return {operation:data.operation};
 if(typeof data.id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(data.id))throw Error('invalid');
 const result={operation:data.operation,id:data.id};
 if(data.operation==='register'){
  if(data.consent!==true)throw Error('consent');
  result.trip=normalizeRequest({mode:'prepare',trip:data.trip}).trip;
  new Intl.DateTimeFormat('sv-SE',{timeZone:data.timeZone});
  if(typeof data.timeZone!=='string'||data.timeZone.length>60)throw Error('timezone');
  result.timeZone=data.timeZone;
 }
 return result;
}
export function refreshPhase(trip,timeZone,now=Date.now()){
 const date=new Intl.DateTimeFormat('sv-SE',{timeZone}).format(new Date(now));
 const left=Math.round((Date.parse(trip.start)-Date.parse(date))/86400000);
 if(date>trip.end)return 'complete';
 if(left<=0)return 'during:'+date;
 if(left<=7)return 'before:'+date;
 return left<=14?'d14':left<=30?'d30':'initial';
}
export function autoFingerprint(records=[]){return JSON.stringify(records.map(r=>[r.id,r.title,r.address,r.start,r.end,r.openingHours]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));}
