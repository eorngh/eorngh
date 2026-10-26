import {escapeHtml as E} from './core.mjs';
import {createSite,coordinateText} from './site-master.mjs';
import {AddressProvider} from './providers.mjs';
import {createMapProvider} from './kakao-map.mjs';
const input=(label,name,value='',type='text',extra='')=>`<label class="field">${label}<input name="${name}" value="${E(value)}" type="${type}" ${extra}></label>`;
export const registrationDraftKey=repo=>'hj365-registration-draft:'+repo.name;
export function readRegistrationDraft(storage,repo){
  try{
    const scoped=storage.getItem(registrationDraftKey(repo));
    // The old unscoped draft has no owner: preserve it for device-only use.
    const raw=scoped??(repo.uid==='local'&&repo.project==='device'?storage.getItem('hj365-registration-draft'):null);
    const value=JSON.parse(raw||'{}');
    return value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  }catch{return {};}
}
export function startRegistration({modal,repo,onSaved,clients=[]}){
  let storage;try{storage=localStorage;}catch{}
  const draftKey=registrationDraftKey(repo),draft=readRegistrationDraft(storage,repo);
  let step=0,rows=[],saving=false;
  const lifecycle=new AbortController();
  modal.addEventListener('cancel',e=>{if(saving)e.preventDefault();},{signal:lifecycle.signal});
  modal.addEventListener('close',()=>lifecycle.abort(),{once:true});
  const saveDraft=()=>{
    try{
      storage.setItem(draftKey,JSON.stringify(draft));
      if(repo.uid==='local'&&repo.project==='device')storage.removeItem('hj365-registration-draft');
    }catch{
      const status=modal.querySelector('.subheading');
      if(status)status.textContent='초안 저장 불가 · 입력은 현재 화면에 유지됩니다. 현장 저장 전 화면을 닫지 마세요.';
    }
  };
  const draw=()=>{
    if(lifecycle.signal.aborted)return;
    const pages=[input('도로명·지번 주소','roadAddress',draft.roadAddress||'','text','required maxlength="300"')+'<button type="button" class="btn" id="address-search">주소 검색</button><div id="address-results" role="status"></div>',input('위도 · 선택','latitude',draft.latitude??'','number','step="any" min="-90" max="90"')+input('경도 · 선택','longitude',draft.longitude??'','number','step="any" min="-180" max="180"')+'<button type="button" class="btn" id="registration-gps">현재 위치 사용</button><div id="registration-map"></div><p>주소와 위치가 일치하는지 확인하세요. 위치권한을 거절해도 계속할 수 있습니다.</p>',input('현장명','name',draft.name||'','text','required maxlength="120"')+input('업종','industry',draft.industry||'건설업','text','required')+input('공사 종류','workType',draft.workType||'','text','required'),input('시작일 · 선택','startDate',draft.startDate||'','date')+input('종료일 · 선택','endDate',draft.endDate||'','date')+input('계약금액 · 원','contractAmount',draft.contractAmount||0,'number','min="0" max="1000000000000" required')+`<label class="field">거래처<select name="clientId"><option value="">선택 안 함</option>${clients.map(c=>`<option value="${E(c.id)}" ${c.id===draft.clientId?'selected':''}>${E(c.name)}</option>`).join('')}</select></label>`+input('담당자 · 선택','manager',draft.manager||''),`<div class="notice"><strong>${E(draft.name)}</strong><p>${E(draft.roadAddress)}</p><p>${E(draft.industry)} · ${E(draft.workType)}</p><p>${E(coordinateText({...draft,latitude:draft.latitude===''?null:Number(draft.latitude),longitude:draft.longitude===''?null:Number(draft.longitude)}))}</p><p>일보·사진·문서·정산은 생성된 현장 ID로 연결됩니다.</p></div><label class="check"><input type="checkbox" name="confirmed" required>입력 정보와 위치를 확인했습니다.</label>`];
    modal.innerHTML=`<div class="modal-head"><h2 id="modal-title">AI 현장등록</h2><button type="button" class="btn" id="registration-close">닫기</button></div><form id="registration-form"><div class="modal-body"><p class="subheading">기기에서 순서대로 안내합니다 · 초안 자동 저장</p><ol class="registration-steps">${['주소','위치','공사','일정','확인'].map((s,i)=>`<li ${i===step?'aria-current="step"':''}>${s}</li>`).join('')}</ol>${pages[step]}<p id="registration-error" role="alert"></p></div><div class="modal-footer"><button type="button" class="btn" id="registration-back">이전</button><button type="submit" class="btn primary">${step===4?'확인하고 현장 생성':'다음'}</button></div></form>`;
    modal.querySelector('#registration-close').onclick=()=>{if(!saving)modal.close();};modal.querySelector('#registration-back').disabled=step===0;
    modal.querySelector('#registration-back').onclick=()=>{Object.assign(draft,Object.fromEntries(new FormData(modal.querySelector('form'))));saveDraft();step--;draw();};
    modal.querySelector('form').oninput=e=>{if(e.target.name!=='confirmed'){if(e.target.name==='roadAddress'&&draft.roadAddress!==e.target.value)for(const key of ['addressSource','parcelAddress','sido','sigungu','legalDong','adminDong'])delete draft[key];draft[e.target.name]=e.target.value;saveDraft();}};
    modal.querySelector('form').onsubmit=async e=>{
      e.preventDefault();if(saving)return;
      Object.assign(draft,Object.fromEntries(new FormData(e.target)));saveDraft();
      if(step<4){step++;draw();return;}
      const controls=[...modal.querySelectorAll('input,select,button')].map(el=>[el,el.disabled]);
      saving=true;controls.forEach(([el])=>el.disabled=true);
      try{
        const site=createSite(draft,draft.confirmed==='on');
        await repo.put('sites',site);
        try{storage.removeItem(draftKey);}catch{}
        modal.close();await onSaved(site);
      }catch(err){modal.querySelector('#registration-error').textContent=err.message;}
      finally{saving=false;controls.forEach(([el,disabled])=>el.disabled=disabled);}
    };
    const search=modal.querySelector('#address-search');if(search)search.onclick=async()=>{const target=modal.querySelector('#address-results');search.disabled=true;target.textContent='주소 검색 중';try{const result=await new AddressProvider().search(modal.querySelector('[name=roadAddress]').value);rows=result.items;target.innerHTML=`<p>${E(result.status==='MOCK'?'샘플 주소 · 실제 검색 API 미설정':result.message||'검색 결과')}</p>`+rows.map((r,i)=>`<button type="button" class="btn address-result" data-address="${i}">${E(r.roadAddress)}<br>${E(r.parcelAddress)}</button>`).join('');target.querySelectorAll('[data-address]').forEach(b=>b.onclick=()=>{Object.assign(draft,rows[Number(b.dataset.address)]);modal.querySelector('[name=roadAddress]').value=draft.roadAddress;saveDraft();});}catch{target.textContent='주소 검색 실패 · 직접 입력으로 계속할 수 있습니다.';}finally{search.disabled=false;}};
    const gps=modal.querySelector('#registration-gps');if(gps)gps.onclick=()=>{
      const error=modal.querySelector('#registration-error');error.textContent='현재 위치 확인 중';gps.disabled=true;
      if(!navigator.geolocation){error.textContent='이 기기에서는 위치를 직접 입력해 주세요.';gps.disabled=false;return;}
      navigator.geolocation.getCurrentPosition(p=>{draft.latitude=p.coords.latitude;draft.longitude=p.coords.longitude;saveDraft();draw();},()=>{if(error.isConnected){error.textContent='위치권한 또는 GPS 확인 필요 · 좌표를 직접 입력할 수 있습니다.';gps.disabled=false;}},{timeout:20000});
    };
    if(step===1){let settings={};try{settings=JSON.parse(localStorage.getItem('hj365-map-local')||'{}');}catch{}createMapProvider(settings).render(modal.querySelector('#registration-map'),{onSelect:p=>{Object.assign(draft,p);saveDraft();draw();}}).catch(err=>{const t=modal.querySelector('#registration-map');if(t)t.textContent=err.message;});}
  };draw();modal.showModal();
}
export function mapPage(sites){return `<div class="page-heading"><div><h1>현장 지도</h1><p>주소·좌표로 현장을 연결합니다</p></div></div><div class="actions"><button class="btn" data-action="map-settings">지도 연결 설정</button><button class="btn" data-action="map-style">일반 / 위성 전환</button><button class="btn" data-action="map-gps">현재 위치</button></div><section class="panel"><div id="site-map" role="region" aria-label="현장 지도">지도 준비 중</div><div id="map-summary" role="status"></div></section><section class="panel"><h2>등록 현장</h2>${sites.map(s=>`<div class="row-card"><div class="row-main"><strong>${E(s.name)}</strong><p>${E(s.address)}</p><p>${E(coordinateText(s))}</p></div><button class="btn" data-action="detail" data-id="${E(s.id)}">현장 보기</button><button class="btn" data-action="copy-coordinates" data-id="${E(s.id)}">좌표 복사</button></div>`).join('')||'<p>AI 현장등록으로 첫 현장을 만들어 보세요.</p>'}</section>`;}
export function mountMap(sites,{satellite=false,center}={}){const container=document.querySelector('#site-map');if(!container)return;let settings={};try{settings=JSON.parse(localStorage.getItem('hj365-map-local')||'{}');}catch{}return createMapProvider(settings).render(container,{sites,satellite,center:center||sites.find(s=>s.latitude!=null&&s.longitude!=null),onSite:s=>{document.querySelector('#map-summary').textContent=s.name+' · '+s.address+' · '+coordinateText(s);},onSelect:p=>{document.querySelector('#map-summary').textContent=coordinateText(p);}}).catch(err=>{container.textContent=err.message;});}
