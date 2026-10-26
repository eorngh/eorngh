import {validateRecord, uuid} from './core.mjs';
export function normalizeSite(old) {
  const site={...old,roadAddress:old.roadAddress??old.address??'',parcelAddress:old.parcelAddress??'',sido:old.sido??'',sigungu:old.sigungu??'',legalDong:old.legalDong??'',adminDong:old.adminDong??'',industry:old.industry??'',workType:old.workType??'',startDate:old.startDate??'',endDate:old.endDate??'',manager:old.manager??'',contact:old.contact??'',customFields:old.customFields??{},createdAt:old.createdAt??old.updatedAt??new Date().toISOString()};
  site.address=site.roadAddress||site.parcelAddress||old.address;
  for(const [key,limit] of [['latitude',90],['longitude',180]])if(site[key]!==undefined&&site[key]!==null&&site[key]!=='') {site[key]=Number(site[key]);if(!Number.isFinite(site[key])||Math.abs(site[key])>limit)throw new Error('좌표 범위를 확인해 주세요.');}else site[key]=null;
  if(!site.customFields||typeof site.customFields!=='object'||Array.isArray(site.customFields))throw new Error('추가 현장정보 형식 오류');
  validateRecord('sites',site);return site;
}
export function createSite(draft,confirmed) {
  if(confirmed!==true)throw new Error('현장 생성 전 최종 확인이 필요합니다.');
  return normalizeSite({...draft,id:uuid(),status:'active',contractAmount:Number(draft.contractAmount||0),revision:uuid(),dirty:true,deleted:false,updatedAt:new Date().toISOString()});
}
export function coordinateText(s){return s.latitude!=null&&s.longitude!=null?`${s.latitude.toFixed(6)}, ${s.longitude.toFixed(6)}`:'좌표 미등록';}
