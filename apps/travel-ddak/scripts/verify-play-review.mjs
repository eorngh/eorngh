import {spawn} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
const env={...process.env};delete env.PSModulePath;
let credential=await new Promise((resolve,reject)=>{const p=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command','$ErrorActionPreference="Stop"; $s=ConvertTo-SecureString ([IO.File]::ReadAllText($env:LOCALAPPDATA+"/TravelDdak/secrets/play-review.dpapi")); [Console]::Out.Write(([PSCredential]::new("review",$s)).GetNetworkCredential().Password)'],{env,windowsHide:true,stdio:['ignore','pipe','ignore']});let out='';p.stdout.on('data',d=>out+=d);p.on('close',c=>c===0?resolve(JSON.parse(out)):reject(Error('Credential read failed')));});
const cloud=await import('../features/cloud.js');
let evidence={checkedAt:new Date().toISOString()};
try{await cloud.login(credential.email,credential.password);const before=await cloud.inspect();const revision=await cloud.upload({version:1,trips:[],recents:[]});const after=await cloud.inspect();evidence={...evidence,login:true,initialSnapshot:before.state!==null,writeRevision:revision,readRevision:after.revision,emptyReviewSnapshot:after.state.trips.length===0};await cloud.logout();}catch(e){evidence={...evidence,failed:true,code:e.code||'unknown'};}
credential=null;await writeFile('handoff/PLAY_REVIEW_LOGIN_TEST.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));process.exit(evidence.failed?1:0);
