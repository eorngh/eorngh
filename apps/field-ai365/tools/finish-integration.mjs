import{readFile,writeFile}from'node:fs/promises';
let path='public/app.mjs',s=await readFile(path,'utf8');
s=s.replace("const I={home:","const I={maps:'M12 22s8-8 8-13a8 8 0 1 0-16 0c0 5 8 13 8 13M15 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0',home:");
s=s.replace("if(c==='photos'){html=siteSelect(sid)","if(c==='photos'){html='<label class=\"field\">공종 / 분류<select name=\"category\"><option>기타</option><option>굴착</option><option>설비</option><option>전기</option><option>마감</option></select></label><label class=\"field\">작업 단계<select name=\"stage\"><option>전</option><option>중</option><option>후</option></select></label>'+area('사진 메모','note','','maxlength=\"2000\"')+siteSelect(sid)");
s=s.replace("name:file.name,mime:file.type,blob:file,","name:file.name,mime:file.type,blob:file,selectedAt:new Date().toISOString(),fileModifiedAt:file.lastModified?new Date(file.lastModified).toISOString():null,category:f.get('category'),stage:f.get('stage'),note:f.get('note'),");
await writeFile(path,s);
path='public/providers.mjs';s=await readFile(path,'utf8');s=s.replace("async search(keyword){if(keyword.trim()", "async search(keyword){if(globalThis.location?.hostname==='appassets.androidplatform.net')return {status:'MOCK',items:[{roadAddress:'서울특별시 세종대로 110',parcelAddress:'서울특별시 중구 태평로1가 31',latitude:37.5665,longitude:126.978,sample:true}]};if(keyword.trim()");await writeFile(path,s);
