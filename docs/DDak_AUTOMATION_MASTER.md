# 딱 시리즈 공개 GitHub 자동관리 — MASTER v1.0

## 현재 상태
- 저장소: eorngh/eorngh (Public, main)
- 루트 README.md는 개인 프로필용 특수 문서이므로 변경하지 않는다.
- 2026-10-22 기준 앱 소스가 확인되지 않았으므로 앱 실제 빌드·테스트·수정·배포는 아직 안 됐다.

## 자동 점검
- GitHub Actions: DDak source audit and tests
- 한국 시간 오전 8:20 전후의 매일 예약 검사 (지연될 수 있음)
- apps/ 또는 projects/ 아래에 소스가 올라오거나 관련 자동화 파일이 변경되면 검사
- 추적 파일 중 대표적인 자격 증명 파일명과 패턴 검사 (완전한 비밀 유출 방지는 아님)
- package.json + package-lock.json: npm ci --ignore-scripts, 존재하는 lint/test/build 스크립트 검사
- gradlew + gradle/wrapper/gradle-wrapper.jar: Android test 및 assembleDebug 시도
- Source 미연결 시 Summary에 NOT TESTED로 기록한다.
- 자동 검사 초록색은 출시 적합 판정이 아니다.

## 소스 추가 규칙
- 여행딱: apps/travel-ddak/
- 현장AI365: apps/field-ai365/
- 사진딱: apps/photo-ddak/
- 캡처비서: apps/capture-assistant/
- 지하수365: apps/groundwater365/
- ZIP 파일 자체가 아니라 프로젝트 파일을 올린다. 공개 저장소에 올릴 수 있는 내용만 선별한다.
- .env, API 비밀키, 서비스 계정, Keystore, 개인·고객·현장정보를 절대 커밋하지 않는다.
- 모바일 앱에 서버 비밀키를 포함하지 않는다. GitHub Secrets도 코드로 노출하지 않는다.
- 실수로 키를 올렸다면 삭제만 하지 말고 해당 키를 즉시 폐기·재발급하고 커밋 이력을 확인한다.

## 운영 원칙
1. 새 앱보다 기존 앱 출시 준비가 우선: 여행딱 → 현장AI365 → 사진딱 → 캡처비서 → 지하수365.
2. 실패 보고서를 보고 딱 한 개의 원인만 재현·수정한다.
3. Codex는 원본 백업·작업 브랜치 → 최소 수정 → 테스트 → PR로 보고한다.
4. 사용자 승인이 없으면 데이터 삭제, 유료 서비스 사용, 앱 배포, main 병합을 하지 않는다.
5. 화면 잘림, 로그인, 실제 기기, Play Console 비공개 테스트는 CI 외에 추가 확인한다.
6. 전체 프로젝트를 매번 재분석하지 않고 변경된 범위와 실패 지점 중심으로 확인하여 사용량을 아낀다.

## PC Codex용 복사 명령
저장소 eorngh/eorngh를 활용해 기존 딱 시리즈 앱의 자동 품질관리를 시작한다. 먼저 docs/DDak_AUTOMATION_MASTER.md와 GitHub Actions 결과를 확인하라. 루트 README.md는 건드리지 마라. 앱 소스가 연결되지 않았다면 연결 대상 경로만 보고하고, 없는 소스를 만들어냈다고 보고하지 마라. 소스가 있다면 여행딱부터 한 앱만 대상으로 백업과 작업 브랜치를 만든 뒤, 실제 재현 가능한 오류만 수정하고 lint·테스트·빌드를 실행하라. GitHub 비밀키·서명키·고객정보가 노출되지 않도록 확인하라. 완료 조건은 변경 파일, 테스트 결과, 미검증 항목, PR 링크로 간결히 보고하는 것이다. 배포·결제·삭제·main 병합은 승인 없이는 실행하지 마라.

## 수동 실행
GitHub 저장소 → Actions → DDak source audit and tests → Run workflow → Summary.
