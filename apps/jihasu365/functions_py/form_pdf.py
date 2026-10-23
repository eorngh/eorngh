# -*- coding: utf-8 -*-
"""지하수365 신고서 4종 PDF 생성 핵심 모듈.

- 정부서식 원본 PDF를 그대로 사용하고 입력칸만 채웁니다.
- 별도 폰트 파일을 배포하지 않고 PyMuPDF 내장 CJK 글꼴(korea)을 사용합니다.
- PC 로컬 테스트와 Firebase Python Functions가 동일 코드를 사용합니다.
"""
from __future__ import annotations
from pathlib import Path
from datetime import datetime
import re
import fitz
try:
    fitz.TOOLS.mupdf_display_errors(False)
    fitz.TOOLS.mupdf_display_warnings(False)
except Exception:
    pass

FORM_NAMES = {
    '22': '굴착행위신고서',
    '25': '굴착행위종료신고서',
    '9': '지하수개발이용신고서',
    '13': '지하수개발이용준공신고서',
}
REQ = {
    '22':['name','birth','phone','address','site','coord1','coord2','depth','diameter','purpose','use','start_plan','restore_plan'],
    '25':['name','birth','phone','address','site','coord1','coord2','depth','diameter','reportno'],
    '9':['name','birth','phone','address','site','coord1','coord2','use','drink','depth','diameter','planned','hp','pipe','pumpdepth','capacity','start_plan','finish_plan'],
    '13':['name','birth','phone','address','site','coord1','coord2','use','drink','depth','diameter','planned','hp','pipe','pumpdepth','capacity','outlet','meter','level','upper_w','upper_d','upper_h','lower','grout','start_real','finish_real'],
}
FONT_NAME = 'korea'


def normalize_month(v: str) -> str:
    v = str(v or '').strip()
    m = re.fullmatch(r'(\d{4})-(\d{1,2})', v)
    if m:
        return f'{int(m.group(1))}년 {int(m.group(2))}월'
    return v


def normalize_date(v: str) -> str:
    v = str(v or '').strip()
    m = re.fullmatch(r'(\d{4})-(\d{1,2})-(\d{1,2})', v)
    if m:
        return f'{int(m.group(1))}년 {int(m.group(2))}월 {int(m.group(3))}일'
    return v


def validate(code: str, data: dict) -> list[str]:
    return [k for k in REQ.get(str(code), []) if not str(data.get(k, '')).strip()]


def _white(page, rect, inset=1.0):
    r = fitz.Rect(*rect)
    hits=[]
    try:
        for w in page.get_text('words'):
            wr=fitz.Rect(w[:4])
            if wr.intersects(r) and (wr & r).get_area() > 0:
                hits.append(wr)
    except Exception:
        hits=[]
    if hits:
        for wr in hits:
            rr=fitz.Rect(max(r.x0,wr.x0-.6),max(r.y0,wr.y0-.6),min(r.x1,wr.x1+.6),min(r.y1,wr.y1+.6))
            page.draw_rect(rr,color=None,fill=(1,1,1),overlay=True)
    else:
        rr=fitz.Rect(r.x0+inset,r.y0+inset,r.x1-inset,r.y1-inset)
        if rr.width>1 and rr.height>1:
            page.draw_rect(rr,color=None,fill=(1,1,1),overlay=True)


def _put(page, rect, text, size=9, align=2, min_size=5.8, lineheight=1.05):
    r=fitz.Rect(*rect); text=str(text or '')
    _white(page,r)
    fs=size
    while fs>=min_size:
        rc=page.insert_textbox(r,text,fontname=FONT_NAME,fontsize=fs,color=(0,0,0),align=align,lineheight=lineheight,overlay=True)
        if rc>=0: return fs
        _white(page,r); fs-=0.25
    page.insert_textbox(r,text,fontname=FONT_NAME,fontsize=min_size,color=(0,0,0),align=align,lineheight=.95,overlay=True)
    return min_size


def _cover_signature(page, rect):
    page.draw_rect(fitz.Rect(*rect),color=None,fill=(1,1,1),overlay=True)


def _text_width(text, fontsize):
    return fitz.Font(fontname=FONT_NAME).text_length(str(text), fontsize=fontsize)


