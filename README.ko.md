<h1 align="center">Rad Conclusion</h1>

<p align="center">
  <strong>AI 기반 방사선 보고서 생성기</strong>
</p>

<p align="center">
  <a href="./README.md">English</a> ·
  <a href="./README.ko.md">한국어</a>
</p>

<p align="center">
  <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-15-black?style=flat&logo=next.js" alt="Next.js"></a>
  <a href="https://react.dev"><img src="https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=white" alt="React"></a>
  <a href="https://tailwindcss.com"><img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat&logo=tailwindcss&logoColor=white" alt="Tailwind CSS"></a>
  <a href="https://sdk.vercel.ai"><img src="https://img.shields.io/badge/Vercel_AI_SDK-4-000?style=flat&logo=vercel" alt="AI SDK"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License: MIT"></a>
</p>

---

두 가지 도구를 제공하는 브라우저 기반 방사선 AI 어시스턴트입니다. **결론 생성기**는 Findings 텍스트를 실시간 스트리밍으로 임상적으로 자연스러운 Impression 문장으로 변환하며, **구조화 보고서 생성기**는 SAR §3.3 형식에 따라 질환별(현재 RCC) 구조화 보고서를 생성합니다. 4개의 LLM 제공자를 지원합니다.

## 주요 기능

- **실시간 스트리밍 생성** — LLM 응답을 토큰 단위로 스트리밍 출력
- **결론 생성기** — V1(기본)과 V2(Dx/DDx 포함) 프롬프트를 나란히 비교하는 A/B 비교 모드 및 투표 기능
- **LLM-as-Judge 평가** — 생성된 결론의 품질을 자동 점수화
- **구조화 보고서 생성기** — 질환별(RCC) 구조화 입력 폼, SAR §3.3 직렬화; 자유 텍스트와 RCC 구조화 입력 간 탭 전환
- **질환 대시보드** — 루트(`/`)에 기능 선택 카드 레이아웃; 결론 생성기는 `/conclusion`으로 이동
- **공통 네비게이션 바** — 인증된 모든 페이지에 걸쳐 표시되는 고정 네비게이션
- **4개 LLM 제공자 지원** — 로컬 LLM, OpenAI, Anthropic, Google AI
- **세션 기반 인증** — 이메일/비밀번호 로그인, 서버 사이드 세션 관리 및 CSRF 보호
- **다크/라이트 모드** — 의료 전문가용 틸(teal) 컬러 테마
- **출력 스타일 선택** — Numbered, Short, Urgent-First
- **다국어 출력** — 영어, 한국어, 혼용 모드
- **Docker 배포** — 로컬 LLM 접근을 위한 host 네트워크 모드 지원
- **Settings 페이지** — 제공자별 API 키 관리 및 연결 테스트

## 지원 LLM 제공자

| 제공자 | 모델 | 비고 |
|--------|------|------|
| **Local LLM** | Qwen3.6 35B (A3B-FP8) | OpenAI 호환 API (예: vLLM), 기본 호스트 `localhost:8080` |
| **OpenAI** | gpt-4o, gpt-4o-mini, gpt-4.1 | API 키 필요 |
| **Anthropic** | Claude Sonnet 4, Claude Opus 4, Claude Haiku 4 | API 키 필요 |
| **Google AI** | Gemini 2.5 Flash, Gemini 2.5 Flash-Lite, Gemini 2.5 Pro, Gemini 3 Flash (Preview), Gemini 3.1 Flash-Lite (Preview) | API 키 필요 |

## 시작하기

### 설치

```bash
git clone https://github.com/walehn/rad-conclusion.git
cd rad-conclusion
npm install
```

### 개발 서버

```bash
npm run dev
# http://localhost:3957
```

### 프로덕션 빌드 (Docker)

```bash
docker compose up -d --build
# http://localhost:3957
```

### 프로덕션 빌드 (수동)

```bash
npm run build
npm run start
# http://localhost:3957
```

## 설정

### 환경변수

`.env.local` 파일을 생성하여 서버 측 환경변수를 설정할 수 있습니다. 또는 Settings 페이지에서 브라우저 로컬로 API 키를 관리할 수도 있습니다.

```bash
# 로컬 LLM (OpenAI 호환 서버)
RAD_LOCAL_HOST=http://localhost:8080
RAD_LOCAL_MODEL=Qwen/Qwen3.6-35B-A3B-FP8

# 상용 제공자 API 키 (선택)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=AI...
```

### 출력 스타일

