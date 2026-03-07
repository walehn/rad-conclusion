<h1 align="center">Rad Conclusion</h1>

<p align="center">
  <strong>AI 기반 방사선 판독 결론 생성기</strong>
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

방사선 판독 소견(**Findings**) 텍스트를 입력하면, 임상적으로 자연스러운 **Conclusion/Impression**을 실시간 스트리밍으로 생성합니다. 4개의 LLM 제공자를 지원하며, 브라우저 기반 웹 애플리케이션으로 어디서든 사용할 수 있습니다.

## 주요 기능

- **실시간 스트리밍 생성** — LLM 응답을 토큰 단위로 스트리밍 출력
- **4개 LLM 제공자 지원** — 로컬 LLM, OpenAI, Anthropic, Google AI
- **다크/라이트 모드** — 의료 전문가용 틸(teal) 컬러 테마
- **암호화 API 키 저장** — AES-GCM 암호화로 브라우저 로컬 저장 (서버 전송 없음)
- **출력 스타일 선택** — Numbered, Short, Urgent-First
- **다국어 출력** — 영어, 한국어, 혼용 모드
- **Settings 페이지** — 제공자별 API 키 관리 및 연결 테스트

## 지원 LLM 제공자

| 제공자 | 모델 | 비고 |
|--------|------|------|
| **Local LLM** | gpt-oss-120b | OpenAI 호환 API, 기본 호스트 `localhost:5100` |
| **OpenAI** | gpt-4o, gpt-4o-mini, gpt-4.1 | API 키 필요 |
| **Anthropic** | Claude Sonnet 4, Claude Opus 4 | API 키 필요 |
| **Google AI** | Gemini 2.5 Flash, Gemini 2.5 Pro | API 키 필요 |

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

### 프로덕션 빌드

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
RAD_LOCAL_HOST=http://localhost:5100
RAD_LOCAL_MODEL=gpt-oss-120b

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
│   │   ├── generate/          # LLM 스트리밍 API 엔드포인트
│   │   └── providers/         # 제공자 목록 및 유효성 검증 API
│   ├── settings/              # 제공자 설정 페이지
│   ├── page.tsx               # 메인 페이지
│   ├── layout.tsx             # 루트 레이아웃
│   └── globals.css            # 테마 정의
├── components/
│   ├── ui/                    # 기본 UI 컴포넌트 (Button, Card, Input 등)
│   ├── settings/              # Settings 페이지 컴포넌트
│   ├── findings-input.tsx     # Findings 입력 필드
│   ├── conclusion-output.tsx  # 결론 출력 영역
│   ├── model-selector.tsx     # 제공자/모델 선택
│   ├── options-panel.tsx      # 스타일/언어 설정
│   └── theme-toggle.tsx       # 다크/라이트 모드 전환
├── lib/
│   ├── providers/             # LLM 제공자 레지스트리 및 설정
│   ├── prompts/               # 시스템 프롬프트 빌더
│   ├── storage/               # 암호화 API 키 저장소
│   └── post-process.ts        # LLM 출력 후처리
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

## 주의사항

- 로컬 LLM 사용 시 OpenAI 호환 서버(`/v1/chat/completions`)가 실행 중이어야 합니다
- API 키는 AES-GCM으로 암호화되어 브라우저 로컬에만 저장됩니다
- 탭을 닫으면 암호화 키가 소멸되어 API 키 재입력이 필요합니다
- 입력에 환자 식별 정보(PII)를 포함하지 마세요

## 라이선스

MIT
