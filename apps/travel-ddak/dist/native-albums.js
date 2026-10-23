import {classifyPhotos,tripTimeZone} from './photo-candidates.js';
export function createNativeAlbums({storage,store,changed,isCurrent,tripExists,bridge=()=>import('./native-photos.js')}){
 const states=new Map(),running=new Map(),epochs=new Map();let generation=0;let consent=false;try{consent=storage.getItem('travel-ddak.photo-auto')==='true';}catch{/* Photo access remains off if storage is unavailable. */}
 const get=id=>states.get(id)||{};
 const emit=(id,patch)=>{states.set(id,{...get(id),...patch});changed(id,get(id));};
 async function ensure(trip,{force=false,center=null}={}){
  if(!consent||running.has(trip.id))return;
  const epoch=epochs.get(trip.id)||0,version=generation;
  const valid=()=>consent&&generation===version&&(epochs.get(trip.id)||0)===epoch&&tripExists(trip.id);
  const task=(async()=>{
   try{
    const native=await bridge(),permissions=await native.status();
    if(!valid())return;
    if(permissions.access==='denied'){await store.removeAlbum(trip.id);emit(trip.id,{access:'denied',album:null,message:'사진 접근이 허용되지 않았습니다. 기본 여행 준비는 계속 이용할 수 있습니다.'});return;}
    if(!force&&permissions.access==='full'&&get(trip.id).access==='full'&&get(trip.id).photoLocation===permissions.photoLocation&&get(trip.id).checkedAt>Date.now()-15*60000)return;
    if(permissions.access==='limited')emit(trip.id,{album:null,access:'limited'});
    emit(trip.id,{access:permissions.access,message:'여행 기간의 사진 후보를 기기 안에서 찾고 있어요.'});
    let photos=[],afterId='0',hasMore=true;
    while(hasMore&&photos.length<5000){
     const result=await native.scan({start:trip.start,end:trip.end,timeZone:tripTimeZone(trip),afterId,limit:100});
     if(!valid())return;
     photos.push(...result.photos);if(result.afterId===afterId)break;afterId=result.afterId;hasMore=result.hasMore;
     emit(trip.id,{message:photos.length+'장 메타데이터 확인 중 · 원본은 변경하지 않습니다.'});
    }
    const album=classifyPhotos(photos,trip,center);album.access=permissions.access;album.truncated=hasMore;
    if(!valid())return;
    const unchanged=async()=>{const current=await native.status();if(!valid())return false;if(current.access!==permissions.access||current.photoLocation!==permissions.photoLocation){await store.removeAlbum(trip.id);emit(trip.id,{album:null,access:current.access,message:'사진 권한 범위가 바뀌었습니다. 현재 허용한 사진으로 다시 확인해 주세요.'});return false;}return true;};
    if(!await unchanged())return;
    await store.saveAlbum(album);if(!valid()){await store.removeAlbum(trip.id);return;}if(!await unchanged())return;
    emit(trip.id,{album,photoLocation:permissions.photoLocation,checkedAt:Date.now(),message:album.photos.length+'장 사진 후보를 정리했습니다.'+(hasMore?' 5,000장 검사 한도에 도달해 이후 사진은 포함되지 않았습니다.':'')});
   }catch(error){if(!valid())return;if(error?.code==='PHOTO_PERMISSION_DENIED')await store.removeAlbum(trip.id);emit(trip.id,{...(error?.code==='PHOTO_PERMISSION_DENIED'?{album:null,access:'denied'}:{}),message:error?.code==='PHOTO_PERMISSION_DENIED'?'사진 권한이 바뀌었습니다. 기본 여행 기능은 유지됩니다.':'사진 자동 정리를 완료하지 못했습니다. 기존 여행과 원본 사진은 유지됩니다.'});}
  })();running.set(trip.id,task);try{await task;}finally{running.delete(trip.id);}
 }
 async function allow(trip){const permissions=await(await bridge()).allow();consent=permissions.access!=='denied';storage.setItem('travel-ddak.photo-auto',String(consent));emit(trip.id,{access:permissions.access});if(consent)await ensure(trip,{force:true});else emit(trip.id,{album:null,message:'사진 접근을 허용하지 않았습니다. 기본 여행 준비는 계속 사용할 수 있습니다.'});}
 async function restore(trip){if(!consent)return;try{const native=await bridge(),permissions=await native.status();if(permissions.access!=='full'){emit(trip.id,{album:null,access:permissions.access,message:'현재 허용한 사진 범위로 다시 확인합니다.'});return;}const version=generation,epoch=epochs.get(trip.id)||0;const album=await store.readAlbum(trip.id),current=await native.status();if(!consent||generation!==version||(epochs.get(trip.id)||0)!==epoch)return;if(current.access!=='full'||current.photoLocation!==permissions.photoLocation){await store.removeAlbum(trip.id);emit(trip.id,{album:null,access:current.access,message:'사진 권한이 바뀌어 저장된 후보를 표시하지 않습니다.'});return;}if(album&&tripExists(trip.id))emit(trip.id,{album,access:permissions.access,message:'기기에 보관된 사진 후보입니다. 여행 날짜로 다시 확인합니다.'});}catch{}}
 async function previews(trip){if(!isCurrent(trip.id))return;const native=await bridge();const nodes=[...document.querySelectorAll('#native-photos img[data-photo-id]')];for(const img of nodes){if(!isCurrent(trip.id)||!img.isConnected)return;try{const value=await native.thumbnail(img.dataset.photoId);if(img.isConnected)img.src=value.dataUrl;}catch{if(img.isConnected)img.alt='접근할 수 없는 사진 · 권한을 확인하세요.';}}}
 async function confirm(trip){const album=get(trip.id).album;if(!album)throw Error('정리할 사진 후보가 아직 없습니다.');await store.saveAlbum({...album,confirmedAt:new Date().toISOString()});emit(trip.id,{message:'앱 안에 여행 앨범 분류 결과를 보관했습니다. 원본은 이동하거나 수정하지 않았습니다.'});}
 function more(trip){emit(trip.id,{visible:Math.min(5000,(get(trip.id).visible||24)+24)});}
 function remove(id){epochs.set(id,(epochs.get(id)||0)+1);states.delete(id);return store.removeAlbum(id);}
 function clear(){generation++;consent=false;storage.setItem('travel-ddak.photo-auto','false');states.clear();}
 return {get,allow,ensure,restore,previews,confirm,more,remove,clear};
}
