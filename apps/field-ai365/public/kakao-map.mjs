import {ArcGISProvider,ProviderBlocked} from './providers.mjs';
let sdkPromise,loadedKey;
export function createMapProvider(settings={}){return settings.provider==='arcgis'?new ArcGISProvider({key:settings.key}):new KakaoMapProvider({key:settings.kakaoKey});}
export function loadKakao(key){
 if(!key)return Promise.reject(new ProviderBlocked('카카오 JavaScript 키 미설정 · 지도 연결 설정에서 입력해 주세요.'));
 if(loadedKey&&loadedKey!==key)return Promise.reject(new Error('지도 키를 변경했습니다. 앱을 다시 열어 주세요.'));
 if(sdkPromise)return sdkPromise;
 loadedKey=key;sdkPromise=new Promise((resolve,reject)=>{
  let stage='SDK 다운로드',blocked=false,httpStatus=0,settled=false;
  const policy=e=>{if(/kakao|daum/.test(e.blockedURI||''))blocked=true;};
  const native=e=>{httpStatus=Number(e.detail?.status)||0;};
  window.addEventListener('securitypolicyviolation',policy);window.addEventListener('kakao-resource-error',native);
  const cleanup=()=>{clearTimeout(timer);window.removeEventListener('securitypolicyviolation',policy);window.removeEventListener('kakao-resource-error',native);};
  const script=document.createElement('script');script.src='https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey='+encodeURIComponent(key);
  const timer=setTimeout(()=>fail(),15000);
  function fail(){if(settled)return;settled=true;cleanup();script.remove();sdkPromise=null;loadedKey=null;const reason=blocked?'앱 보안정책에서 SDK 차단':httpStatus===401||httpStatus===403?'인증/권한 거절 ('+httpStatus+') · 지도 API 활성화·JavaScript 키의 허용 도메인 확인':httpStatus?'서버 응답 '+httpStatus:stage+' 실패 · 인터넷·JavaScript 키·지도 API 활성화·허용 도메인 확인';reject(new Error('카카오 지도: '+reason));}
  script.onerror=fail;script.onload=()=>{stage='SDK 초기화';if(!globalThis.kakao?.maps?.load){fail();return;}globalThis.kakao.maps.load(()=>{if(settled)return;settled=true;cleanup();resolve(globalThis.kakao.maps);});};document.head.append(script);
 });return sdkPromise;
}
export class KakaoMapProvider{
 constructor({key='',loader=loadKakao}={}){this.key=key;this.loader=loader;this.listeners=[];this.markers=[];}
 async render(container,{center={latitude:37.5665,longitude:126.978},sites=[],satellite=false,onSelect=()=>{},onSite=()=>{}}={}){
  if(!this.key)throw new ProviderBlocked('카카오 JavaScript 키 미설정 · 지도 연결 설정에서 입력해 주세요.');
  const sdk=await this.loader(this.key);this.destroy();this.sdk=sdk;container.replaceChildren();const canvas=document.createElement('div');canvas.style.height='360px';canvas.style.width='100%';canvas.setAttribute('aria-label','카카오 현장 지도');container.append(canvas);
  this.map=new sdk.Map(canvas,{center:new sdk.LatLng(center.latitude,center.longitude),level:4});this.map.setMapTypeId(satellite?sdk.MapTypeId.HYBRID:sdk.MapTypeId.ROADMAP);
  const bind=(target,type,handler)=>{sdk.event.addListener(target,type,handler);this.listeners.push([target,type,handler]);};
  bind(this.map,'click',e=>onSelect({latitude:e.latLng.getLat(),longitude:e.latLng.getLng()}));
  for(const site of sites.filter(s=>Number.isFinite(s.latitude)&&Number.isFinite(s.longitude))){const marker=new sdk.Marker({map:this.map,position:new sdk.LatLng(site.latitude,site.longitude),title:site.name});this.markers.push(marker);bind(marker,'click',()=>onSite(site));}
  this.map.addControl(new sdk.ZoomControl(),sdk.ControlPosition.RIGHT);this.map.relayout();
 }
 destroy(){if(this.sdk)for(const [target,type,handler]of this.listeners)this.sdk.event.removeListener(target,type,handler);for(const marker of this.markers)marker.setMap(null);this.listeners=[];this.markers=[];this.map=null;}
}
