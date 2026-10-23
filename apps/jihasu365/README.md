# 지하수365 FINAL UX v1.2

이 인계본은 Codex 전달 전 마지막 상용 UX 업그레이드를 반영한 버전입니다.

- 오늘 할 일 중심 대시보드
- 중앙 퀵 액션
- 현장 진행 5단계 타임라인
- 현장 사진 공정별 분류 + 체크리스트
- 최근 공사일보 불러오기
- 신고서 5단계 UX
- 동기화 상태 가시화
- 현장 검색/상태 필터 및 빈 화면 개선

검증 결과는 `UX_v1.2_업그레이드_검수보고서.md`를 먼저 확인하세요.

# 지하수365 FINAL — Codex 인계전 최종본

## 제품 방향
지하수 개발·이용시공업의 실제 현장 흐름에 맞춘 Android/PWA 업무앱입니다.

핵심 흐름:
`로그인 → 업체/직원 → 현장 등록 → 지하수지도/GPS → 공사일보/사진 → 질문식 신고서 → PDF 4종 → Firebase 동기화`

## 이번 최종 업그레이드
- 앱명/패키지 브랜드를 **지하수365**로 통일
- Android applicationId: `kr.co.gyeongil.jihasu365`
- 일본 애니메이션풍 지하수 시추 로그인 비주얼 적용(독자 생성 이미지)
- 신규 지하수365 심볼/Play 아이콘 적용
- 현장 지도 UX를 **지하수지도** 중심으로 정리
- GIMS 공식 지하수정보지도 바로가기/레이어 안내 추가
- 한국지하수지열협회 공식 웹툰 및 실무 안내 바로가기 추가
- AR/물병 등 실무와 무관한 기능 제거, **현장 사진 촬영** 중심으로 정리
- 모바일/태블릿/PC 반응형 상용 UI 유지
- 공사일보·신고서 초안 로컬 임시저장 유지
- Play Store 스크린샷/Feature Graphic 재생성

## 공식 서비스 사용 원칙
`공식사이트_참고사항.md`를 읽습니다.
- GIMS/협회의 데이터·웹툰·이미지를 복제하지 않음
- 앱은 공식 사이트로 연결하고, 내부에는 사용자 소유 현장 GPS/업무자료만 저장

## Architecture
- Frontend: Firebase Hosting PWA
- Auth: Google / Firebase Authentication
- DB: Firestore multi-tenant (`companies/{companyId}/...`)
- Files: Firebase Storage
- Functions: Node.js 22 + Python 3.11, Seoul (`asia-northeast3`)
- Android: Trusted Web Activity wrapper

## Release identity
- App name: `지하수365`
- Android applicationId: `kr.co.gyeongil.jihasu365`
- versionCode: `1`
- versionName: `1.0.0`
- targetSdk: `36`
- Web origin: `https://gyeongilwater.web.app/`

## Local verification
```powershell
python rc1_verification.py
python ui_commercial_audit.py
```
기대 결과:
- 전체 실행·생성 회귀검증 FINAL PASS
- 상용 UI/UX 94 PASS / 0 FAIL
- 지하수365 브랜딩/GIMS/협회/사진 중심 UX 정적검증 PASS

## Codex
`00_CODEX_여기부터.md` → `CODEX_최종작업지시서.md` 순서로 읽습니다.
