# PIXY TERMINAL — Plan v1.0
> Hermes Agent 기반 개인 성장형 AI 비서 터미널
> Hermes Hackathon 제출 (3/16) → Bags Hackathon 확장 (Q1)

---

## 1. 프로젝트 개요

### 한줄 정의
쓸수록 나를 알아가는 개인 AI 비서 터미널.
Hermes Agent의 CLI를 멋진 웹 대시보드로 감싼 것.

### 왜 만드나
- Hermes Agent는 강력하지만 UI가 터미널이라 일반인이 쓰기 어려움
- 나(Theo)의 Unit TX 업무 + 개인 아이디어 탐색을 하나의 공간에서 관리하고 싶음
- 해커톤 제출 + 실제로 매일 쓸 툴

### 타겟 유저
- 1차: Theo 본인 (Unit TX 업무 자동화)
- 2차: Web3 마케터 / 1인 에이전시 운영자
- 3차: Bags 해커톤용 → 크리에이터/빌더

---

## 2. 핵심 컨셉

### "함께 성장하는 에이전트"
일반 AI 챗봇과의 차이:
```
챗봇: 매번 처음부터 시작
PIXY TERMINAL: 쌓인 스킬과 기억으로 점점 더 나를 잘 앎
```

### 3가지 핵심 가치
1. **Memory** — 대화가 쌓일수록 컨텍스트 자동 학습
2. **Automation** — 반복 태스크를 스케줄로 자동 실행
3. **Anywhere** — Telegram/Slack으로 외부에서도 명령

---

## 3. 기술 스택

### 프론트엔드
- **Framework**: Next.js 14 (App Router)
- **UI**: Tailwind CSS + shadcn/ui
- **Design Tool**: Pencil.dev (Claude Code MCP 연동)
- **Font**: Geist (Vercel) or JetBrains Mono (터미널 감성)

### 백엔드
- **Agent Core**: Hermes Agent (로컬 서버)
- **API Layer**: Next.js API Routes → Hermes Agent 브릿지
- **DB**: SQLite (Hermes 기본 제공 ~/.hermes/state.db)
- **Model**: Hermes 4 70B (OpenRouter) or Claude Sonnet

### 외부 연동
- Telegram Bot API
- Slack Webhook
- Web Search (Hermes 내장)

### 배포
- Vercel (프론트)
- Railway or Fly.io (Hermes Agent 서버)

---

## 4. 화면 구성 (UI/UX)

### 전체 레이아웃
```
┌─────────────────────────────────────────────────┐
│  PIXY TERMINAL          [●] Live  [@0x_pixy7]   │
├──────────┬──────────────────────────┬────────────┤
│          │                          │            │
│ SIDEBAR  │    MAIN CHAT AREA        │  CONTEXT   │
│          │                          │  PANEL     │
│ - Today  │  ┌──────────────────┐   │            │
│ - Skills │  │ Hermes response  │   │ Skills     │
│ - Memory │  └──────────────────┘   │ Memory     │
│ - Tasks  │                          │ Active     │
│          │  [입력창_____________]   │ Tasks      │
│          │                          │            │
└──────────┴──────────────────────────┴────────────┘
```

### 페이지/화면 목록

**① Home Dashboard**
- 오늘의 브리핑 카드 (Web3 뉴스 3개)
- 활성 태스크 현황
- 최근 대화 요약
- Skill 성장 그래프 (쓸수록 올라가는 시각화)

**② Chat Interface**
- Claude Code / ChatGPT 느낌의 클린한 대화창
- 메시지별 "어떤 스킬 사용했는지" 태그 표시
- 코드블록, 마크다운 렌더링
- 대화 검색 기능

**③ Skills & Memory**
- Hermes가 학습한 스킬 목록 카드뷰
- 각 스킬 사용 횟수 / 마지막 사용일
- 메모리 키워드 클라우드
- 스킬 직접 추가/편집

**④ Tasks (Automation)**
- 스케줄 태스크 등록 (매일 아침 브리핑 등)
- 태스크 실행 로그
- 다음 실행 시간 카운트다운

**⑤ Integrations**
- Telegram 연결 상태
- Slack 연결 상태
- 모델 선택 (Hermes 4 / Claude / GPT)

