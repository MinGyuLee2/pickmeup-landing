# Pick Me Up — 랜딩페이지

차량용 픽업 앱 **픽미업(Pick Me Up)**을 소개하는 랜딩페이지입니다.

- 사이트: https://mingyulee2.github.io/pickmeup-landing/
- 서비스 기획: [MinGyuLee2/pickmeup](https://github.com/MinGyuLee2/pickmeup)

## 구성

빌드 없이 동작하는 정적 사이트입니다.

| 섹션 | 내용 |
|---|---|
| 첫 화면 | “어디쯤이야?” → “지금 나가면 돼?” → “어디서 만나?” → Pick Me Up |
| 지금의 픽업 | 기다리는 사람의 문자 대화 → 받지 않는 전화 → 픽미업 문자 한 통 (스크롤) |
| 운전자 시점 | Gleo 음성 명령과 차량 화면 속 픽미업 앱 |
| 기다리는 사람 시점 | 잠금화면 문자 → 링크 → 실시간 차량 위치 → ‘나왔어요’ |
| 세 가지 약속 · 이럴 때 픽미업 | 핵심 가치와 사용 장면 |

```
index.html   페이지
styles.css   스타일
script.js    스크롤 장면
assets/      앱 아이콘, 여의도 지도(SVG)
tools/       지도 SVG를 다시 만드는 스크립트 (tools/README.md)
```

## 로컬에서 보기

```bash
python3 -m http.server 5178
```

브라우저에서 http://localhost:5178 을 엽니다.

## 표기

- 지도 데이터 © OpenStreetMap 기여자
- 화면 속 차량 화면, Gleo 대화, 휴대전화 화면은 목표 경험을 설명하는 예시이며, 실제 연동은 검증 예정입니다.
