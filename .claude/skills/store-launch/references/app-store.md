# App Store 첫 출시 및 중단 작업 재개

작성일: 2026-11-04. Google Play 실제 사례([google-play.md](google-play.md))에서 검증한 원칙을 App Store에 옮긴 절차다. App Store 실제 등록 사례는 아직 없다. 사례를 진행하면 ShipFast `docs/release-cases/`에 기록하고 이 문서를 고친다. 규격·UI 이름은 작업 시점의 App Store Connect와 공식 문서로 다시 확인한다.

재개용 상태 구조: [app-store-release-state.example.json](../templates/app-store-release-state.example.json)

## 1. 대상 확인

- App Store Connect 앱 레코드의 이름·bundle ID·SKU와 소스의 `PRODUCT_BUNDLE_IDENTIFIER`(Flutter는 `ios/Runner.xcodeproj`)를 대조한다. extension target의 bundle ID와 혼동하지 않는다.
- 팀(Team ID), 기존 버전·빌드 번호, 준비 중인 버전, 출시 국가/지역, 가격, iPad 지원 여부(`TARGETED_DEVICE_FAMILY`)를 기록한다. iPad를 지원하면 iPad 스크린샷도 필요하다.

## 2. 빌드와 업로드

```sh
cd <selected-flutter-app>
flutter build ipa --release <project-specific-production-defines>
# 또는 xcodebuild archive / -exportArchive (프로젝트의 실제 방식 사용)
```

- 버전(`CFBundleShortVersionString`)과 빌드(`CFBundleVersion`)가 기존 업로드보다 큰지 확인한다.
- 배포 인증서·프로비저닝 프로파일이 App Store 배포용인지 확인하고, 업로드한 IPA의 크기와 SHA-256을 기록한다. 인증서 교체·폐기는 별도 결정이다.
- 업로드 수단(Xcode Organizer, Transporter, 현재 지원되는 CLI)은 작업 시점에 확인한다. 업로드 성공 메시지와 App Store Connect의 빌드 처리 완료(`Processing` 종료)를 구분한다.
- 수출 규정(암호화) 질문과 `ITSAppUsesNonExemptEncryption` 값을 실제 사용하는 암호화에 맞춘다.
- 설치 검증은 같은 빌드를 TestFlight로 실기기에 설치해 한다. 시뮬레이터 실행은 제출 빌드 실행의 증거가 아니다.

## 3. 심사 계정

Google Play와 같은 원칙이다: 기존 계정 확인 → 생성 → 최초 비밀번호 변경 → 새 비밀번호로 재로그인 → TestFlight 빌드에서 로그인·주요 메뉴 확인 → `App Review Information`의 Sign-in required에 입력 → 저장 후 재조회. 메모 글자 수와 저장 오류를 확인한다. 자격증명은 비공개 파일에만 둔다.

계정이 있는 앱은 앱 안에서 계정 삭제를 시작할 수 있어야 한다(App Review Guidelines 5.1.1(v)). 조직에서 발급한 계정만 쓰는 앱이면 그 사실과 실제 삭제 요청 경로를 확인해 기록한다. 제3자 로그인을 쓰면 4.8 요건을 확인한다.

## 4. iPhone 스크린샷

- TestFlight로 설치한 제출 빌드를 실제 iPhone에서 촬영한다. 기기 모델, iOS 버전, 앱 버전/빌드, 촬영 해상도를 기록한다. 원본은 비공개 폴더에 둔다.
- 렌더러는 Apple 분류 `iPhone with Dynamic Island (large display)`의 세로 1320×2868(기본), 1290×2796, 1260×2736과 `iPhone with Face ID (large display)`의 1284×2778, 1242×2688을 만든다. 큰 화면 세트를 올리면 다른 크기는 축소본으로 대체된다. 기기 크기별 1–10장, JPEG/PNG. ([Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications), 2026-11-04 확인)
- 같은 문서에 `iPhone Duo` 크기(외부 1398×2034, 내부 2007×2853)가 추가됐고 2027년 4월부터 iOS 27.1 SDK 이상 앱에 필수라고 적혀 있다. 렌더러는 아직 지원하지 않는다. 해당 SDK로 빌드하면 실제 기기 화면으로 별도 준비한다.
- 상태 바는 `crop`으로 제외할 수 있다. 앱 UI는 균일 배율로만 축소된다.
- iPad를 지원하면 실제 iPad에서 찍은 화면을 별도로 준비한다. iPhone 화면을 늘려 대체하지 않는다. 렌더러는 가로 캡처를 거부한다.

