# -*- coding: utf-8 -*-
from __future__ import annotations
from typing import Any
from pathlib import Path
from datetime import datetime, timezone
import tempfile
import re

from firebase_functions import https_fn
from firebase_admin import initialize_app, firestore, storage

from form_pdf import generate_forms, FORM_NAMES, DEFAULT_CONTRACTOR

initialize_app()
DB = firestore.client()
ROOT = Path(__file__).resolve().parent
TEMPLATES = ROOT / 'templates'
BUNDLED_STAMP = ROOT / '경일지하수_직인_자연.png'


def err(code, message):
    raise https_fn.HttpsError(code=code, message=message)


def safe_name(s: str) -> str:
    return re.sub(r'[\\/:*?"<>|]+', '_', str(s or '')).strip()[:60] or '현장'


def active_member(company_id: str, uid: str):
    snap=DB.document(f'companies/{company_id}/members/{uid}').get()
    if not snap.exists or snap.to_dict().get('status')!='active':
        err(https_fn.FunctionsErrorCode.PERMISSION_DENIED, '업체 사용 권한이 없습니다.')
    return snap.to_dict()


def contractor_from_company(company: dict) -> dict:
    settings=company.get('documentSettings') or {}
    c={
        'company': company.get('name',''),
        'ceo': settings.get('ceo') or company.get('ownerName',''),
        'reg': settings.get('registrationNumber',''),
        'caddr': settings.get('address') or company.get('address',''),
        'cphone': settings.get('phone') or company.get('phone',''),
        'fax': settings.get('fax',''),
    }
    # Alpha 0.2: 경일지하수는 기존 검증된 시공업체 정보로 빈 항목을 보완합니다.
    if c['company']=='경일지하수':
        for k,v in DEFAULT_CONTRACTOR.items():
            if not c.get(k): c[k]=v
    return c


@https_fn.on_call(region='asia-northeast3', timeout_sec=120)
def generateForms(req: https_fn.CallableRequest) -> Any:
    if req.auth is None:
        err(https_fn.FunctionsErrorCode.UNAUTHENTICATED, '로그인이 필요합니다.')
    uid=req.auth.uid
    user=DB.document(f'users/{uid}').get()
    if not user.exists:
        err(https_fn.FunctionsErrorCode.PERMISSION_DENIED, '업체 계정을 찾을 수 없습니다.')
    profile=user.to_dict(); company_id=profile.get('companyId','')
    if not company_id or profile.get('status')!='active':
        err(https_fn.FunctionsErrorCode.PERMISSION_DENIED, '업체 사용 권한이 없습니다.')
    member=active_member(company_id, uid)
    if member.get('role') not in ('owner','admin','manager'):
        err(https_fn.FunctionsErrorCode.PERMISSION_DENIED, '대표·관리자·현장관리자만 신고서를 생성할 수 있습니다.')

    payload=req.data or {}; site_id=str(payload.get('siteId','')).strip(); codes=[str(x) for x in (payload.get('codes') or [])]
    data=dict(payload.get('data') or {})
    if not site_id or not codes:
        err(https_fn.FunctionsErrorCode.INVALID_ARGUMENT, '현장과 생성할 신고서를 확인하세요.')
    if any(c not in FORM_NAMES for c in codes):
        err(https_fn.FunctionsErrorCode.INVALID_ARGUMENT, '지원하지 않는 신고서가 포함되어 있습니다.')
    site_ref=DB.document(f'companies/{company_id}/sites/{site_id}'); site_snap=site_ref.get()
    if not site_snap.exists:
        err(https_fn.FunctionsErrorCode.NOT_FOUND, '현장을 찾을 수 없습니다.')
    site=site_snap.to_dict(); data['site']=data.get('site') or site.get('site',''); data['siteName']=site.get('name') or data.get('siteName') or data.get('site')
    company_snap=DB.document(f'companies/{company_id}').get()
    if not company_snap.exists: err(https_fn.FunctionsErrorCode.NOT_FOUND, '업체 정보를 찾을 수 없습니다.')
    company=company_snap.to_dict(); contractor=contractor_from_company(company)
    stamp=BUNDLED_STAMP if contractor.get('company')=='경일지하수' and BUNDLED_STAMP.exists() else None

    now=datetime.now(timezone.utc); batch_key=now.strftime('%Y%m%d_%H%M%S')
    bucket=storage.bucket(); results=[]
    try:
        with tempfile.TemporaryDirectory(prefix='h365_forms_') as td:
            files=generate_forms(codes,data,TEMPLATES,Path(td),stamp_path=stamp,contractor=contractor,report_date=datetime.now().strftime('%Y-%m-%d'))
            for code,path in zip(codes,files):
                filename=f'{safe_name(site.get("name") or data.get("site"))}_{FORM_NAMES[code]}.pdf'
                storage_path=f'companies/{company_id}/sites/{site_id}/documents/{batch_key}/{filename}'
                blob=bucket.blob(storage_path); blob.upload_from_filename(str(path),content_type='application/pdf')
                doc_ref=DB.collection(f'companies/{company_id}/documents').document()
                doc_ref.set({
                    'companyId':company_id,'siteId':site_id,'siteName':site.get('name',''),'code':code,'type':'groundwater-form','name':filename,
                    'storagePath':storage_path,'createdBy':uid,'createdAt':firestore.SERVER_TIMESTAMP,'formData':data,
                })
                results.append({'code':code,'name':filename,'storagePath':storage_path,'documentId':doc_ref.id})
        site_ref.set({'permitProfile': data, 'permitLastCodes': codes, 'permitUpdatedAt': firestore.SERVER_TIMESTAMP}, merge=True)
    except ValueError as e:
        err(https_fn.FunctionsErrorCode.INVALID_ARGUMENT, str(e))
    except Exception as e:
        err(https_fn.FunctionsErrorCode.INTERNAL, '신고서 생성 중 오류가 발생했습니다: '+str(e)[:300])
    return {'ok':True,'forms':results,'siteId':site_id}
