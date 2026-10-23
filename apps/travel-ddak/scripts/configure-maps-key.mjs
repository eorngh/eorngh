import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url),root=process.argv[2];
const auth=require(root+'/lib/auth.js'),{requireAuth}=require(root+'/lib/requireAuth.js'),{Client}=require(root+'/lib/apiv2.js');
await requireAuth({project:'ddakmodum',nonInteractive:true,...auth.getGlobalDefaultAccount()});
const metadata=JSON.parse(await readFile('handoff/GOOGLE_MAPS_KEY_METADATA.json','utf8'));
const client=new Client({urlPrefix:'https://apikeys.googleapis.com',apiVersion:'v2'});
const before=(await client.get('/'+metadata.name)).body;
await writeFile('artifacts/maps-key-restrictions-before.json',JSON.stringify({name:before.name,restrictions:before.restrictions,etag:before.etag},null,2));
const restrictions={apiTargets:[{service:'maps-embed-backend.googleapis.com'}],browserKeyRestrictions:{allowedReferrers:['https://travel-ddak-mj-20261015.ablecrab2.chatgpt.site/*','http://127.0.0.1:4173/*','https://localhost/*']}};
const operation=(await client.patch('/'+metadata.name,{name:metadata.name,etag:before.etag,restrictions},{queryParams:{updateMask:'restrictions'}})).body;
let state=operation;
for(let i=0;!state.done&&i<20;i++){await new Promise(r=>setTimeout(r,1000));state=(await client.get('/'+operation.name)).body;}
if(!state.done||state.error)throw Error('Restriction update not confirmed');
const after=(await client.get('/'+metadata.name)).body;
await writeFile('handoff/GOOGLE_MAPS_KEY_RESTRICTIONS.json',JSON.stringify({checkedAt:new Date().toISOString(),name:after.name,restrictions:after.restrictions},null,2));
const serviceClient=new Client({urlPrefix:'https://serviceusage.googleapis.com',apiVersion:'v1'});
const project=metadata.name.split('/')[1],service=`projects/${project}/services/maps-embed-backend.googleapis.com`;
const current=(await serviceClient.get('/'+service)).body;
if(current.state!=='ENABLED'){
 const enabled=(await serviceClient.post('/'+service+':enable',{})).body;let status=enabled;
 for(let i=0;!status.done&&i<20;i++){await new Promise(r=>setTimeout(r,1000));status=(await serviceClient.get('/'+enabled.name)).body;}
 if(!status.done||status.error)throw Error('Embed service enable not confirmed');
}
console.log(JSON.stringify({restrictionsVerified:true,allowedService:'maps-embed-backend.googleapis.com',serviceState:(await serviceClient.get('/'+service)).body.state}));
