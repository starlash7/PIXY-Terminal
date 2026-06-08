# CLAUDE.md

## 이게 뭐하는 프로젝트
PIXY TERMINAL은 Hermes Agent의 채팅, 메모리, 세션, 스킬 실행 상태를 보여주는 로컬 FastAPI + Next.js 터미널 셸입니다.

## 폴더 구조
- `frontend/`: Next.js app router, API proxy routes, chat/dashboard/skills UI
- `frontend/components/`: 화면 단위 컴포넌트와 공용 UI 컴포넌트
- `frontend/lib/`: API client, 타입, derived UI state helper
- `server/`: Hermes 런타임과 디스크 상태를 감싸는 FastAPI 백엔드
- `server/app/`: API 앱 조립, 요청/응답 스키마, 런타임, 메모리, 세션, 스킬 로직
- `design/`: 로고, 프리뷰 이미지, 화면 설계 메모
- `.context/`: Conductor 작업 메모와 첨부 파일

## 절대 하지 말 것
- API 키, 모델 토큰, 개인 Hermes 설정을 코드에 하드코딩하지 말 것
- README.md는 최신 문서이므로 정리 작업에서 임의 수정하지 말 것
- FastAPI 라우트 안에 긴 비즈니스 로직을 다시 넣지 말 것
- 한 함수에 여러 역할을 섞지 말고 런타임, 메모리, 세션, 스킬 모듈로 분리할 것
- Hermes가 없을 때 조용히 실패시키지 말고 simulator/fallback 상태를 명시할 것

## 실행
- Backend: `cd server && uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`
- Frontend: `cd frontend && npm run dev -- --hostname 127.0.0.1 --port 3000`

## 확인
- Backend compile: `cd server && python -m compileall app`
- Frontend lint: `cd frontend && npm run lint`
- Frontend build: `cd frontend && npm run build`
