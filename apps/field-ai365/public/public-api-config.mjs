// Public server address only. Approval keys must never enter this configuration.
export function publicApiOrigin(value){
 if(typeof value!=='string'||!value.trim())throw Error('HTTPS 서버 주소가 필요합니다.');
 const url=new URL(value);
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/'||['localhost','127.0.0.1','[::1]','appassets.androidplatform.net'].includes(url.hostname)||url.hostname.endsWith('.localhost'))throw Error('인증정보·경로 없는 외부 HTTPS 서버 주소가 필요합니다.');
 return url.origin;
}
export function readNativePublicApiOrigin(bridge=globalThis.NativeBridge){
 try{return publicApiOrigin(JSON.parse(bridge.getPublicApiConfig()).origin);}catch{return '';}
}
