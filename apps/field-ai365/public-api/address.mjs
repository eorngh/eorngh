// Server-only adapter. Never return the approval key or the upstream request URL.
const endpoint='https://business.juso.go.kr/addrlink/addrLinkApi.do';
const source={name:'행정안전부 주소기반산업지원서비스',url:'https://business.juso.go.kr/'};
export function createAddressSearch({key='',fetcher=globalThis.fetch,now=Date.now}={}){
  const cache=new Map(),pending=new Map();
  let windowStart=now(),requests=0;
  const blocked=()=>({status:'BLOCKED',message:'공공 주소 검색이 연결되지 않았습니다. 주소를 직접 입력해 계속할 수 있습니다.',items:[]});
  return async function search(input){
    const keyword=String(input??'').trim().replace(/\s+/g,' ');
    if(keyword.length<2||keyword.length>100)return {status:'INVALID',message:'주소 검색어를 2~100자로 입력해 주세요.',items:[]};
    if(!key.trim())return blocked();
    const cached=cache.get(keyword);
    if(cached&&now()-cached.time<300000)return structuredClone({...cached.value,cached:true});
    if(pending.has(keyword))return structuredClone(await pending.get(keyword));
    if(now()-windowStart>=60000){windowStart=now();requests=0;}
    if(requests>=60)return {status:'LIMITED',message:'공공 주소 조회가 많습니다. 잠시 후 다시 검색하거나 직접 입력해 주세요.',items:[]};
    requests++;
    const task=(async()=>{
      try{
        const url=new URL(endpoint);
        Object.entries({confmKey:key,currentPage:1,countPerPage:10,keyword,resultType:'json'}).forEach(([k,v])=>url.searchParams.set(k,v));
        const response=await fetcher(url,{signal:AbortSignal.timeout(10000),redirect:'error'});
        const data=(await response.json()).results;
        if(!response.ok||data?.common?.errorCode!=='0'||(data.juso!==undefined&&!Array.isArray(data.juso)))throw Error('Invalid public response');
        const checkedAt=new Date(now()).toISOString();
        const items=(data.juso||[]).slice(0,10).map(row=>{
          if(typeof row.roadAddr!=='string'||!row.roadAddr.trim())throw Error('Invalid address row');
          const text=value=>typeof value==='string'?value.slice(0,500):'';
          return {roadAddress:text(row.roadAddr),parcelAddress:text(row.jibunAddr),sido:text(row.siNm),sigungu:text(row.sggNm),legalDong:text(row.emdNm),adminDong:text(row.hemdNm),addressSource:{...source,checkedAt}};
        });
        const value={status:'LIVE',message:'공공 주소 검색 결과',source:{...source,checkedAt},items};
        cache.delete(keyword);cache.set(keyword,{time:now(),value});
        if(cache.size>100)cache.delete(cache.keys().next().value);
        return value;
      }catch{return {status:'ERROR',message:'공공 주소를 확인하지 못했습니다. 잠시 후 다시 검색하거나 직접 입력해 주세요.',items:[]};}
    })();
    pending.set(keyword,task);
    try{return structuredClone(await task);}finally{pending.delete(keyword);}
  };
}
