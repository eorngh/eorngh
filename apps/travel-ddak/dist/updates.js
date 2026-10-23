export async function setupUpdates({serviceWorker,button,saveNotes,reload,notify}){
 let applying=false,reloading=false;
 serviceWorker.addEventListener('controllerchange',()=>{if(applying&&!reloading){reloading=true;reload();}});
 try{
  const registration=await serviceWorker.register('./sw.js',{updateViaCache:'none'});
  const offer=()=>{if(registration.waiting&&button)button.hidden=false;};
  offer();
  registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed')offer();});});
  button?.addEventListener('click',()=>{
   if(applying||!registration.waiting)return;
   try{saveNotes();applying=true;registration.waiting.postMessage({type:'APPLY_UPDATE'});}
   catch(error){applying=false;notify('메모를 저장하지 못해 업데이트를 보류했습니다. '+(error?.message||''));}
  });
  registration.update().catch(()=>{});
  return registration;
 }catch{notify('오프라인 캐시를 준비하지 못했어요. 백업 파일을 따로 보관해 주세요.');return null;}
}
