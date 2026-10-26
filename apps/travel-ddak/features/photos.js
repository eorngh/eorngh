import {parse} from 'exifr';
import {esc} from '../dist/core.js';

export async function makeAlbum(files, trip) {
 if(!files.length||files.length>20)throw Error('한 번에 사진 1~20장을 선택하세요.');
 const photos=[];
 for(const file of files){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>15_000_000)throw Error('15MB 이하 JPG·PNG·WebP 사진만 선택하세요. HEIC는 JPG로 변환해 주세요.');
  let taken='촬영일 없음';
  try{const metadata=await parse(file,{pick:['DateTimeOriginal'],reviveValues:false});const raw=String(metadata?.DateTimeOriginal||'');if(/^\d{4}:\d{2}:\d{2}/.test(raw))taken=raw.slice(0,10).replaceAll(':','-');}catch{/* Photos without EXIF remain in an explicit undated group. */}
  const bitmap=await createImageBitmap(file);
  try{
   if(bitmap.width*bitmap.height>40_000_000)throw Error('4천만 화소 이하 사진을 선택하세요.');
   const scale=Math.min(1,1200/Math.max(bitmap.width,bitmap.height));
   const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
   canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
   photos.push({name:file.name,taken,data:canvas.toDataURL('image/jpeg',0.82)});
  }finally{bitmap.close();}
 }
 photos.sort((a,b)=>a.taken.localeCompare(b.taken));
 const cards=photos.map(p=>'<figure><img src="'+p.data+'" alt="'+esc(p.name)+'"><figcaption>'+esc(p.taken)+' · '+esc(p.name)+(p.taken!=='촬영일 없음'&&(p.taken<trip.start||p.taken>trip.end)?' · 여행 기간 밖':'')+'</figcaption></figure>').join('');
 const style='body{max-width:960px;margin:24px auto;padding:16px;font:16px/1.6 system-ui;color:#173052}figure{margin:12px 0}img{width:100%;max-height:600px;object-fit:contain;border-radius:16px}figcaption{overflow-wrap:anywhere}';
 return {count:photos.length,preview:cards,html:'<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(trip.city)+' 여행 앨범</title><style>'+style+'</style><h1>'+esc(trip.city)+' 여행 앨범</h1><p>'+trip.start+' ~ '+trip.end+'</p><p>선택한 사진만 기기에서 처리한 사본입니다. 촬영일은 사진의 EXIF 기준이며 현지 시간대를 확인한 결과는 아닙니다. 위치·기타 EXIF는 내보내지 않습니다.</p>'+cards+'</html>'};
}
