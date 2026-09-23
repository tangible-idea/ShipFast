# Shipframe

GitHub 저장소를 연결해 첫 스토어 출시를 준비하는 로컬 웹 서비스입니다. Flutter 저장소의 기존 스토어 스크린샷을 찾아 iPhone, iPad, Android phone, Android tablet별로 점검합니다. 발견된 실제 화면을 스토어 크기로 정리하고 로고 시안, 개인정보처리방침 초안을 ZIP으로 내보냅니다.

## 실행

```bash
npm install
cp .env.example .env
# .env에 GitHub OAuth Client ID, Client Secret, SESSION_SECRET, POE_API_KEY 입력
npm start
```

브라우저에서 `http://localhost:4321`을 엽니다. GitHub OAuth 앱의 Homepage URL은 `http://localhost:4321`, Authorization callback URL은 `http://localhost:4321/auth/github/callback`로 설정합니다. 비공개 저장소 접근을 위해 OAuth `repo` 범위를 요청합니다. Poe API 키는 [Poe API Keys](https://poe.com/api/keys)에서 발급받습니다. 아이콘 시안 3개를 생성할 때 Poe 포인트가 사용됩니다. 운영 환경에서는 HTTPS `BASE_URL`, 영속 세션 저장소, 토큰 암호화와 GitHub App의 세분화된 권한으로 전환해야 합니다.

## 자동화 범위

- GitHub OAuth 로그인, 접근 가능한 저장소 선택, 소스 파일 및 스크린샷 인벤토리 분석
- `store/.../screenshots/` 등의 기존 실제 화면을 찾아 휴대폰/태블릿으로 분류
- 비율이 맞는 화면만 기기별 PNG로 크기 변환, 잘못된 비율은 누락으로 기록
- 소스에서 아이콘 테마와 대표색을 찾고, 없으면 사용자에게 입력 요청
- Poe Nano-Banana-2-Lite로 아이콘 시안 3개 생성 후 선택; iOS용 1024px PNG와 Google Play용 512px PNG 제작. GitHub 연결 없이도 테마와 컬러를 직접 입력해 아이콘 ZIP을 받을 수 있습니다.
- 입력한 실제 데이터 처리 정보를 이용한 한국어 개인정보처리방침 초안 제작
- 기기별 결과와 누락 항목을 포함한 ZIP 다운로드

Flutter 저장소에 `test/store/store_screenshots_test.dart`가 있다면 분석 결과에 표시합니다. 이 버전은 타인의 저장소 코드를 서버에서 실행하지 않습니다. 원본 화면이 없다면 앱의 스크린샷 테스트를 실행하거나 기기에서 캡처한 뒤 저장소에 추가해야 합니다. 태블릿 이미지는 실제 태블릿 화면이어야 하며 휴대폰 화면을 늘려 대체하지 않습니다.

개인정보처리방침은 법률 검토가 끝난 문서가 아닙니다. 실제 SDK, 데이터 흐름, 보관 기간과 스토어 데이터 공개 항목을 확인하고 공개 URL에 게시해야 합니다.

## Languages

The interface opens in English by default. Use the language selector to switch to Japanese or Korean; the choice is saved in the browser. The downloaded privacy draft and launch-kit README follow the selected language (`PRIVACY.en.md`, `PRIVACY.ja.md`, or `PRIVACY.ko.md`).