---

## 5. 핵심 기능 (MVP — 3/16까지)

### Must Have (해커톤 필수)
```
✓ 웹에서 Hermes Agent와 대화
✓ 대화 히스토리 저장 및 표시
✓ Skill 학습 현황 시각화
✓ 오늘의 브리핑 (Web3 뉴스 자동 요약)
✓ Telegram 연동 (메시지 → Hermes → 응답)
```

### Nice to Have (시간 되면)
```
○ 스케줄 태스크 등록
○ 메모리 키워드 시각화
○ 다크/라이트 모드
○ 모바일 반응형
```

### Phase 2 (Bags 해커톤용, 3/16 이후)
```
○ Bags API 연동
○ 토큰 런치 자동화 어시스턴트
○ 온체인 퍼포먼스 대시보드
○ 크리에이터 수익 추적
```

---

## 6. 디자인 방향

### 무드
- **Dark mode 기본** (터미널 감성 + 모던)
- 색상: 딥 다크 배경 + 네온 그린/퍼플 액센트
- 레퍼런스: Linear.app + Vercel Dashboard + Arc Browser

### Pencil.dev 활용 계획
```
Step 1: Pencil.dev에서 각 화면 와이어프레임 스케치
Step 2: Claude Code MCP 연결
Step 3: "이 디자인을 Next.js + Tailwind로 변환해줘"
Step 4: shadcn/ui 컴포넌트로 정제
```

### 핵심 UI 원칙
- 정보 밀도 높지만 깔끔하게 (Linear 스타일)
- 불필요한 클릭 최소화
- 로딩 상태 항상 표시 (Hermes 처리 중 애니메이션)
- 에러는 친절하게 (빨간 경고 말고 부드럽게)

---

## 7. 10일 개발 타임라인

```
Day 1 (3/7)   : Hermes Agent 로컬 설치 + API 연결 테스트
Day 2 (3/8)   : Pencil.dev로 전체 UI 와이어프레임 제작
Day 3 (3/9)   : Next.js 프로젝트 세팅 + 기본 레이아웃
Day 4 (3/10)  : Chat Interface 구현 (Hermes 연결)
Day 5 (3/11)  : Dashboard + 브리핑 기능
Day 6 (3/12)  : Skills & Memory 시각화
Day 7 (3/13)  : Telegram 연동
Day 8 (3/14)  : 전체 UI 다듬기 + 버그 수정
Day 9 (3/15)  : 데모 영상 촬영 + writeup 작성
Day 10 (3/16) : 제출 (트윗 + Discord)
```

---

## 8. 해커톤 제출 전략

### Hermes 해커톤 (3/16)
```
제출물:
- 데모 영상 (2~3분)
  → Hermes가 실제로 스킬 학습하는 장면
  → Telegram에서 명령 → 웹에서 결과 보이는 장면
  → Before(CLI) vs After(PIXY TERMINAL) 비교

- Writeup 핵심 메시지:
  "Hermes Agent를 처음 쓰는 사람도 쓸 수 있게.
   CLI의 강력함을 웹의 아름다움으로."

- 트윗 태그: @NousResearch
```

### 심사 기준 대응
```
창의성  → CLI → 웹 대시보드, 성장 시각화 아이디어
유용성  → 실제 Unit TX 업무에서 매일 씀
프레젠테이션 → Pencil.dev로 만든 깔끔한 UI
```

---

## 9. 리스크 & 대응

| 리스크 | 가능성 | 대응 |
|--------|--------|------|
| Hermes Agent API 문서 부족 | 중 | GitHub 이슈 + Discord 질문 |
| 10일 내 완성 못함 | 중 | Day 8에 MVP만 제출 결정 |
| Hermes 서버 배포 복잡 | 고 | 로컬 데모로 대체 |
| Pencil.dev 러닝커브 | 저 | 무료 + Claude MCP 연동 단순 |

---

## 10. 성공 기준

### Hermes 해커톤
- 데모 영상 완성 ✓
- 실제로 Hermes와 웹에서 대화 되는 것 ✓
- 트윗 + Discord 제출 ✓

### 그 이후
- 매일 본인이 실제로 씀
- Bags 해커톤 제출
- Unit TX 팀원도 사용
