export class ProviderBlocked extends Error {constructor(message){super(message);this.status='BLOCKED';}}
export class MapProvider {async render(){throw new ProviderBlocked('지도 공급자가 설정되지 않았습니다.');} destroy(){}}
export function mapRequestError(code){
 if([401,498,499].includes(Number(code)))return new Error('지도 인증 실패 ('+code+') · 키 만료·키 종류·허용 도메인을 확인해 주세요.');
 if(Number(code)===403)return new Error('지도 접근 거절 (403) · 지도 서비스 권한과 허용 도메인을 확인해 주세요.');
 if(Number(code)===429)return new Error('지도 사용량 제한 (429) · 자동 재시도하지 않습니다.');
 return new Error('지도 서비스 응답 오류 ('+(Number(code)||'응답 형식')+') · 다른 업무와 좌표 입력은 가능합니다.');
}
export function staticMapRequest({key,longitude,latitude,zoom,width,height,satellite}){
 return {url:new URL('https://static-maps-api.arcgis.com/arcgis/rest/services/static-maps-service/v1/static-maps/arcgis/'+(satellite?'imagery':'streets')+'/with-overlay'),options:{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify({image:{width,height,format:'png',attribution:'auto',padding:[0,0,0,0]},map:{center:{x:longitude,y:latitude,spatialReference:{wkid:4326}},zoom}})}};
}
export class ArcGISProvider extends MapProvider {
  constructor({key='',fetcher=fetch}={}){super();this.key=key;this.fetcher=fetcher===globalThis.fetch?fetcher.bind(globalThis):fetcher;}
  async render(container,{center={latitude:37.5665,longitude:126.978},sites=[],satellite=false,onSelect=()=>{},onSite=()=>{}}={}){
    if(!this.key)throw new ProviderBlocked('ArcGIS 키 미설정 · 좌표 직접 입력은 가능합니다.');
    this.destroy();let lat=center.latitude,lon=center.longitude,zoom=14;
    const draw=async()=>{
      const width=Math.min(1000,Math.max(250,container.clientWidth)),height=360;
      const scale=156543.03392*Math.cos(lat*Math.PI/180)/2**zoom;
      const dx=scale*width/2,dy=scale*height/2,r=6378137;
      const x=r*lon*Math.PI/180,y=r*Math.log(Math.tan(Math.PI/4+lat*Math.PI/360));
      const request=staticMapRequest({key:this.key,longitude:lon,latitude:lat,zoom,width,height,satellite});
      let response;try{response=await this.fetcher(request.url,{...request.options,signal:AbortSignal.timeout(12000)});}catch{throw new Error('지도 네트워크 연결 실패 · 인터넷·도메인 제한을 확인해 주세요.');}if(!response.ok)throw mapRequestError(response.status);
      const blob=await response.blob();if(!blob.type.startsWith('image/')){let body={};try{body=JSON.parse(await blob.text());}catch{}throw mapRequestError(body.error?.code);}
      if(this.imageUrl)URL.revokeObjectURL(this.imageUrl);this.imageUrl=URL.createObjectURL(blob);
      container.replaceChildren();const canvas=document.createElement('div');canvas.className='map-canvas';canvas.style.height=height+'px';
      const img=document.createElement('img');img.src=this.imageUrl;img.alt=satellite?'ArcGIS 위성지도':'ArcGIS 일반지도';canvas.append(img);
      const unproject=(px,py)=>({longitude:(x-dx+px*scale)/r*180/Math.PI,latitude:(2*Math.atan(Math.exp((y+dy-py*scale)/r))-Math.PI/2)*180/Math.PI});
      canvas.onclick=e=>{const b=canvas.getBoundingClientRect();onSelect(unproject((e.clientX-b.left)*width/b.width,(e.clientY-b.top)*height/b.height));};
      for(const s of sites.filter(s=>s.latitude!=null&&s.longitude!=null)){
        const sx=r*s.longitude*Math.PI/180,sy=r*Math.log(Math.tan(Math.PI/4+s.latitude*Math.PI/360)),px=(sx-x+dx)/scale,py=(y+dy-sy)/scale;
        if(px<0||px>width||py<0||py>height)continue;const marker=document.createElement('button');marker.className='map-marker';marker.textContent='●';marker.ariaLabel=s.name;marker.style.left=px/width*100+'%';marker.style.top=py/height*100+'%';marker.onclick=e=>{e.stopPropagation();onSite(s);};canvas.append(marker);
      }
      container.append(canvas);const controls=document.createElement('div');controls.className='actions';
      for(const [label,delta]of [['확대',1],['축소',-1]]){const b=document.createElement('button');b.className='btn';b.textContent=label;b.onclick=()=>{zoom=Math.max(3,Math.min(19,zoom+delta));draw().catch(showError);};controls.append(b);}
      const attribution=document.createElement('small');attribution.textContent=satellite?'Esri, Maxar, Earthstar Geographics · Powered by Esri':'Esri, HERE, Garmin, USGS · Powered by Esri';controls.append(attribution);container.append(controls);
    };const showError=error=>{container.textContent=error.message;};await draw();
  }
  destroy(){if(this.imageUrl)URL.revokeObjectURL(this.imageUrl);this.imageUrl=null;}
}
export class AddressProvider {
  constructor({fetcher=fetch}={}){this.fetcher=fetcher===globalThis.fetch?fetcher.bind(globalThis):fetcher;}
  async search(keyword){if(globalThis.location?.hostname==='appassets.androidplatform.net')return {status:'BLOCKED',message:'공공 주소 검색 서버 연결 전입니다. 주소를 직접 입력해 주세요.',items:[]};if(keyword.trim().length<2)throw new Error('주소를 두 글자 이상 입력해 주세요.');const r=await this.fetcher('/api/address?keyword='+encodeURIComponent(keyword),{signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error('주소검색 연결 실패');return r.json();}
  async coordinates(address){throw new ProviderBlocked('좌표 API 승인키/변환 연계 미설정 · 지도 또는 좌표 입력으로 확인하세요.');}
}
export class PublicDataProvider {
  constructor({loader=null,ttl=3600000}={}){this.loader=loader;this.ttl=ttl;this.cache=new Map();}
  async query(key){const old=this.cache.get(key);if(old&&Date.now()-old.time<this.ttl)return old.value;if(!this.loader)return {status:'BLOCKED',items:[],message:'공공데이터 데이터셋·이용조건·설정 확인 필요'};try{const value=await Promise.race([this.loader(key),new Promise((_,reject)=>setTimeout(()=>reject(new Error('timeout')),10000))]);this.cache.set(key,{time:Date.now(),value});return value;}catch{return {status:'ERROR',items:[]};}}
}
