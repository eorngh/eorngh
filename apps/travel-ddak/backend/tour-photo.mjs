export function publicPhoto(item,checkedAt){
 let url;try{url=new URL(item.galWebImageUrl);}catch{return null;}
 if(url.protocol!=='https:'||url.hostname!=='tong.visitkorea.or.kr'||!item.galPhotographer||!/^\d+$/.test(String(item.galContentId||'')))return null;
 const text=v=>String(v||'').replace(/<[^>]*>/g,'').slice(0,300);
 return {id:String(item.galContentId),title:text(item.galTitle),location:text(item.galPhotographyLocation),photographer:text(item.galPhotographer),imageUrl:url.href,source:'한국관광공사 포토코리아',sourceUrl:'https://www.data.go.kr/data/15101914/openapi.do',license:'공공누리 제1유형 · 출처표시',checkedAt};
}
export async function loadOfficialPhotos(trip,key,fetcher=fetch){
 if(trip.kind!=='domestic')return [];
 const decoded=/%[a-f\d]{2}/i.test(key)?decodeURIComponent(key):key;
 const url=new URL('https://apis.data.go.kr/B551011/PhotoGalleryService1/gallerySearchList1');
 url.search=new URLSearchParams({serviceKey:decoded,MobileOS:'ETC',MobileApp:'TravelDdak',_type:'json',numOfRows:'3',pageNo:'1',arrange:'A',keyword:trip.city.replace(/ 전체$/,'')});
 const response=await fetcher(url,{signal:AbortSignal.timeout(7000)});if(!response.ok)return [];
 const data=await response.json();if(!['0000','00'].includes(data.response?.header?.resultCode))return [];
 const raw=data.response?.body?.items?.item,items=Array.isArray(raw)?raw:raw?[raw]:[];
 return items.map(item=>publicPhoto(item,new Date().toISOString())).filter(Boolean).filter(p=>(p.title+' '+p.location).includes(trip.city.replace(/ 전체$/,''))).slice(0,1);
}
