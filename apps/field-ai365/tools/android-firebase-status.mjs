import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const auth=require('C:/Users/eorng/AppData/Local/npm-cache/_npx/ba4f1959e38407b5/node_modules/firebase-tools/lib/auth.js');
const account=auth.getGlobalDefaultAccount();
const token=await auth.getAccessToken(account.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform','https://www.googleapis.com/auth/firebase']);
const response=await fetch('https://firebase.googleapis.com/v1beta1/projects/gyeongilwater/androidApps',{headers:{Authorization:'Bearer '+token.access_token}});
if(!response.ok)throw new Error('Android registry HTTP '+response.status);
const result=await response.json();
console.log(JSON.stringify((result.apps||[]).map(a=>({name:a.name,packageName:a.packageName,appId:a.appId})),null,2));
if(process.argv.includes('--register')){
 async function call(path,method='GET',body){const r=await fetch('https://firebase.googleapis.com/v1beta1/'+path,{method,headers:{Authorization:'Bearer '+token.access_token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});if(!r.ok)throw new Error('Firebase registration HTTP '+r.status);return r.json();}
 let app=(result.apps||[]).find(a=>a.packageName==='kr.co.hyeonjang.ai365');
 if(!app){let operation=await call('projects/gyeongilwater/androidApps','POST',{packageName:'kr.co.hyeonjang.ai365',displayName:'현장AI365'});while(!operation.done){await new Promise(r=>setTimeout(r,1500));operation=await call(operation.name);}if(operation.error)throw new Error('Android registration operation failed');app=operation.response;}
 const existing=await call(app.name+'/sha');
 const certs=[['SHA_1','67BA878DF450FFDA4A58C5E2FD5C88CB1EDC4323'],['SHA_256','5BF4A30832B4C3596DBF54C3890FEB7F12F26C4B8EC25A6BF26786996997FF8D']];
 if(process.argv.includes('--release-cert'))certs.push(['SHA_1','1C93307D884ACB5A6FDB3EF6B54C971A5332D921'],['SHA_256','9143F07281C0A9CB68CD64D08F65A2D6B91ED012E41F48116B79ACB033D393CE']);
 for(const [certType,shaHash]of certs){if(!(existing.certificates||[]).some(c=>c.shaHash.replaceAll(':','').toUpperCase()===shaHash))await call(app.name+'/sha','POST',{certType,shaHash});}
 console.log('Android package and debug SHA certificates registered; existing applications unchanged.');
 const config=await call(app.name+'/config');const decoded=JSON.parse(Buffer.from(config.configFileContents,'base64').toString());console.log(JSON.stringify({androidOAuthConfigured:decoded.client?.some(c=>c.oauth_client?.some(o=>o.client_type===1))===true}));
}
