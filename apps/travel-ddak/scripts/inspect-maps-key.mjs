import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const root=process.argv[2];if(!root)throw Error('Pass firebase-tools installation directory.');
const auth=require(root+'/lib/auth.js');
const {requireAuth}=require(root+'/lib/requireAuth.js');
const {Client}=require(root+'/lib/apiv2.js');
let key='';for await(const chunk of process.stdin)key+=chunk;key=key.trim();
let result;
try{
 const account=auth.getGlobalDefaultAccount();if(!account)throw Error('No existing CLI account');
 await requireAuth({project:'ddakmodum',nonInteractive:true,...account});
 const client=new Client({urlPrefix:'https://apikeys.googleapis.com',apiVersion:'v2'});
 const lookup=await client.get('/keys:lookupKey',{queryParams:{keyString:key},skipLog:{queryParams:true},resolveOnHTTPError:true});
 if(lookup.status!==200){result={checkedAt:new Date().toISOString(),lookupStatus:lookup.status};}
 else {
  const metadata=await client.get('/'+lookup.body.name,{resolveOnHTTPError:true});
  result={checkedAt:new Date().toISOString(),lookupStatus:lookup.status,metadataStatus:metadata.status,name:lookup.body.name,displayName:metadata.body.displayName,restrictions:metadata.body.restrictions||{}};
 }
}catch{result={checkedAt:new Date().toISOString(),inspectionFailed:true};}
key='';await writeFile('handoff/GOOGLE_MAPS_KEY_METADATA.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
