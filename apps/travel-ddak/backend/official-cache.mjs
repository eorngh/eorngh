// Bounded instance-memory cache. No user text, photos, credentials or durable personal cache.
export function createOfficialCache(load,{now=()=>Date.now(),ttl=6*3600000,max=64}={}){
 const entries=new Map(),pending=new Map();
 return async trip=>{
  const id=JSON.stringify([trip.kind,trip.parentId,trip.city,trip.start,trip.end]);
  const hit=entries.get(id);if(hit&&hit.expires>now())return structuredClone(hit.value);
  if(pending.has(id))return structuredClone(await pending.get(id));
  const job=(async()=>{
   const value=await load(trip);
   if(value.official?.status==='ok'||value.official?.status==='not-covered'){
    entries.delete(id);entries.set(id,{expires:now()+ttl,value:structuredClone(value)});
    while(entries.size>max)entries.delete(entries.keys().next().value);
   }
   return value;
  })();pending.set(id,job);
  try{return structuredClone(await job);}finally{pending.delete(id);}
 };
}