## 5. Product Page Header와 Search Results 이미지

공식 규격([Creative assets specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/creative-assets-specifications), 2026-11-04 확인):

| 위치 | 비율 | 해상도 | 형식 |
| --- | --- | --- | --- |
| Product page header | 21:9 | 3840×1646 | JPEG/PNG |
| Search results | 3:2 | 1920×1280 – 3840×2560 | JPEG/PNG |
| 두 위치 공용(universal) | 16:9 | 5244×2950 | PNG |

- 알파 채널·투명 영역은 허용되지 않는다. 렌더러는 출력에서 알파를 제거하고 검증한다.
- 동영상은 같은 해상도, 30/60fps, 5–30초, 반복 재생·기본 음소거다. 이 렌더러는 이미지 전용이다.
- 공용 16:9 이미지는 헤더에서 위아래(21:9, 전체 폭 5244×2247), 검색에서 좌우(3:2, 전체 높이 4425×2950)가 잘린다고 보고, 두 crop의 교집합인 중앙 4425×2247 안에 문구와 핵심 화면을 둔다. `--guides`의 `previews/universal.png`로 확인한다. 실제 iPhone/iPad/Mac 표시는 App Store Connect Preview에서 최종 확인한다.
- 헤더·검색 전용 이미지도 가운데 정렬로 만든다. 헤더는 좁은 화면에서 좌우가 더 잘릴 수 있다.

[Asset best practices](https://developer.apple.com/app-store/asset-best-practices/)의 제한:

- 가격·할인, 웹사이트 URL, 저작권 기호, 다른 플랫폼/마켓 로고, 받지 않은 수상·Apple 선정 문구를 넣지 않는다.
- 앱 등급과 무관하게 4+에 적합해야 한다.
- 한 가지 메시지, 짧은 문구. 검색 결과는 앱의 용도와 실제 UI가 한눈에 보여야 한다.
- 언어별로 현지화한다. 렌더러 설정 파일을 언어별로 하나씩 둔다.
- 검색 결과 이미지가 없으면 In-App Events, 앱 미리보기, 스크린샷이 대신 표시된다.

렌더러는 실제 캡처를 중립 휴대폰 프레임에 넣고 브랜드 배경·문구를 더한다. Apple 기기 이미지나 다른 앱의 디자인을 복제하지 않는다. 문구가 레이아웃 폭을 넘으면 실패하므로 줄이거나 줄바꿈한다.

## 6. 앱 개인정보와 선언

- App Privacy(데이터 수집 라벨)는 Google Play 데이터 보안과 같은 근거 표를 사용한다: 실제 payload, SDK 전송, release 런타임 관찰. SDK 설정이 비어 있어도 전송이 없다고 단정하지 않는다. 추적(tracking) 여부와 ATT 사용을 별도로 확인한다.
- 서드파티 SDK의 privacy manifest(`PrivacyInfo.xcprivacy`)와 required reason API 선언이 빌드에 포함됐는지 확인한다.
- 개인정보처리방침 URL, 지원 URL, 연령 등급 설문, 콘텐츠 권리, 수출 규정을 앱의 실제 기능 기준으로 작성한다. 다른 앱의 답안을 복사하지 않는다.

## 7. 제출과 재개 기록

빌드 선택 → 버전 정보·스크린샷·심사 정보 저장 → `Add for Review` → `Submit for Review`가 각각 별개 단계다. 저장 후 재조회하고 차단 메시지를 기록한다. 상태는 `prepared` → `local_verified` → `console_saved` → `submitted` → `approved` → `public`(수동 출시면 `Pending Developer Release` 구분)으로 남긴다. 리젝 시 Resolution Center 메시지 원문 요약, 가이드라인 번호, 대응을 기록한다.

## 공식 참고

- [Creative assets specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/creative-assets-specifications)
- [Manage creative assets](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-your-app-store-assets#manage-creative-assets)
- [App Store asset best practices](https://developer.apple.com/app-store/asset-best-practices/)
- [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications)
- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [App privacy details](https://developer.apple.com/app-store/app-privacy-details/)
