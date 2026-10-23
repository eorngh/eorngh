const KEY='travel-ddak.background-trips.v1';
export function createBackgroundConsent(storage,existingIds=[]){
 let ids=new Set();
 try{const raw=storage.getItem(KEY);if(raw!==null){const value=JSON.parse(raw);if(Array.isArray(value))ids=new Set(value.filter(id=>typeof id==='string'&&id.length<=100));}else if(storage.getItem('travel-ddak.background.v1')==='true'){ids=new Set(existingIds);persist();}}catch{/* Invalid settings never silently opt a new trip in. */}
 function persist(){storage.setItem(KEY,JSON.stringify([...ids]));storage.setItem('travel-ddak.background.v1','false');}
 return {has:id=>ids.has(id),add(id){const next=new Set(ids);next.add(id);storage.setItem(KEY,JSON.stringify([...next]));ids=next;storage.setItem('travel-ddak.background.v1','false');},remove(id){const next=new Set(ids);next.delete(id);storage.setItem(KEY,JSON.stringify([...next]));ids=next;},clear(){storage.setItem(KEY,'[]');ids.clear();storage.setItem('travel-ddak.background.v1','false');},get size(){return ids.size;}};
}
