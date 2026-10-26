import {publicApiOrigin} from '../public/public-api-config.mjs';
import{cp,mkdir,readdir,readFile,stat,writeFile,rm}from'node:fs/promises';import{resolve,dirname}from'node:path';import{fileURLToPath}from'node:url';import{spawnSync}from'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
async function scan(dir){for(const n of await readdir(dir)){const p=resolve(dir,n);if((await stat(p)).isDirectory()){await scan(p);continue;}if(/\.(mjs|js)$/.test(n)&&!p.includes('/vendor/')){const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});if(r.status!==0)throw new Error('구문 검사 실패: '+n);}const b=await readFile(p);if(/sk-(?:proj-)?[A-Za-z0-9_-]{30,}/.test(b.toString()))throw new Error('공개 파일에 비밀 키가 포함되어 있습니다.');}}
await scan(resolve(root,'public'));await mkdir(resolve(root,'android/app/src/main/assets/web'),{recursive:true});await cp(resolve(root,'public'),resolve(root,'android/app/src/main/assets/web'),{recursive:true});console.log('PASS: 웹 구문 검사 · 공개 자산 비밀 키 검사 · Android 자산 복사');

try{await cp(resolve(root,'.local/firebase-runtime.json'),resolve(root,'android/app/src/main/assets/_firebase-runtime.json'));console.log('Local Firebase runtime settings injected (not source ZIP).');}catch{}

// A missing setting must remove the previous build's endpoint, never retain it.
const publicApiTarget=resolve(root,'android/app/src/main/assets/_public-api-runtime.json');
await rm(publicApiTarget,{force:true});
let publicApiRaw;
try{publicApiRaw=await readFile(resolve(root,'.local/public-api-runtime.json'),'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
if(publicApiRaw!==undefined){
 const config=JSON.parse(publicApiRaw);
 const origin=publicApiOrigin(config.origin);
 if(Object.keys(config).some(key=>key!=='origin'))throw Error('공공 API 설정에는 검증된 서버 origin만 허용됩니다.');
 await writeFile(publicApiTarget,JSON.stringify({origin})+'\n');
 console.log('Public API HTTPS origin included; approval key remains server-only.');
}else console.log('Public API origin not configured: Android address search remains unavailable.');
