# 현장AI365 · 개발 검증판 0.1.0

현장, 공사일보, 원본 사진, 업무 서류, 수금, 거래처를 관리하는 PC 웹과 Android 공통 소스입니다. 사용자 제공 마스터 프롬프트 v3.0을 기준으로 구현했습니다.

**현재는 개발 검증판입니다. APK/AAB는 생성되지 않았으며, 실제 화면·기기·Firebase 검증 전에는 상용 업무의 유일한 기록 수단으로 사용하지 마세요.** 실제 검증 결과는 [TEST_REPORT.md](TEST_REPORT.md), 다음 작업은 [NEXT_STEPS.md](NEXT_STEPS.md)에 있습니다.

## PC에서 실행

1. ZIP을 한 폴더에 모두 압축 해제합니다.
2. [Node.js](https://nodejs.org/en/download) 22 이상을 설치합니다. 이번 자동 검사는 Node 24.19.0에서 실행했습니다.
3. Windows는 `START_WINDOWS.cmd`를 실행합니다. 서버가 준비되면 브라우저를 엽니다. 실행 창을 유지하세요.
4. 다른 운영체제에서는 프로젝트 폴더에서 다음 명령을 실행하고 `http://127.0.0.1:3650`을 엽니다.

```bash
npm start
```

추가 npm 패키지를 설치할 필요가 없습니다. HTML 파일을 직접 더블클릭하면 저장소와 모듈이 정상 동작하지 않을 수 있으므로 서버를 통해 여세요. 서버는 기본적으로 이 PC에서만 접속할 수 있습니다.

## 첫 업무 흐름

`내 업무에 맞게 설정`에서 회사·업종·업무 메뉴를 선택합니다. `현장 등록`으로 이름·주소·계약금액을 입력한 뒤 해당 현장에서 일보, 사진, 서류, 수금을 작성합니다. PDF와 사진 원본은 파일로 저장합니다. 설정에서 원본 포함 백업을 정기적으로 저장하세요.

사진은 날짜를 직접 확인해 분류합니다. EXIF 날짜·위치 추출이나 AI 사진 분석은 구현하지 않았습니다. 주소는 직접 입력하고 외부 지도 검색으로 확인합니다. 일보 안전 문구는 현장에서 직접 확인한 내용으로 작성하세요.

## Firebase 연결 준비

실제 Firebase 프로젝트는 아직 지정하지 않았습니다. 앱의 `설정 → 연결 설정`에 전용 프로젝트 ID, Firebase 웹 API 키, Storage 버킷을 입력합니다. OpenAI 비밀 키를 앱에 입력하지 마세요.

관리자는 아래 설정을 먼저 준비해야 합니다. 이 프로젝트는 어떤 Firebase 규칙도 자동 배포하지 않습니다.

- Email/Password 인증 활성화, Firestore 기본 데이터베이스와 선택한 Storage 생성.
- `firebase/firestore.rules`와 `firebase/storage.rules`를 테스트한 뒤 해당 전용 프로젝트에 적용. 공유 프로젝트 규칙을 그대로 덮어쓰지 마세요.
- Storage 규칙의 Firestore 조회를 위한 서비스 계정 권한 확인.
- 서버의 Firebase 웹 API 키와 앱의 프로젝트가 동일한지 확인.
- 두 테스트 계정으로 서로의 문서·사진 읽기/쓰기/목록/삭제가 거부되는지 확인.

기기 전용 기록과 로그인 계정 기록은 별도 공간입니다. 로그인하면 기기 전용 내역을 자동 이관하지 않습니다. 이관하려면 먼저 백업한 뒤 해당 계정에서 복구 범위를 확인하세요. 클라우드 전송과 사진 원본 전송은 별도 승인 설정입니다. 동기화는 `지금 동기화`로 수동 실행합니다.

충돌이 있으면 설정의 `동기화 충돌 확인`에서 두 버전을 확인해 선택합니다. 먼저 백업하세요. 기기 버전을 선택한 뒤에는 다시 수동 동기화를 실행합니다. 충돌 보존 파일은 일반 백업과 다른 검토용 JSON입니다.

## AI 서버 설정

기본 메뉴 설정과 업무 제안은 기기에서 동작하는 규칙 기반 기능입니다. 실제 모델 상담은 연결 설정, 로그인, 질문 전송 승인, 서버 설정이 모두 필요합니다.

`.env.example`을 `.env.local`로 복사해 서버에서만 비밀 키와 모델을 설정합니다. 원본 작업 환경에서 승인된 비밀 키는 전달 ZIP에 포함하지 않았습니다.

```text
OPENAI_API_KEY=서버에서만_설정
OPENAI_MODEL=사용할_Responses_지원_모델명
FIREBASE_WEB_API_KEY=동일_프로젝트의_공개_설정값
ALLOW_AI_CALLS=false
```

유료 호출과 운영 예산이 확정된 경우에만 `ALLOW_AI_CALLS=true`로 활성화하세요. Android와 다른 PC의 모델 상담에는 승인된 HTTPS 서버가 필요합니다. 앱의 `AI 서버 HTTPS 주소`와 웹 서버의 `TRUSTED_AI_ORIGIN`, `ALLOWED_ORIGINS`를 맞춰야 합니다. 외부 서버 배포는 이번 작업에서 수행하지 않았습니다.

로컬 서버의 `PORT`를 기본 3650에서 바꾸면 `ALLOWED_ORIGINS`의 `http://127.0.0.1:포트`, `http://localhost:포트`도 함께 변경하세요. Windows 실행 도구의 실제 실행은 미검증입니다.

AI는 질문·업종·현장 개수만 전달받습니다. 답변이 제안한 메뉴·안전 기본문구·미수금 표시 규칙은 사용자가 선택해야 적용됩니다. 모델 응답을 실행 코드로 사용하지 않습니다.

## Android 빌드

Android SDK/Gradle이 있는 환경에서 웹 자산을 복사한 뒤 빌드합니다.

```bash
npm run build
cd android
gradle assembleDebug
```

빌드 도구 기준: Android Gradle Plugin 9.4.0, Gradle 9.6.0, JDK 17, SDK API 36, Build Tools 36.0.0. 이 패키지는 Gradle wrapper 바이너리를 포함하지 않습니다. Gradle을 설치하거나 Android Studio에서 해당 Gradle 환경을 지정해야 합니다. 이번 환경에서는 Gradle/SDK가 없어 Android 컴파일을 실행하지 못했습니다.

Debug APK 예정 경로: `android/app/build/outputs/apk/debug/app-debug.apk`.

Release 서명은 기존 또는 운영자가 관리하는 keystore를 사용합니다. 새 서명 키를 자동 생성하지 않습니다. 환경변수 `HJ365_KEYSTORE`, `HJ365_STORE_PASSWORD`, `HJ365_KEY_ALIAS`, `HJ365_KEY_PASSWORD`를 설정한 뒤 `gradle assembleRelease bundleRelease`를 실행합니다. 비밀번호와 keystore를 저장소·ZIP에 넣지 마세요.

Release APK 예정 경로: `android/app/build/outputs/apk/release/app-release.apk`. AAB 예정 경로: `android/app/build/outputs/bundle/release/app-release.aab`. **이 경로에 현재 파일이 있다는 뜻은 아닙니다.**

## 검증 명령과 구조

```bash
npm test
npm run build
node tools/verify-pdf.mjs
```

`npm run build`는 웹 JavaScript 검사·비밀 키 검사·Android 웹 자산 복사를 수행합니다. Android 컴파일 명령과 구분됩니다. 자동 테스트는 provider mock을 사용하고 실제 Firebase나 유료 AI를 호출하지 않습니다.

| 경로 | 역할 |
| --- | --- |
| public/ | 반응형 화면, 업무 검증, IndexedDB, Firebase REST, PDF, 캐릭터 자산 |
| server.mjs | 로컬 HTTP 서버와 인증·승인·한도·응답 검증을 갖춘 AI 경로 |
| android/ | 같은 UI를 가상 HTTPS 호스트로 제공하는 Java WebView 앱 |
| firebase/ | 사용자별 Firestore·Storage 규칙 초안 |
| tests/ | 계산·백업·충돌·사진 원본·HTTP·PDF 자동 검사 |
| evidence/ | 독립 테스트 로그와 PDF 조립 검사 파일·렌더링 |
| ARCHITECTURE.md | 구조·데이터 모델·요구사항 분류 |

PDF는 브라우저에서 한글 화면을 래스터 이미지로 조립하므로 텍스트 검색·복사가 지원되지 않습니다. 원본 20MB/장, 사진 입력 20장/100MB, 백업 원본 100MB, 사진 보고서 50장 제한이 있습니다. Android 파일 저장은 더 작은 한도가 있어 큰 백업은 PC에서 저장해야 합니다.

로고·기능 아이콘은 프로젝트 SVG/XML 자산이고, 투명 안전모 AI 캐릭터는 생성한 PNG 자산입니다. PDF 라이브러리 라이선스는 `public/vendor/pdf-lib.LICENSE.md`에 포함했습니다. 계약은 초안, 계산서는 관련 자료 관리이며 자동 발행·전자서명·행정 제출을 수행하지 않습니다.

## 휴대폰 비공개 웹 테스트

[현장AI365 모바일 테스트](https://hyeonjang-ai365-mobile-test.ablecrab2.chatgpt.site)를 Chrome에서 엽니다. 로그인 화면이 나오면 이 사이트를 만든 동일 ChatGPT 계정으로 로그인하세요. 현장AI365용 Firebase 로그인과는 별도의 사이트 접근 확인입니다.

기록은 기본적으로 해당 브라우저에 저장됩니다. 기기 변경·다른 브라우저에서 자동으로 같은 기록이 보이지 않습니다. 설정에서 백업하거나 Firebase를 별도로 연결해야 합니다. 서버 AI는 승인된 HTTPS 서버를 연결해야 합니다. 실제 Android Chrome 동작과 APK/AAB는 검증 전입니다.
