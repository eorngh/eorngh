import {validateRecord,uuid,samePhotoOriginal} from './core.mjs';
export function resolveConflictRecord(collection,local,remote,choice,approved){
 if(approved!==true)throw new Error('버전 선택 승인이 필요합니다.');
 if(local)validateRecord(collection,local);if(remote)validateRecord(collection,remote);
 if(local&&remote&&local.id!==remote.id)throw new Error('서로 다른 기록은 대체할 수 없습니다.');
 if(choice==='local'){if(!local)throw new Error('기기 버전이 없습니다.');const selected={...local,remoteTag:remote?.remoteTag,dirty:true,revision:uuid(),updatedAt:new Date().toISOString()};
  if(collection==='photos'&&!selected.deleted){
   if(!remote||remote.deleted){if(!selected.blob)throw new Error('기기에 사진 원본이 없어 복원할 수 없습니다. 원본 포함 백업을 복구해 주세요.');delete selected.remoteObject;}
   else if(!selected.remoteObject&&!selected.blob&&remote.remoteObject)selected.remoteObject=remote.remoteObject;
  }
  return selected;
 }
 if(choice==='remote'){if(!remote)throw new Error('원격 버전이 없습니다.');const{blob,...record}=remote;record.dirty=false;
  if(collection==='photos'&&samePhotoOriginal(local,record))record.blob=local.blob;
  return record;
 }
 throw new Error('기기 또는 원격 버전을 선택해 주세요.');
}
