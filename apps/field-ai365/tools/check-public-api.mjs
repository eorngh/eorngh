import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer,loadEnv} from '../server.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export function serverBase(value){
  const url=new URL(value);
  if(url.username||url.password||url.search||url.hash)throw Error('Server URL must not contain credentials or query parameters');
  if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname)))throw Error('HTTPS or loopback HTTP is required');
  return url.href.replace(/\/$/,'');
}
export async function checkPublicApi({env={},baseUrl,fetcher=globalThis.fetch,serverFactory=createServer,now=()=>new Date()}={}){
  const result={checkedAt:now().toISOString(),status:'NOT_VERIFIED',localKeyConfigured:!!env.JUSO_SEARCH_KEY?.trim(),existingServerRecognized:false,serverOrigin:null,checkedVia:null,addressCount:0};
  const port=Number(env.PORT||3650);
  if(!baseUrl&&(!Number.isInteger(port)||port<1||port>65535))return {...result,status:'INVALID_CONFIG'};
  let base;try{base=serverBase(baseUrl||`http://127.0.0.1:${port}`);}catch{return {...result,status:'INVALID_SERVER_URL'};}
  const lookup=async(target,via)=>{
    try{
      const response=await fetcher(target+'/api/address?keyword='+encodeURIComponent('세종대로 209'),{signal:AbortSignal.timeout(15000),redirect:'error'});
      const data=await response.json();
      if(!response.ok||data.status!=='LIVE'||!Array.isArray(data.items)||!data.items.length||!data.items.every(row=>typeof row.roadAddress==='string'&&row.roadAddress.trim()))return {...result,status:'LOOKUP_NOT_VERIFIED',checkedVia:via};
      // Only an allowlisted summary is recorded; never save raw responses, keys or error URLs.
      return {...result,status:'PASS',checkedVia:via,addressCount:data.items.length};
    }catch{return {...result,status:'LOOKUP_NOT_VERIFIED',checkedVia:via};}
  };
  try{
    const response=await fetcher(base+'/api/public-data/status',{signal:AbortSignal.timeout(2000),redirect:'error'});
    const data=await response.json();
    if(response.ok&&data.service==='field-ai365'){
      result.existingServerRecognized=true;
      result.serverOrigin=new URL(base).origin;
      if(data.addressSearchConfigured===true)return lookup(base,'existing-server');
    }
  }catch{}
  if(baseUrl)return {...result,status:'SERVER_NOT_READY'};
  if(!result.localKeyConfigured)return result;
  // A temporary, loopback-only server verifies the existing local setting without
  // stopping another process or changing the user's configured service port.
  const server=serverFactory({env});
  try{
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    return {...await lookup('http://127.0.0.1:'+server.address().port,'temporary-local-server'),persistentServerStarted:false};
  }catch{return {...result,status:'LOCAL_CHECK_FAILED'};}
  finally{server.closeAllConnections?.();await new Promise(resolve=>server.close(resolve));}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  await loadEnv();
  const index=process.argv.indexOf('--server');
  const result=await checkPublicApi({env:process.env,baseUrl:index>=0?process.argv[index+1]||'invalid':undefined});
  try{
    await mkdir(resolve(root,'.local'),{recursive:true});
    await writeFile(resolve(root,'.local/public-api-check.json'),JSON.stringify(result,null,2)+'\n');
    console.log('공공 주소 API 점검 결과: '+result.status);
    console.log('확인된 주소 결과: '+result.addressCount+'건');
    if(result.serverOrigin)console.log('확인된 기존 서버: '+result.serverOrigin);
    console.log('승인키 값은 기록하지 않았습니다. 결과 파일: .local/public-api-check.json');
    if(result.checkedVia==='temporary-local-server')console.log('임시 서버로 확인한 뒤 종료했습니다. 상시 실행·외부 배포를 의미하지 않습니다.');
    if(result.status!=='PASS')console.log('현재 프로젝트 설정 또는 지정 서버에서 실제 조회를 확인하지 못했습니다. 다른 위치에 설정된 승인키를 삭제하거나 다시 발급하지 마세요.');
    process.exitCode=result.status==='PASS'?0:2;
  }catch{console.error('점검 결과 파일을 저장하지 못했습니다.');process.exitCode=1;}
}
