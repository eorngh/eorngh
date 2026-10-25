from playwright.sync_api import sync_playwright
from pathlib import Path
import json
import os
root=Path(__file__).resolve().parents[1]
out=root/'evidence'/'integration-ui'
out.mkdir(parents=True,exist_ok=True)
results=[]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=os.environ.get('FIELD365_CHROMIUM'))
    context=browser.new_context(viewport={'width':390,'height':844})
    page=context.new_page()
    errors=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.goto('http://127.0.0.1:3650')
    page.get_by_role('button',name='AI 현장등록',exact=True).click()
    page.get_by_label('도로명·지번 주소').fill('서울특별시 세종대로 110')
    page.get_by_role('button',name='다음',exact=True).click()
    page.get_by_label('위도 · 선택').fill('37.5665')
    page.get_by_label('경도 · 선택').fill('126.978')
    page.get_by_role('button',name='다음',exact=True).click()
    page.get_by_label('현장명',exact=True).fill('통합 검증 현장')
    page.get_by_label('공사 종류').fill('설비 공사')
    page.get_by_role('button',name='닫기',exact=True).click()
    page.reload()
    page.get_by_role('button',name='AI 현장등록',exact=True).click()
    assert page.get_by_label('도로명·지번 주소').input_value()=='서울특별시 세종대로 110'
    for _ in range(3): page.get_by_role('button',name='다음',exact=True).click()
    page.get_by_label('계약금액 · 원').fill('1000000')
    page.get_by_role('button',name='다음',exact=True).click()
    page.get_by_label('입력 정보와 위치를 확인했습니다.').check()
    page.evaluate("""async () => {
      const {Repository}=await import('/store.mjs');
      const original=Repository.prototype.put;
      window.qaSiteWrites=0;
      const gate=new Promise(resolve=>window.qaReleaseSite=resolve);
      Repository.prototype.put=async function(c,r,...args){
        if(c==='sites'){window.qaSiteWrites++;await gate;}
        return original.call(this,c,r,...args);
      };
      window.qaRestoreWriter=()=>{Repository.prototype.put=original;};
    }""")
    page.get_by_role('button',name='확인하고 현장 생성').click()
    page.locator('#registration-form').evaluate('(form)=>form.requestSubmit()')
    assert page.evaluate('window.qaSiteWrites')==1
    page.evaluate('window.qaReleaseSite()')
    page.get_by_role('heading',name='통합 검증 현장',exact=True).wait_for()
    page.evaluate('window.qaRestoreWriter()')
    results.append({'test':'AI 등록·초안 복원·실제 저장','status':'PASS'})
    results.append({'test':'저장 지연 중 중복 제출은 현장 한 건만 저장','status':'PASS'})
    page.get_by_role('button',name='일보 작성',exact=True).click()
    page.get_by_label('작업 내용',exact=True).fill('지하수 설비 현장 점검 및 배관 작업. 한글 출력 확인.')
    page.get_by_label('안전 확인 · 직접 점검한 내용').fill('작업 반경과 보호구 착용 상태를 직접 확인했습니다.')
    page.get_by_label('작업 인원 · 명').fill('3')
    page.get_by_role('button',name='저장',exact=True).click()
    page.locator('#modal').wait_for(state='hidden')
    with page.expect_download() as pdf_download:
        page.get_by_role('button',name='PDF 저장',exact=True).first.click()
    pdf_download.value.save_as(str(out/'daily-report.pdf'))
    results.append({'test':'현장 연결 공사일보 저장·실제 PDF 다운로드','status':'PASS'})
    page.goto('http://127.0.0.1:3650/#photos')
    page.get_by_role('button',name='사진 추가',exact=True).first.click()
    page.locator('input[name=files]').set_input_files(str(root/'tests'/'fixtures'/'pdf-page.jpg'))
    page.get_by_role('button',name='저장',exact=True).click()
    page.locator('#modal').wait_for(state='hidden')
    page.goto('http://127.0.0.1:3650/#home')
    page.locator('.metric[data-id=photos]').click()
    page.get_by_role('button',name='사진 보기',exact=True).first.click()
    page.locator('.photo-preview').wait_for()
    with page.expect_download() as original:
        page.locator('#modal').get_by_role('button',name='원본 저장',exact=True).click()
    original.value.save_as(str(out/'photo-original.jpg'))
    assert (out/'photo-original.jpg').read_bytes()==(root/'tests'/'fixtures'/'pdf-page.jpg').read_bytes()
    page.locator('#modal').get_by_role('button',name='닫기',exact=True).first.click()
    with page.expect_download() as photo_pdf:
        page.get_by_role('button',name='PDF 보고서 저장',exact=True).click()
    photo_pdf.value.save_as(str(out/'photo-report.pdf'))
    results.append({'test':'홈 사진카드 이동·사진 보기·원본 동일성·사진 PDF 생성','status':'PASS'})
    page.goto('http://127.0.0.1:3650/#clients')
    page.get_by_role('button',name='새로 작성',exact=True).click()
    page.get_by_label('거래처명',exact=True).fill('회귀검증 거래처')
    page.get_by_role('button',name='저장',exact=True).click()
    page.locator('#modal').wait_for(state='hidden')
    page.goto('http://127.0.0.1:3650/#payments')
    page.get_by_role('button',name='새로 작성',exact=True).click()
    page.get_by_label('금액 · 원',exact=True).fill('400000')
    page.get_by_role('button',name='저장',exact=True).click()
    page.locator('#modal').wait_for(state='hidden')
    page.goto('http://127.0.0.1:3650/#home')
    page.get_by_text('600,000원',exact=True).first.wait_for()
    page.goto('http://127.0.0.1:3650/#documents')
    page.get_by_role('button',name='새로 작성',exact=True).click()
    page.get_by_label('항목명',exact=True).fill('현장 설비 자재')
    page.get_by_label('수량',exact=True).fill('2')
    page.get_by_label('단가 원',exact=True).fill('100000')
    page.get_by_role('button',name='저장',exact=True).click()
    page.locator('#modal').wait_for(state='hidden')
    page.get_by_text('220,000원',exact=True).first.wait_for()
    with page.expect_download() as estimate_pdf:
        page.get_by_role('button',name='PDF 저장',exact=True).first.click()
    estimate_pdf.value.save_as(str(out/'estimate-report.pdf'))
    results.append({'test':'거래처·현장 수금·미수금·견적 저장 및 PDF 연결','status':'PASS'})
    page.goto('http://127.0.0.1:3650/#settings')
    with page.expect_download() as backup:
        page.get_by_role('button',name='백업 저장',exact=True).click()
    backup_path=out/'synthetic-workspace-backup.json'
    backup.value.save_as(str(backup_path))
    saved=json.loads(backup_path.read_text())
    assert len(saved['data']['sites'])==1 and len(saved['data']['photos'])==1
    assert saved['data']['photos'][0]['base64'].startswith('data:image/jpeg;base64,')
    page.once('dialog',lambda dialog: dialog.accept('기기 삭제'))
    page.get_by_role('button',name='기기 데이터 삭제',exact=True).click()
    page.get_by_text('기기 기록을 삭제했습니다.',exact=True).wait_for()
    page.once('dialog',lambda dialog: dialog.accept())
    page.locator('#restore-file').set_input_files(str(backup_path))
    page.get_by_text('백업을 복구했습니다.',exact=True).wait_for()
    results.append({'test':'사진 원본 포함 백업→기기 기록 삭제→실제 IndexedDB 복구','status':'PASS'})
    page.reload()
    page.locator('.mobile-nav [data-id=sites]').click()
    page.get_by_text('통합 검증 현장',exact=False).first.wait_for()
    results.append({'test':'저장 후 재실행 복구','status':'PASS'})
    for width in [320,360,390,768,1440]:
        page.set_viewport_size({'width':width,'height':900})
        for route in ['home','sites','maps','documents','settings']:
            page.goto('http://127.0.0.1:3650/#'+route)
            page.locator('.workspace').wait_for()
            page.wait_for_timeout(120)
            overflow=page.evaluate('document.documentElement.scrollWidth>innerWidth+1')
            results.append({'test':f'{route} {width}px 가로잘림','status':'FAIL' if overflow else 'PASS'})
        page.goto('http://127.0.0.1:3650/#home')
        page.locator('.workspace').wait_for()
        page.screenshot(path=str(out/f'home-{width}.png'),full_page=True)
    context.set_offline(True)
    page.goto('http://127.0.0.1:3650/#sites')
    page.get_by_text('통합 검증 현장',exact=False).first.wait_for()
    results.append({'test':'오프라인 재열기','status':'PASS'})
    results.append({'test':'브라우저 JS 오류','status':'FAIL' if errors else 'PASS','errors':errors})
    (out/'results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps(results,ensure_ascii=False))
    browser.close()
if any(row['status']=='FAIL' for row in results):
    raise SystemExit('Browser verification failed; see evidence/integration-ui/results.json')
