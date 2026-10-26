import{quotation,money,today}from'./core.mjs';
export function wrapText(value,measure,width){const result=[];for(const para of String(value??'').split('\n')){let line='';for(const ch of para){if(line&&measure(line+ch)>width){result.push(line);line=ch;}else line+=ch;}result.push(line);}return result;}
export function reportLines({kind,record:r,site,company}){const lines=['작성 사업장: '+company,'현장: '+(site?.name||'현장 확인 필요'),'주소: '+(site?.address||''),'작성일: '+r.date,''];if(kind==='logs')return[...lines,'작업 인원: '+r.workers+'명','날씨: '+(r.weather||'미기재'),'투입 장비: '+(r.equipment||'미기재'),'','[작업 내용]',r.work,'','[안전 확인]',r.safety,'','[다음 작업]',r.nextWork||'미기재'];const q=quotation(r.items,r.vatRate);return[...lines,'거래처 / 수신인: '+(r.client||'미기재'),'','[항목 / 수량 / 단가 / 금액]',...q.rows.map(i=>i.name+' / '+i.quantity+' / '+money(i.unitPrice)+' / '+money(i.amount)),'','공급가액: '+money(q.supply),'부가세: '+money(q.vat),'합계: '+money(q.total),'',...(r.type==='contract'?['[계약 내용 · 초안]',r.terms,'','본 문서는 전자서명이나 계약 체결을 자동으로 수행하지 않습니다.']:[]),...(r.type==='tax-material'?['본 문서는 계산서 관련 자료이며 세금계산서 발행 내역이 아닙니다.']:[]),'[비고]',r.note||'미기재'];}
export async function buildPdfFromJpegs(lib,jpegs){const pdf=await lib.PDFDocument.create();pdf.setTitle('현장AI365 업무 보고서');pdf.setCreator('현장AI365');for(const data of jpegs){const img=await pdf.embedJpg(data);const p=pdf.addPage([595.28,841.89]);p.drawImage(img,{x:0,y:0,width:595.28,height:841.89});}return pdf.save();}
export async function exportReport(data,download){
 if(!window.PDFLib)throw new Error('PDF 처리 도구를 불러오지 못했습니다. 다시 실행해 주세요.');
 const images=[];let canvas,ctx,y;
 const flush=async()=>{if(!canvas)return;ctx.fillStyle='#64788c';ctx.font='18px "Malgun Gothic",system-ui';ctx.fillText('현장AI365 · 페이지 '+(images.length+1)+' · 생성 '+today(),80,1677);const blob=await new Promise(res=>canvas.toBlob(res,'image/jpeg',.91));if(!blob)throw new Error('PDF 페이지 생성 실패');images.push(await blob.arrayBuffer());canvas.width=1;canvas.height=1;canvas=null;};
 const page=async()=>{await flush();canvas=document.createElement('canvas');canvas.width=1240;canvas.height=1754;ctx=canvas.getContext('2d');if(!ctx)throw new Error('PDF 화면을 만들 수 없습니다.');ctx.fillStyle='#fff';ctx.fillRect(0,0,1240,1754);ctx.fillStyle='#102a43';ctx.font='bold 28px "Malgun Gothic",system-ui';ctx.fillText('현장AI365',80,90);ctx.fillStyle='#f77727';ctx.fillRect(80,116,1080,4);ctx.fillStyle='#102a43';ctx.font='bold 40px "Malgun Gothic",system-ui';ctx.fillText(data.title,80,183);ctx.font='22px "Malgun Gothic",system-ui';ctx.fillStyle='#344b61';y=245;};
 try{
  if(data.kind==='photos'&&data.photos.length>50)throw new Error('사진 보고서는 한 번에 50장 이하로 필터해 주세요.');
  await page();
  if(data.kind==='photos'){
   let count=0;
   for(const p of data.photos){if(!p.blob)continue;count++;if(y+660>1600)await page();ctx.font='bold 24px "Malgun Gothic",system-ui';ctx.fillStyle='#102a43';for(const line of wrapText(p.date+' · '+(data.siteNames[p.siteId]||'현장 확인 필요'),s=>ctx.measureText(s).width,1080)){ctx.fillText(line,80,y);y+=32;}
    const url=URL.createObjectURL(p.blob);try{const img=await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=()=>rej(new Error('사진을 읽지 못했습니다.'));im.src=url;});const scale=Math.min(1080/img.width,510/img.height);ctx.drawImage(img,80+(1080-img.width*scale)/2,y+15,img.width*scale,img.height*scale);}finally{URL.revokeObjectURL(url);}
    y+=555;ctx.font='20px "Malgun Gothic",system-ui';for(const line of wrapText(p.name,s=>ctx.measureText(s).width,1080)){if(y>1560)await page();ctx.fillText(line,80,y);y+=28;}y+=45;
   }
   if(!count)throw new Error('현재 기기에 원본이 있는 사진이 없습니다.');
  }else for(const value of reportLines(data))for(const line of [...wrapText(value,s=>ctx.measureText(s).width,1080),'']){if(y>1575)await page();ctx.fillStyle=line.startsWith('[')?'#102a43':'#344b61';ctx.fillText(line,80,y);y+=34;}
  await flush();const bytes=await buildPdfFromJpegs(window.PDFLib,images);download(new Blob([bytes],{type:'application/pdf'}),data.title+'_'+(data.record?.date||today())+'.pdf');
 }finally{if(canvas){canvas.width=1;canvas.height=1;}}
}
