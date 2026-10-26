import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {publicApiOrigin} from '../public/public-api-config.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const nativeOrigin='https://appassets.androidplatform.net';
export async function verifyAndroidPublicApi(value,{fetcher=globalThis.fetch}={}){
 const origin=publicApiOrigin(value);
 const request=async path=>{
  const response=await fetcher(origin+path,{headers:{Origin:nativeOrigin},signal:AbortSignal.timeout(15000),redirect:'error',credentials:'omit'});
  if(!response.ok||response.headers.get('access-control-allow-origin')!==nativeOrigin)throw Error('서버 응답 또는 Android CORS 허용을 확인하지 못했습니다.');
  return response.json();
 };
 const status=await request('/api/public-data/status');
 if(status.service!=='field-ai365'||status.addressSearchConfigured!==true)throw Error('현장365 주소 검색 서버가 준비되지 않았습니다.');
 const data=await request('/api/address?keyword='+encodeURIComponent('세종대로 209'));
 if(data.status!=='LIVE'||!Array.isArray(data.items)||!data.items.length||!data.items.every(row=>typeof row.roadAddress==='string'&&row.roadAddress.trim()))throw Error('실제 주소 조회를 확인하지 못했습니다.');
 return {origin,addressCount:data.items.length};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const index=process.argv.indexOf('--server');
  const result=await verifyAndroidPublicApi(index>=0?process.argv[index+1]:undefined);
  await mkdir(resolve(root,'.local'),{recursive:true});
  await writeFile(resolve(root,'.local/public-api-runtime.json'),JSON.stringify({origin:result.origin})+'\n');
  console.log('PASS: HTTPS 서버 · Android CORS · 주소 조회 '+result.addressCount+'건 확인. npm run build로 Android 자산을 갱신하세요.');
  console.log('휴대폰 설치·실제 조회는 별도 검증이 필요합니다.');
 }catch{console.error('연결 미완료: 현장365 HTTPS 서버, Android 출처 허용, 실제 주소 응답을 확인하세요. 기존 연결 설정은 변경하지 않았습니다. 승인키는 입력하지 마세요.');process.exitCode=2;}
}
