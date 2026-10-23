import {createRequire} from 'node:module';import {writeFile} from 'node:fs/promises';
const root='C:/Users/eorng/AppData/Local/npm-cache/_npx/735f5eb4e60f1e66/node_modules/firebase-tools',require=createRequire(root+'/package.json');
const auth=require(root+'/lib/auth.js'),{requireAuth}=require(root+'/lib/requireAuth.js'),{Client}=require(root+'/lib/apiv2.js');await requireAuth({project:'ddakmodum',nonInteractive:true,...auth.getGlobalDefaultAccount()});
const tr=new Client({urlPrefix:'https://www.googleapis.com/toolresults',apiVersion:'v1beta3'});const r=await tr.post('/projects/ddakmodum:initializeSettings',{},{headers:{'x-goog-user-project':'ddakmodum'},resolveOnHTTPError:true});console.log(JSON.stringify({status:r.status,body:r.body}));await writeFile('artifacts/TESTLAB_SETTINGS.json',JSON.stringify(r.body,null,2));

