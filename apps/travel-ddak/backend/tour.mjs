export const AREA_CODES=Object.freeze({seoul:1,incheon:2,daejeon:3,daegu:4,gwangju:5,busan:6,ulsan:7,sejong:8,gyeonggi:31,gangwon:32,chungbuk:33,chungnam:34,gyeongbuk:35,gyeongnam:36,jeonbuk:37,jeonnam:38,jeju:39});
const sourceUrl='https://www.data.go.kr/data/15101578/openapi.do';
const clean=value=>String(value??'').replace(/<[^>]*>/g,'').trim().slice(0,400);
const compact=date=>date.replaceAll('-','');
export function overlaps(item,start,end){return /^\d{8}$/.test(item.eventstartdate||'')&&/^\d{8}$/.test(item.eventenddate||'')&&item.eventstartdate<=compact(end)&&item.eventenddate>=compact(start);}
export function publicRecord(item,kind,checkedAt){
 if(!/^\d+$/.test(String(item.contentid||''))||!clean(item.title))return null;
 return {id:String(item.contentid),kind,title:clean(item.title),address:clean(item.addr1),start:kind==='event'?String(item.eventstartdate):null,end:kind==='event'?String(item.eventenddate):null,modifiedAt:clean(item.modifiedtime),checkedAt,timeZone:'Asia/Seoul',source:'한국관광공사 TourAPI',sourceUrl,openingHours:'미확인',reservation:'미확인'};
}
export async function loadOfficialFacts(trip,key,fetcher=fetch){
 if(trip.kind!=='domestic')return {status:'not-covered',records:[],note:'국문 TourAPI는 국내 자료입니다. 해외 공식 관광 정보는 아직 연결되지 않았습니다.'};
 const area=AREA_CODES[trip.parentId];
 if(!area)return {status:'unsupported-area',records:[],note:'공식 지역코드에 대응하는 지역을 선택하세요.'};
 const checkedAt=new Date().toISOString();
 const decoded=/%[a-f\d]{2}/i.test(key)?decodeURIComponent(key):key;
 async function request(operation,parameters){
  const url=new URL(`https://apis.data.go.kr/B551011/KorService2/${operation}`);
  url.search=new URLSearchParams({serviceKey:decoded,MobileOS:'ETC',MobileApp:'TravelDdak',_type:'json',numOfRows:'30',pageNo:'1',areaCode:String(area),...parameters});
  let response;try{response=await fetcher(url,{signal:AbortSignal.timeout(12000)});}catch(error){throw Error('transport-'+String(error.cause?.code||error.name||'unknown').replace(/[^A-Za-z0-9_-]/g,'').slice(0,60));}
  if(!response.ok)throw Error('http-'+response.status);
  let data;try{data=await response.json();}catch{throw Error('provider-non-json');}
  if(!['0000','00'].includes(data.response?.header?.resultCode))throw Error('provider-'+String(data.response?.header?.resultCode||'unknown').replace(/[^A-Za-z0-9_-]/g,'').slice(0,30));
  const raw=data.response?.body?.items?.item;return {items:Array.isArray(raw)?raw:raw?[raw]:[],total:Number(data.response?.body?.totalCount)||0};
 }
 const results=await Promise.allSettled([
  request('searchKeyword2',{keyword:trip.city.replace(/ 전체$/,''),contentTypeId:'12',numOfRows:'3'}),
  request('searchFestival2',{eventStartDate:compact(trip.start),eventEndDate:compact(trip.end)})
 ]);
 const records=[],errorCodes=[];let failures=0,truncated=false;
 results.forEach((result,index)=>{
  if(result.status!=='fulfilled'){failures++;errorCodes.push(/^(transport|http|provider)-[A-Za-z0-9_-]+$/.test(result.reason?.message||'')?result.reason.message:'unknown');return;}
  if(result.value.total>result.value.items.length)truncated=true;
  for(const item of result.value.items){if(index===1&&!overlaps(item,trip.start,trip.end))continue;const record=publicRecord(item,index===0?'place':'event',checkedAt);if(record)records.push(record);}
 });
 return {status:failures===2?'unavailable':failures?'partial':'ok',records:records.slice(0,10),checkedAt,truncated,errorCodes,note:(failures===2?'공식 관광 서비스 연결에 실패했습니다. 조회 결과가 없는 것으로 판단하지 마세요. ':failures?'일부 공식 관광 조회에 실패했습니다. ':'')+'관광지 최대 3건·해당 기간에 시작하는 행사 검색 최대 30건 중 날짜가 겹치는 항목입니다. 이전에 시작한 장기 행사나 검색 범위 밖 정보는 누락될 수 있습니다. 취소·영업·예약은 방문 전 주최기관에 확인하세요.'};
}
