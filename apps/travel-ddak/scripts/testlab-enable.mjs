import {createRequire} from 'node:module';
const root='C:/Users/eorng/AppData/Local/npm-cache/_npx/735f5eb4e60f1e66/node_modules/firebase-tools',require=createRequire(root+'/package.json');
const auth=require(root+'/lib/auth.js'),{requireAuth}=require(root+'/lib/requireAuth.js'),{Client}=require(root+'/lib/apiv2.js');await requireAuth({project:'ddakmodum',nonInteractive:true,...auth.getGlobalDefaultAccount()});
const c=new Client({urlPrefix:'https://serviceusage.googleapis.com',apiVersion:'v1'});
for(const api of ['toolresults.googleapis.com','testing.googleapis.com']){const r=await c.post('/projects/ddakmodum/services/'+api+':enable',{},{resolveOnHTTPError:true});console.log(JSON.stringify({api,status:r.status,operation:r.body?.name,error:r.body?.error?.message}));}