def _rebuild_form9_contractor_table(page, contractor: dict):
    x0, x1, x2, x3 = 133.728, 254.503, 431.288, 538.870
    yt, ym, yb = 542.886, 573.932, 629.791
    page.add_redact_annot(fitz.Rect(390.0, 537.2, 450.0, 595.0), fill=(1,1,1))
    page.add_redact_annot(fitz.Rect(x0+0.7, yt+0.7, x3-0.7, yb-0.7), fill=(1,1,1))
    page.apply_redactions()
    lc=(0,0,0)
    for a,b,w in [((x0,yt),(x3,yt),.48),((x0,ym),(x3,ym),.60),((x0,yb),(x3,yb),.48),((x0,yt),(x0,yb),.36),((x1,yt),(x1,ym),.36),((x2,yt),(x2,ym),.36)]:
        page.draw_line(a,b,color=lc,width=w,overlay=True)
    for pos,txt in [((140.0,555.6),'업체명'),((260.0,555.6),'대표자'),((436.0,555.6),'등록번호'),((140.0,586.8),'주소')]:
        page.insert_text(pos,txt,fontname=FONT_NAME,fontsize=8.1,color=(0,0,0),overlay=True)
    company=contractor.get('company',''); fs_company=8.8
    tx=x1-8.0-_text_width(company,fs_company); base=570.2
    page.insert_text((tx,base),company,fontname=FONT_NAME,fontsize=fs_company,color=(0,0,0),overlay=True)
    rep=contractor.get('ceo',''); fs=8.6
    page.insert_text((x2-8.0-_text_width(rep,fs),570.2),rep,fontname=FONT_NAME,fontsize=fs,color=(0,0,0),overlay=True)
    reg=contractor.get('reg',''); rfs=8.2
    page.insert_text((x3-7.0-_text_width(reg,rfs),570.2),reg,fontname=FONT_NAME,fontsize=rfs,color=(0,0,0),overlay=True)
    addr=contractor.get('caddr',''); afs=8.4
    page.insert_text((x3-7.0-_text_width(addr,afs),599.8),addr,fontname=FONT_NAME,fontsize=afs,color=(0,0,0),overlay=True)
    phone=f'(전화번호: {contractor.get("cphone","")} )'; pfs=7.9
    page.insert_text((x3-7.0-_text_width(phone,pfs),614.0),phone,fontname=FONT_NAME,fontsize=pfs,color=(0,0,0),overlay=True)
    fax=f'(FAX {contractor.get("fax","")} )'; ffs=7.9
    page.insert_text((x3-7.0-_text_width(fax,ffs),627.2),fax,fontname=FONT_NAME,fontsize=ffs,color=(0,0,0),overlay=True)


def prepare_data(data: dict) -> dict:
    d={k: ('' if v is None else str(v).strip()) for k,v in dict(data or {}).items()}
    for k in ('start_plan','finish_plan','restore_plan','start_real','finish_real'):
        d[k]=normalize_month(d.get(k,''))
    d.setdefault('purpose','지하수개발')
    d.setdefault('drink','비음용')
    return d


