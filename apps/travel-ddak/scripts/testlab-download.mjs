import {createRequire} from 'node:module';import {readFile,writeFile,mkdir} from 'node:fs/promises';
const root='C:/Users/eorng/AppData/Local/npm-cache/_npx/735f5eb4e60f1e66/node_modules/firebase-tools',require=createRequire(root+'/package.json');const auth=require(root+'/lib/auth.js'),{requireAuth}=require(root+'/lib/requireAuth.js');const account=auth.getGlobalDefaultAccount();await requireAuth({project:'ddakmodum',nonInteractive:true,...account});const token=await auth.getAccessToken(account.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform']);
const files=JSON.parse(await readFile('artifacts/TESTLAB_ARTIFACTS.json','utf8')).items,base='artifacts/testlab-20261017';await mkdir(base,{recursive:true});
for(const model of ['SmallPhone.arm-34-ko-portrait','MediumPhone.arm-36-ko-portrait','dm1q-35-ko-portrait']){
 const selected=files.filter(x=>x.name.includes('/'+model+'/')&&(/\/(actions.json|crawlscript.json|logcat)$/.test(x.name)||/\/artifacts\/(0.png|output\/sitemap.png)$/.test(x.name)));
 for(const item of selected){const r=await fetch('https://storage.googleapis.com/storage/v1/b/'+item.bucket+'/o/'+encodeURIComponent(item.name)+'?alt=media',{headers:{Authorization:'Bearer '+token.access_token,'x-goog-user-project':'ddakmodum'}});if(!r.ok)throw Error('HTTP '+r.status);const suffix=item.name.split('/'+model+'/')[1].replaceAll('/','_');await writeFile(base+'/'+model+'_'+suffix,Buffer.from(await r.arrayBuffer()));}
 console.log(model+': '+selected.length+' artifacts downloaded');
}