| 스타일 | 설명 |
|--------|------|
| **Numbered** | 번호형 Impression 목록 (1., 2., 3.), 임상적 우선순위 순 |
| **Short** | 2–4줄 이내 간결한 요약 |
| **Urgent-First** | 긴급/중증 소견을 1번으로 먼저 출력 |

### 출력 언어

| 언어 | 설명 |
|------|------|
| **English** | 영어 전용 (공식 방사선 보고서 스타일) |
| **Korean** | 한국어 주체, 표준 방사선 용어는 영어 유지 |
| **Mixed** | Findings 톤에 맞춘 한국어+영어 혼용 |

## 프로젝트 구조

```
rad-conclusion/
├── app/
│   ├── api/
│   │   ├── generate/          # 결론 생성 스트리밍 API
│   │   ├── evaluate/          # LLM-as-Judge 평가 API
│   │   ├── vote/              # A/B 투표 수집 API
│   │   ├── auth/              # 로그인/로그아웃 API
│   │   ├── providers/         # 제공자 목록 및 유효성 검증 API
│   │   └── structured-report/ # 구조화 보고서 스트리밍 API
│   ├── conclusion/            # 결론 생성기 페이지
│   ├── structured-report/     # 구조화 보고서 생성기 페이지
│   ├── dashboard-cards.tsx    # 기능 선택 카드 컴포넌트
│   ├── login/                 # 로그인 페이지
│   ├── settings/              # 제공자 설정 페이지
│   ├── page.tsx               # 대시보드 (기능 선택)
│   ├── layout.tsx             # 루트 레이아웃
│   └── globals.css            # 테마 정의
├── components/
│   ├── ui/                    # 기본 UI 컴포넌트
│   ├── settings/              # Settings 페이지 컴포넌트
│   ├── app-nav.tsx            # 공통 고정 네비게이션 바
│   ├── disease-category-indicator.tsx  # 질환 카테고리 배지 (pill/overline)
│   ├── rcc-structured-form.tsx         # RCC 14개 필드 구조화 입력 폼
│   ├── tabbed-findings-input.tsx       # 탭 전환: 자유 텍스트 | RCC 구조화
│   ├── structured-report-output.tsx    # 6섹션 스트리밍 출력
│   ├── findings-input.tsx     # 자유 텍스트 Findings 입력 필드
│   ├── conclusion-output.tsx  # 결론 출력 영역
│   ├── model-selector.tsx     # 제공자/모델 선택
│   ├── options-panel.tsx      # 스타일/언어 설정
│   └── theme-toggle.tsx       # 다크/라이트 모드 전환
├── lib/
│   ├── auth/                  # 세션 관리, CSRF, 인증 가드
│   ├── providers/             # LLM 제공자 레지스트리 및 설정
│   ├── prompts/               # 구조화 보고서 프롬프트 + 질환 레지스트리
│   │   └── disease-templates/ # RCC 필드 enum + SAR §3.3 직렬화
│   ├── storage/               # 암호화 API 키 저장소
│   └── post-process.ts        # LLM 출력 후처리
├── middleware.ts               # IP 허용 목록 접근 제어
├── docker-compose.yml         # Docker 배포 설정
├── Dockerfile                 # 멀티스테이지 프로덕션 빌드
└── package.json
```

## 기술 스택

| 분류 | 기술 |
|------|------|
| 프레임워크 | Next.js 15, React 19 |
| 스타일링 | Tailwind CSS 4 |
| AI/LLM | Vercel AI SDK 4 |
| 제공자 SDK | @ai-sdk/openai, @ai-sdk/anthropic, @ai-sdk/google |
| 언어 | TypeScript 5.8 |
| 유효성 검증 | Zod |
| UI | shadcn/ui 스타일 커스텀 컴포넌트, Lucide React |

## 개발 도구

이 프로젝트는 [Claude Code](https://claude.ai/claude-code)와 [MoAI-ADK](https://github.com/modu-ai/moai-adk) (Agentic Development Kit for Claude Code)를 사용하여 개발되었습니다.

## 주의사항

- 로컬 LLM 사용 시 OpenAI 호환 서버(`/v1/chat/completions`)가 실행 중이어야 합니다
- Docker 배포 시 로컬 LLM 접근을 위해 `network_mode: host`를 사용합니다
- API 키는 서버 환경변수(Docker) 또는 Settings 페이지(브라우저)로 관리합니다
- 인증은 서버 사이드 세션과 CSRF 이중 쿠키 방식으로 동작합니다. `.env.local`에 `AUTH_EMAIL`과 `AUTH_PASSWORD_HASH`를 설정하세요
- 입력에 환자 식별 정보(PII)를 포함하지 마세요

## 라이선스

MIT