def build_pdf(code: str, data: dict, template_dir: Path, out_path: Path, *, contractor: dict|None=None, report_date: str|None=None):
    code=str(code); d=prepare_data(data)
    missing=validate(code,d)
    if missing:
        raise ValueError(f'{FORM_NAMES.get(code,code)} 필수값 누락: '+', '.join(missing))
    contractor=dict(contractor or {})
    required=('company','ceo','reg','caddr','cphone')
    missing=[key for key in required if not str(contractor.get(key) or '').strip()]
    if missing:
        raise ValueError('신고서 업체정보 누락: '+', '.join(missing))
    template=Path(template_dir)/f'form_{code}.pdf'
    if not template.exists(): raise FileNotFoundError(template)
    out_path=Path(out_path); out_path.parent.mkdir(parents=True,exist_ok=True)
    date=normalize_date(report_date or datetime.now().strftime('%Y-%m-%d'))
    doc=fitz.open(template); p=doc[0]
    if code=='22':
        _put(p,(300,146,380,164),d['name'],9,2); _put(p,(445,141,535,158),d['birth'],9,2)
        _put(p,(325,187,535,203),d['address'],8.5,2); _put(p,(390,207,535,224),f'(전화번호:{d["phone"]})',8,2)
        _put(p,(140,276,229,304),d['site'],8,1); _put(p,(238,277,313,292),d['coord1'],7.4,1); _put(p,(238,290,313,304),d['coord2'],7.4,1)
        _put(p,(340,276,397,304),d['depth']+'m',8,1); _put(p,(398,276,456,304),d['diameter']+'㎜',8,1)
        _put(p,(449,274,535,291),d['purpose'],8,1); _put(p,(449,291,535,307),'('+d['use']+')',7.5,1)
        _put(p,(145,325,300,343),d['start_plan'],8,2); _put(p,(356,325,535,343),d['restore_plan'],8,2)
        _put(p,(460,444,540,460),date,8,2); _cover_signature(p,(398,456,542,493)); _put(p,(405,461,500,480),d['name'],8,2); p.draw_line((60,493),(535,493),color=(0,0,0),width=1.0,overlay=True)
    elif code=='25':
        _put(p,(250,180,318,197),d['name'],9,2); _put(p,(445,177,535,194),d['birth'],9,2)
        _put(p,(330,207,535,224),d['address'],8,2); _put(p,(390,233,535,250),f'(전화번호:{d["phone"]})',8,2)
        _put(p,(60,335,105,392),d['reportno'],8,1); _put(p,(132,335,310,355),d['site'],7.8,1); _put(p,(145,354,295,372),d['coord1'],7.4,1); _put(p,(145,370,295,388),d['coord2'],7.4,1)
        _put(p,(335,350,395,388),d['depth']+'m',8,1); _put(p,(397,350,465,388),d['diameter']+'㎜',8,1); _white(p,(465,335,535,388))
        _put(p,(455,489,542,505),date,8,2); _cover_signature(p,(395,505,542,545)); _put(p,(400,512,485,531),d['name'],8,2)
    elif code=='9':
        _put(p,(285,154,362,172),d['name'],9,2); _put(p,(450,152,535,170),d['birth'],8.5,2)
        _put(p,(320,185,535,202),d['address'],8,2); _put(p,(390,199,535,216),f'(전화번호:{d["phone"]})',8,2)
        _put(p,(170,243,535,261),d['site'],8,1); _put(p,(175,276,310,292),d['coord1'],7.8,1); _put(p,(175,292,310,309),d['coord2'],7.8,1)
        _put(p,(360,276,446,294),d['use'],7.8,1); _put(p,(455,274,535,292),d['drink'],8,1)
        _put(p,(285,336,357,356),d['depth']+'m',8.5,2); _put(p,(475,336,535,356),d['diameter']+'㎜',8.5,2); _put(p,(260,376,535,397),d['planned']+'㎥/일',8.5,2)
        _put(p,(300,425,357,445),d['hp']+'HP',8.5,2); _put(p,(480,425,535,445),d['pipe']+'㎜',8.5,2); _put(p,(285,466,357,486),d['pumpdepth']+'m',8.5,2); _put(p,(475,466,535,486),d['capacity']+'㎥/일',8.5,2)
        _put(p,(185,515,300,536),d['start_plan'],8,2); _put(p,(420,515,535,536),d['finish_plan'],8,2)
        _rebuild_form9_contractor_table(p,contractor)
        _put(p,(450,691,540,708),date,8,2); _cover_signature(p,(395,706,542,750)); _put(p,(405,714,495,733),d['name'],8,2); p.draw_line((60,748),(535,748),color=(0,0,0),width=1.2,overlay=True)
    elif code=='13':
        _put(p,(270,171,345,190),d['name'],9,2); _put(p,(445,169,536,187),d['birth'],8.5,2)
        _put(p,(320,198,536,216),d['address'],8,2); _put(p,(390,221,536,239),f'(전화번호:{d["phone"]})',8,2)
        _put(p,(165,257,536,276),d['site'],8,2); _put(p,(165,290,300,307),d['coord1'],7.8,1); _put(p,(165,306,300,323),d['coord2'],7.8,1)
        _put(p,(350,290,445,308),d['use'],7.8,1); _put(p,(455,288,536,306),d['drink'],8,1)
        _put(p,(280,332,345,352),d['depth']+'m',8.5,2); _put(p,(475,332,536,352),d['diameter']+'㎜',8.5,2); _put(p,(300,355,536,375),d['planned']+'㎥/일',8.5,2)
        _put(p,(200,379,252,399),d['outlet']+'mm',8,1); _put(p,(315,379,382,399),d['meter'],8,1); _put(p,(492,379,536,399),d['level']+'mm',8,1)
        _put(p,(305,412,345,432),d['hp']+'HP',8.5,1); _put(p,(485,412,536,432),d['pipe']+'㎜',8.5,1); _put(p,(300,437,345,457),d['pumpdepth']+'m',8.5,1); _put(p,(480,437,536,457),d['capacity']+'㎥/일',8.5,1)
        _put(p,(130,488,345,508),f"가로 {d['upper_w']}cm X 세로 {d['upper_d']}cm X 높이 {d['upper_h']}cm",7.5,1); _put(p,(470,488,536,508),d['lower']+' cm',8,2); _put(p,(430,507,536,526),d['grout']+' cm',8,2)
        _put(p,(115,625,205,645),d['start_real'],8,1); _put(p,(330,625,420,645),d['finish_real'],8,1); _put(p,(295,644,536,663),d.get('work_note',''),7.5,2)
        _put(p,(450,716,540,734),date,8,2); _cover_signature(p,(398,735,542,770)); _put(p,(405,740,495,758),d['name'],8,2)
        _put_stamp_on_company_last_char(p, stamp_path, contractor.get('company','경일지하수'))
    else:
        doc.close(); raise ValueError('지원하지 않는 서식 코드: '+code)
    doc.save(out_path,garbage=4,deflate=True,clean=True)
    doc.close()
    return out_path


def generate_forms(codes, data, template_dir, output_dir, *, contractor=None, report_date=None):
    out=[]; output_dir=Path(output_dir); output_dir.mkdir(parents=True,exist_ok=True)
    safe_site=re.sub(r'[\\/:*?"<>|]+','_',str(data.get('siteName') or data.get('site') or '현장')).strip()[:50]
    for code in [str(c) for c in codes]:
        name=f'{code}_{safe_site}_{FORM_NAMES.get(code,code)}.pdf'
        p=build_pdf(code,data,Path(template_dir),output_dir/name,contractor=contractor,report_date=report_date)
        out.append(p)
    return out
