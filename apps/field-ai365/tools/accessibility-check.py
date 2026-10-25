from playwright.sync_api import sync_playwright
from pathlib import Path
import json
import os
root=Path(__file__).resolve().parents[1]
rows=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=os.environ.get('FIELD365_CHROMIUM'))
    page=b.new_page()
    for width in [320,360,390,768,1440]:
        page.set_viewport_size({'width':width,'height':900})
        for route in ['home','sites','maps','documents','settings']:
            page.goto('http://127.0.0.1:3650/#'+route)
            page.reload()
            page.locator('.workspace').wait_for()
            page.evaluate("""() => {const values=[...document.querySelectorAll('body *')].map(e=>[e,parseFloat(getComputedStyle(e).fontSize)]);for(const[e,size]of values)e.style.fontSize=(size*2)+'px';}""")
            overflow=page.evaluate('document.documentElement.scrollWidth>innerWidth+1')
            small=page.evaluate("""()=>[...document.querySelectorAll('button')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&(r.width<43.5||r.height<43.5)}).map(e=>e.textContent.trim()||e.getAttribute('aria-label'))""")
            rows.append({'width':width,'route':route,'overflow':overflow,'small_targets':small,'status':'FAIL' if overflow or small else 'PASS'})
    (root/'evidence'/'accessibility-check.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps(rows,ensure_ascii=False))
    b.close()
if any(row['status']=='FAIL' for row in rows):
    raise SystemExit('Accessibility verification failed; see evidence/accessibility-check.json')
