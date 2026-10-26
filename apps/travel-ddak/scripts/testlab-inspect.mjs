import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const root='C:/Users/eorng/AppData/Local/npm-cache/_npx/735f5eb4e60f1e66/node_modules/firebase-tools';
const require=createRequire(root+'/package.json'),auth=require(root+'/lib/auth.js'),{requireAuth}=require(root+'/lib/requireAuth.js'),{Client}=require(root+'/lib/apiv2.js');
const account=auth.getGlobalDefaultAccount();await requireAuth({project:'ddakmodum',nonInteractive:true,...account});
const client=new Client({urlPrefix:'https://testing.googleapis.com',apiVersion:'v1'});
const response=await client.get('/testEnvironmentCatalog/ANDROID',{queryParams:{projectId:'ddakmodum'},resolveOnHTTPError:true});
await writeFile('artifacts/TESTLAB_CATALOG.json',JSON.stringify({status:response.status,body:response.body},null,2));
console.log(JSON.stringify({status:response.status,error:response.body?.error?.message,models:response.body?.androidDeviceCatalog?.models?.length}));
