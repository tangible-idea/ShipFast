---
name: store-launch
description: Prepare or resume a first store release of a mobile app on Google Play and/or the Apple App Store - identify the exact app and package/bundle, verify signed builds, prepare a working review account, capture real-device screenshots, render store assets (Play phone screenshots + feature graphic; iPhone screenshots + App Store Product Page Header 21:9, Search Results 3:2 and universal 16:9 creative), fill content/privacy declarations from code evidence, and track Console/App Store Connect state through submission. Use when the user says "앱 출시", "스토어 등록", "Play Console", "App Store Connect", "심사 제출", "스크린샷 만들어", "Header and Search Results", "feature graphic", or asks to resume a release.
---

# Store launch

Shipframe에서 실제 출시 작업으로 검증한 절차다. 상세 규칙은 플랫폼 reference에 있고, 이 문서는 대상 식별·상태 확인·실행 범위·검증 기준만 정한다. 스토어 규격과 정책은 작업 시점의 Console/App Store Connect와 공식 문서로 다시 확인한다.

## References

| 언제 | 읽을 문서 |
| --- | --- |
| Google Play 작업 | [references/google-play.md](references/google-play.md) |
| App Store 작업, iPhone 스크린샷, Header/Search Results 이미지 | [references/app-store.md](references/app-store.md) |
| 실제 진행 사례와 실패 교훈 | [ShipFast `docs/release-cases/`](https://github.com/tangible-idea/ShipFast/tree/main/docs/release-cases) |
| 재개 상태 기록 | [templates/](templates/) (`*-release-state.example.json`) |

## 1. 대상과 상태를 먼저 맞춘다

1. 사용자가 지정한 앱의 소스 루트, Android `applicationId` / iOS bundle ID, 스토어 앱 레코드를 서로 대조한다. 모노레포의 고객 앱과 관리자 앱을 혼동하지 않는다.
2. 앱 저장소의 Git 제외 비공개 작업 폴더에서 이전 상태 파일을 찾는다. 없으면 템플릿을 복사해 만든다. Shipframe 저장소에는 앱별 비밀·원본 캡처를 넣지 않는다.
3. 로컬 기록이 아니라 Console/App Store Connect에 실제 저장된 값부터 다시 읽는다.

## 2. 실행 범위

- 사용자의 출시 지시에 포함된 업로드·저장·심사 제출은 그 범위에서 이어간다. 단계마다 같은 승인을 다시 묻지 않는다.
- 국가 확대, 기존 서명 키/인증서 교체, 앱 데이터 삭제가 따르는 재설치, 운영 데이터 변경은 별도 결정이다. 지시에 없으면 묻는다.
- 자격증명 오류, 불명확한 데이터 처리 사실은 추측으로 채우지 않는다.
- 심사 비밀번호·토큰·키스토어·인증서 비밀번호는 Git, 상태 문서, 스크린샷, 로그에 남기지 않는다 (권한 600 비공개 파일).

## 3. 스토어 자산 자동 생성

원본은 제출 빌드를 실기기에 설치해 찍은 화면이다. 에뮬레이터/시뮬레이터 캡처를 최종으로 대체하지 않고, 생성형 모델로 앱 UI를 그리지 않으며, 휴대폰 화면을 태블릿용으로 늘리지 않는다. 각 원본을 직접 보고 고객 정보·비밀번호·토큰이 없을 때만 `reviewedForPublicUse: true`로 바꾼다.

`<skill>`은 이 SKILL.md가 있는 폴더다. 렌더러는 `sharp`를 사용한다. `node -e "import('sharp')"`가 `<skill>`에서 실패하면 한 번 `npm install --prefix <skill>`을 실행한다.

```sh
# Google Play: phoneScreenshots/*.png 1080×1920 + featureGraphic.png 1024×500
node <skill>/scripts/render-play-assets.mjs --config <private>/play-assets.json

# App Store: iphoneScreenshots/*.png (기본 1320×2868)
#  + creative/header-3840x1646.png (21:9) + creative/search-3840x2560.png (3:2)
#  + creative/universal-5244x2950.png (16:9, 두 위치 공용). --guides는 crop 미리보기
node <skill>/scripts/render-app-store-assets.mjs --config <private>/app-store-assets.json --guides
```

설정 예시: [templates/real-device-assets.example.json](templates/real-device-assets.example.json), [templates/app-store-assets.example.json](templates/app-store-assets.example.json). 경로는 설정 파일 기준이고 같은 출력은 덮어쓴다.

렌더링 후 반드시:

1. 모든 출력 이미지를 직접 열어 글꼴, 줄 넘침, 잘린 UI, 민감정보를 확인한다. `previews/universal.png`의 빨간(헤더)·초록(검색) 영역 안에 제목과 핵심 화면이 있는지 본다.
2. `assets-manifest.json`의 크기·출처 해시를 확인한다. 스크립트는 크기와 알파 채널 없음도 검증한다.
3. 생성 완료는 스토어 등록 완료가 아니다. 업로드 → 선택/추가 → 저장 → 재조회를 각각 확인하고, App Store 헤더/검색 이미지는 App Store Connect Preview로 iPhone·iPad crop을 확인한다.

## 4. 상태 보고

상태는 `prepared` → `local_verified` → `console_saved` → `submitted` → `approved` → `public`으로 구분해 항목별로 기록한다. 로컬 준비와 스토어 저장을 같은 완료 체크로 합치지 않는다. 멈춘 항목에는 마지막 확인 시점, 실제 화면/메시지, 다음 동작을 남긴다. 심사 대기는 제출 완료와 구분해 보고한다.

새 실패 방식이나 규격 변경을 발견하면 해당 reference와 ShipFast `docs/release-cases/`에 근거와 함께 추가한다.
