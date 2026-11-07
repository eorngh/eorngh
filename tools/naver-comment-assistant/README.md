# 현장 | 명지대장 — AI 댓글비서 v1.0

Ollama 없이 GPT-6 Luna, Gemini 2.5 Flash-Lite, 또는 수동 복사모드 중 하나로 댓글 초안을 만듭니다.

## 기능

- 내 네이버 블로그 방문자 댓글에 남길 답글 초안 생성
- 이웃 블로그의 실제 글 내용에 맞춘 방문 댓글 초안
- 분류 → 맞춤 작성 → 표현 검수의 3역할을 한 번의 AI 요청으로 처리
- 중복 등록 방지, 답글 수정, 복사, 게시완료 표시
- 검토용 Markdown 파일 출력
- Windows 작업 스케줄러에서 하루 1회, 최대 1~10건 초안 생성
- 네이버 사이트 자동 로그인, 무단 글 수집, 댓글 자동 등록 기능 없음

## Windows 설치 (Python 3.10 이상)

1. Python 공식 홈페이지 https://www.python.org/downloads/windows/ 에서 Python 3을 설치합니다.
2. GitHub 개발 브랜치 feature/naver-comment-assistant-gpt-gemini 의 ZIP을 다운로드하고 원하는 PC 폴더에 압축을 해제합니다.
3. tools/naver-comment-assistant 폴더에서 start_windows.bat 파일을 더블클릭합니다.
4. 내 블로그 답글 또는 이웃 글 댓글 유형을 선택하고 댓글 원문 또는 게시글 내용을 직접 붙여 넣습니다.
5. 대기열에 추가 → 항목 선택 → AI 초안 생성 → 검토 및 수정 → 복사 순서로 진행합니다.
6. 네이버 사이트에 직접 댓글을 게시한 후 프로그램에서 게시완료 표시를 선택합니다.

설치할 Python 패키지는 없습니다. Python 기본 라이브러리로 작동합니다.

## AI 모드

### manual (기본값)

API 키가 필요 없습니다. 프로그램이 만든 프롬프트를 ChatGPT 또는 Gemini 웹에 복사해 넣고, 생성된 답글을 다시 프로그램에 붙여 넣어 검수합니다. 이 모드에서는 Windows 예약 실행 때도 프롬프트만 준비합니다.

### Gemini API

1. Google AI Studio https://aistudio.google.com/apikey 에서 API 키를 발급받습니다.
2. Windows 시작 메뉴에서 '환경 변수 편집'을 열고 사용자 변수 GEMINI_API_KEY를 추가합니다.
3. 프로그램을 완전히 종료하고 재실행합니다.
4. AI 방식에서 gemini를 선택하고 저장합니다.
5. 기본 모델은 gemini-2.5-flash-lite입니다. 무료 등급 여부 및 한도는 계정 설정과 정책에 따릅니다.

무료 Gemini API 등급에는 제공한 콘텐츠가 제품 개선에 사용될 수 있는 조건이 있습니다. 비공개 개인정보를 입력하지 마세요.

### OpenAI GPT API

1. https://platform.openai.com/api-keys 에서 키를 발급받습니다.
2. Windows 사용자 환경 변수 OPENAI_API_KEY를 추가하고 프로그램을 새로 실행합니다.
3. AI 방식에서 gpt를 선택하고 저장합니다.
4. 기본 모델은 저비용 gpt-6-luna입니다.

ChatGPT 유료 구독과 API 요금은 별도입니다. API 사용 한도를 플랫폼에서 설정하세요.

## 하루 한 번 예약

1. setup_schedule_windows.bat 파일을 실행합니다.
2. 원하는 시각을 HH:mm 형식으로 입력합니다. 기본값은 09:30입니다.
3. Windows 작업 스케줄러에서 NaverBlogCommentAssistantDrafts 작업 생성 여부를 확인합니다.
4. 예약 시각에 대기열에 들어 있는 원문만 최대 설정 건수만큼 처리합니다.
5. 결과 위치: 사용자 폴더 아래 CommentAssistantData/exports/drafts_날짜.md

중요: 네이버 댓글을 자동으로 가져오는 기능은 없습니다. 원문은 사용자가 직접 대기열에 추가해야 합니다. PC가 꺼져 있거나 API 키·인터넷 환경이 준비되지 않으면 예약 작업이 실패할 수 있습니다.

## 개인정보·안전

- 댓글 데이터는 PC의 사용자 폴더 CommentAssistantData에 SQLite로 저장합니다.
- API 키는 소스 또는 GitHub 저장소에 저장하지 않습니다.
- 이메일과 휴대전화 번호 형태는 AI 전송 전에 일부 가리지만 다른 식별정보는 직접 제거하세요.
- 이웃에게 의미 없는 반복 댓글을 보내거나, 서이추를 강요하는 댓글을 만들지 않습니다.
- AI가 작성한 문구는 검수 후 직접 네이버에 게시해야 합니다.
- 승인되지 않은 네이버 자동수집·자동게시·우회접속을 구현하지 않았습니다.

## 테스트

Windows 명령 프롬프트에서 아래 명령을 사용합니다.

    py -3 -m unittest discover -s tests -v
    py -3 comment_assistant.py
    py -3 comment_assistant.py --daily

참고:
- https://developers.openai.com/api/reference/resources/responses/methods/create
- https://ai.google.dev/api
- https://ai.google.dev/gemini-api/docs/pricing
- https://policy.naver.com/policy/service_group.html

네이버와 제휴한 프로그램이 아니며, 실제 댓글 게시를 자동 수행하지 않습니다.
