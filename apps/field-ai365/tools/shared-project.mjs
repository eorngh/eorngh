import {createRequire}from'node:module';import{readFile,writeFile,mkdir}from'node:fs/promises';
const require=createRequire(import.meta.url);
const auth=require('C:/Users/eorng/AppData/Local/npm-cache/_npx/ba4f1959e38407b5/node_modules/firebase-tools/lib/auth.js');
const account=auth.getGlobalDefaultAccount();if(!account)throw new Error('Firebase CLI 로그인 필요');
const token=await auth.getAccessToken(account.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform','https://www.googleapis.com/auth/firebase']);
async function get(path){const r=await fetch('https://firebaserules.googleapis.com/v1/'+path,{headers:{Authorization:'Bearer '+token.access_token}});if(!r.ok)throw new Error('Rules API HTTP '+r.status);return r.json();}
await mkdir('.local/shared-project',{recursive:true});
const releases=await get('projects/gyeongilwater/releases');
const verified=[];
for(const service of ['cloud.firestore','firebase.storage']){
 const release=releases.releases?.find(r=>r.name.includes('/releases/'+service));if(!release){console.log(service+' release absent');continue;}
 const ruleset=await get(release.rulesetName);const source=ruleset.source.files[0].content;
 await writeFile('.local/shared-project/'+service+'.original.rules',source);
 const own=await readFile(service==='cloud.firestore'?'firebase/firestore.rules':'firebase/storage.rules','utf8');
 const start=own.indexOf('match /hyeonjang365Users');const end=own.lastIndexOf('\n }');const block=own.slice(start,end);
 if(source.includes('match /hyeonjang365Users'))throw new Error('현장AI365 기존 규칙 존재: 자동 병합 중단');
 const insert=source.lastIndexOf('}',source.lastIndexOf('}')-1);if(insert<0)throw new Error('규칙 구조 확인 필요');
 const merged=source.slice(0,insert)+'\n'+block+'\n'+source.slice(insert);
 await writeFile('.local/shared-project/'+service+'.merged.rules',merged);
 console.log(service+': live baseline backed up; additive merge prepared');
 const path=service==='cloud.firestore'?'/databases/(default)/documents/hyeonjang365Users/test-owner/sites/test-site':'/b/gyeongilwater.firebasestorage.app/o/hyeonjang365Users/test-owner/photos/test-photo';
 const tests=[{expectation:'ALLOW',request:{auth:{uid:'test-owner'},path,method:'get'}},{expectation:'DENY',request:{auth:{uid:'test-other'},path,method:'get'}},{expectation:'DENY',request:{path,method:'get'}}];
 const response=await fetch('https://firebaserules.googleapis.com/v1/projects/gyeongilwater:test',{method:'POST',headers:{Authorization:'Bearer '+token.access_token,'Content-Type':'application/json'},body:JSON.stringify({source:{files:[{name:service+'.rules',content:merged}]},testSuite:{testCases:tests}})});
 const result=await response.json();await writeFile('evidence/shared-'+service+'-rules-test.json',JSON.stringify(result,null,2));
 if(!response.ok||result.issues?.some(i=>i.severity==='ERROR')||result.testResults?.some(t=>t.state!=='SUCCESS'))throw new Error(service+': rules verification failed; no deployment');
 console.log(service+': compiled and owner/other/unauthenticated tests '+JSON.stringify(result.testResults?.map(t=>t.state)));
 verified.push({service,release,source,merged});
}
if(process.argv.includes('--deploy')){
 for(const entry of verified){
  const current=await get(entry.release.name);if(current.rulesetName!==entry.release.rulesetName)throw new Error('운영 규칙 변경 감지: 배포 중단');
  const create=await fetch('https://firebaserules.googleapis.com/v1/projects/gyeongilwater/rulesets',{method:'POST',headers:{Authorization:'Bearer '+token.access_token,'Content-Type':'application/json'},body:JSON.stringify({source:{files:[{name:entry.service+'.rules',content:entry.merged}]}})});const created=await create.json();if(!create.ok)throw new Error('Ruleset creation failed HTTP '+create.status);
  const patch=await fetch('https://firebaserules.googleapis.com/v1/'+entry.release.name,{method:'PATCH',headers:{Authorization:'Bearer '+token.access_token,'Content-Type':'application/json'},body:JSON.stringify({release:{name:entry.release.name,rulesetName:created.name},updateMask:'rulesetName'})});if(!patch.ok)throw new Error('Release update failed HTTP '+patch.status);
  const check=await get(entry.release.name);if(check.rulesetName!==created.name)throw new Error('Release verify failed');
  await writeFile('evidence/shared-'+entry.service+'-deployment.json',JSON.stringify({project:'gyeongilwater',service:entry.service,previousRuleset:entry.release.rulesetName,newRuleset:created.name,verified:true,time:new Date().toISOString()},null,2));
  console.log(entry.service+': deployed additive rules; release verified');
 }
}
