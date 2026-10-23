# 현장AI365 구현 기준

기준: 사용자 제공 마스터 프롬프트 v3.0. 참고 이미지의 남색·주황 브랜드, 안전모 캐릭터, 업무 카드 구조를 실제 반응형 UI로 구현한다. 홍보 화면을 잘라 UI로 사용하지 않는다.

## 구조 및 순서
1. 의존성 없는 웹 UI + 입력 검증·금액 계산·승인형 제안 도메인 모듈.
2. IndexedDB로 현장, 일보, 사진 원본, 업무서류, 수금, 거래처, 사용자 설정을 저장. 실제 데이터를 처음부터 빈 상태로 시작한다.
3. Firebase Auth REST와 Firestore/Storage REST 어댑터. Firebase 프로젝트·로그인 UID별 로컬 DB와 원격 경로를 분리. 클라우드 전송은 수동 실행하며 기본 비활성화.
4. 인증된 서버에서만 OpenAI Responses 호출. 브라우저·Android·배포 ZIP에는 API 키를 포함하지 않는다. 비용이 발생하는 호출은 서버 설정에서 별도로 활성화해야 한다.
5. Android Java WebView 앱에서 같은 웹 코드를 로컬 HTTPS 가상 호스트로 제공. 공개 배포 없이 Android SDK 환경에서 빌드할 수 있는 프로젝트를 제공한다.

## 데이터
공통: id, updatedAt, revision, dirty, remoteTag, deleted(동기화용 삭제 표식).
sites: name/address/clientId/contractAmount/status.
logs: siteId/date/work/safety/workers/weather/equipment/nextWork.
photos: siteId/date/name/mime/blob(원본)/originalRevision/remoteObject, 원격 동기화에는 파일 내용 대신 메타데이터.
documents: type/siteId/client/items(name/quantity/unitPrice)/vatRate/terms/note.
payments: siteId/date/direction/amount/note.
clients: name/phone/note.
profile: company/industry/modules/defaults/approvedRules.

원격 문서 경로: hyeonjang365Users/{uid}/{collection}/{id}. 원본 사진 경로: hyeonjang365Users/{uid}/photos/{id}-{revision}. 백업 scope로 계정·프로젝트 범위를 확인하며 원본 포함 복구는 재업로드를 준비한다. 로컬 DB 이름은 프로젝트 길이·프로젝트·UID를 함께 사용한다. 계정 변경 때 다른 UID의 DB를 열지 않는다. Firebase 프로젝트는 사용자가 지정해야 하며 기존 물병 앱 프로젝트와 자동 합치지 않는다.

## 필수 / 권장 / 선택 / 제외
필수: 오프라인 저장, 값 검증, 승인 전 자동화 미적용, 데이터 분리, 백업, 중복 저장 차단, 사용자별 접근 규칙, API 키 비노출.
권장: 실패 후 재시도, 큰 글씨·작은 화면·Android 실기기, 동기화 충돌 보존, 실제 PDF 검사.
선택: 음성 입력(지원 브라우저), 주소 검색(외부 지도 링크), 클라우드 사진 전송(별도 활성화).
제외: 자동 세금계산서 발행, 전자 계약 체결, 자동 행정 제출, AI 생성 코드 실행, 공개 출시.

## 검증 계획
입력·금액·미수금·백업·승인형 제안·동기화 충돌과 인증 실패를 자동 검사한다. UI·Android·실제 Firebase·실제 AI는 실제로 실행한 경우에만 PASS 처리한다. 허용된 브라우저 QA 도구와 Android SDK가 없는 현재 환경에서는 해당 항목을 NOT TESTED로 기록한다.
