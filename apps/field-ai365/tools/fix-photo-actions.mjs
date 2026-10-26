import{readFile,writeFile}from'node:fs/promises';
const path='public/app.mjs';let s=await readFile(path,'utf8');
const replacements=[
 ["'<div class=\"metric\"><div class=\"metric-label\">'","'<button type=\"button\" class=\"metric\" data-action=\"route\" data-id=\"'+({site:'sites',logs:'logs',photos:'photos',payments:'payments'}[i])+'\"><div class=\"metric-label\">'"],
 ["s+'</small></div>'","s+'</small></button>'"],
 ["+(r.blob?ib('download','사진 원본 저장','photo-save',r.id):'')","+(r.blob?btn('사진 보기','photo-view',r.id)+btn('원본 저장','photo-save',r.id):'')"],
 ["icons('download')+' 사진 보고서'","icons('download')+' PDF 보고서 저장'"],
 ["else if(a==='photo-save'){", "else if(a==='photo-view'){const p=state.photos.find(p=>p.id===id);if(!p?.blob)throw new Error('이 기기에 사진 원본이 없습니다.');const u=URL.createObjectURL(p.blob);openDialog('사진 보기','<img class=\"photo-preview\" src=\"'+u+'\" alt=\"'+E(p.name)+'\"><p>'+E(siteName(p.siteId))+' · '+E(p.date)+'</p>'+btn('원본 저장','photo-save',p.id));modal.addEventListener('close',()=>URL.revokeObjectURL(u),{once:true});}\n else if(a==='photo-save'){"],
 ["if(a==='privacy'){","if(a==='file-saved'){toast('파일 저장 완료');return;}if(a==='file-failed'){toast('파일 저장 실패 · 저장 위치와 여유 공간을 확인해 주세요.');return;}if(a==='file-cancelled'){toast('파일 저장을 취소했습니다.');return;}\n if(a==='privacy'){"],
 ["function download(blob,name){if(window.NativeBridge){", "function download(blob,name){if(!blob)throw new Error('저장할 원본을 찾지 못했습니다.');toast('파일 준비 중 · 저장 위치를 선택해 주세요.');if(window.NativeBridge){"],
 ["reader.onload=()=>window.NativeBridge.saveFile(name,blob.type,String(reader.result).split(',')[1]);","reader.onload=()=>{try{window.NativeBridge.saveFile(name,blob.type,String(reader.result).split(',')[1]);}catch{toast('파일 저장창을 열지 못했습니다.');}};"],
 ["else if(a==='photo-report'){const rows=", "else if(a==='photo-report'){toast('PDF 생성 중입니다. 잠시 기다려 주세요.');const rows="]
];for(const[from,to]of replacements){if(!s.includes(from))throw new Error('Anchor missing: '+from);s=s.replace(from,to);}await writeFile(path,s);
