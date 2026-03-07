---
spec_id: SPEC-RAD-001
type: implementation-plan
created: "2026-03-07"
updated: "2026-03-07"
---

# SPEC-RAD-001 구현 계획

## 1. 구현 전략 개요

기존 `rad_conclusion.sh` bash 스크립트를 Next.js 16 웹 애플리케이션으로 변환한다. 핵심 원칙:

- **시스템 프롬프트 보존**: 기존 13개 규칙을 `system-prompt.ts`에 그대로 이식
- **스트리밍 우선**: Vercel AI SDK의 `streamText` API를 활용한 실시간 응답
- **서버 측 보안**: API 키는 Route Handler에서만 접근, 클라이언트 노출 차단
- **점진적 구현**: 핵심 기능 먼저, 확장 기능 나중에

---

## 2. 마일스톤

### Primary Goal: 프로젝트 초기화 및 핵심 인프라

**태스크:**

- [ ] Next.js 16.1.x 프로젝트 생성 (App Router, TypeScript strict mode)
- [ ] Tailwind CSS 4.x, shadcn/ui 설정
- [ ] Vercel AI SDK 5.x, Zod 3.23+ 설치
- [ ] `tsconfig.json` strict mode 설정 확인
- [ ] 프로젝트 디렉토리 구조 생성 (`app/`, `lib/`, `components/`)
- [ ] 환경 변수 설정 (`.env.local` 템플릿)

**산출물:**
- 빌드 가능한 Next.js 프로젝트 스켈레톤
- 모든 의존성 설치 완료

### Secondary Goal: 시스템 프롬프트 및 LLM 통합

**태스크:**

- [ ] `lib/prompts/system-prompt.ts` - bash 스크립트의 시스템 프롬프트 이식
  - Content Rules 7개 보존
  - Style/Writing Quality Rules 6개 보존
  - Output Format 규칙 보존
  - Language instruction 동적 생성 (ko/en/mixed)
  - Style instruction 동적 생성 (numbered/short/urgent-first)
- [ ] `lib/providers/registry.ts` - Provider registry 구현
  - Vercel AI SDK provider 추상화
  - 환경 변수 기반 provider 구성
- [ ] `app/api/generate/route.ts` - 스트리밍 API 엔드포인트
  - Zod 기반 request body 검증
  - Vercel AI SDK `streamText` 호출
  - SSE 스트리밍 응답 반환

**산출물:**
- curl 또는 HTTP 클라이언트로 테스트 가능한 API 엔드포인트
- 기존 시스템 프롬프트와 동일한 출력 품질

### Tertiary Goal: UI 컴포넌트 구현

**태스크:**

- [ ] `components/findings-input.tsx` - Findings 텍스트 입력
  - Textarea 컴포넌트 (shadcn/ui)
  - 입력 유효성 검증 (빈 값 방지)
  - 글자 수 표시
- [ ] `components/options-panel.tsx` - 옵션 선택 패널
  - Style 선택: numbered / short / urgent-first
  - Language 선택: ko / en / mixed
  - Title 입력: 기본값 "Conclusion"
- [ ] `components/model-selector.tsx` - 모델 선택기
  - Provider 및 모델 목록 표시
  - 기본 모델 설정
- [ ] `components/conclusion-output.tsx` - 스트리밍 출력 표시
  - Vercel AI SDK `useChat` 또는 `useCompletion` hook
  - 실시간 텍스트 렌더링
  - 응답 시간 표시
  - 복사 버튼
- [ ] `app/page.tsx` - 메인 페이지 조합
  - 반응형 2-column 레이아웃 (입력 | 출력)
  - 모바일 대응 single-column 폴백

**산출물:**
- 완전히 동작하는 웹 UI
- Findings 입력 -> Conclusion 스트리밍 출력 전체 플로우

### Final Goal: 후처리 및 폴리시

**태스크:**

- [ ] `lib/post-process.ts` - Python parser 로직 TypeScript 변환
  - Title 추출 regex 로직
  - Bold markdown 제거 로직
  - `thought\n` 블록 처리 로직
- [ ] 에러 처리 UI (API 실패, 네트워크 오류, 타임아웃)
- [ ] 다크 모드 지원 (shadcn/ui ThemeProvider)
- [ ] SEO 메타데이터 설정

**산출물:**
- 프로덕션 수준의 완성된 애플리케이션

---

## 3. 기술적 접근

### 3.1 Vercel AI SDK 통합

```
// API Route (Server-side)
streamText({
  model: provider(modelId),
  system: buildSystemPrompt({ style, lang, title }),
  prompt: buildUserPrompt({ findings, title }),
  temperature: 0.3,
  topP: 0.9,
})

// Client-side
useChat({
  api: '/api/generate',
  body: { style, lang, title, model, provider },
})
```

### 3.2 시스템 프롬프트 전략

bash 스크립트의 시스템 프롬프트를 TypeScript 함수로 변환:
- `buildSystemPrompt(options)`: style, lang, title 파라미터에 따라 동적으로 프롬프트 생성
- 13개 규칙은 상수 문자열로 보존 (수정 불가)
- Language/Style instruction만 파라미터에 따라 변경

### 3.3 Provider Registry 패턴

Vercel AI SDK의 `createProviderRegistry`를 활용:
- 환경 변수 기반 provider 자동 등록
- 새 provider 추가 시 코드 변경 최소화
- 모델 목록 동적 제공

---

## 4. 리스크 분석 및 대응

| 리스크                                      | 영향도 | 대응 방안                                                   |
| ------------------------------------------- | ------ | ----------------------------------------------------------- |
| Vercel AI SDK와 특정 LLM provider 호환 이슈 | Medium | Provider registry에서 fallback 모델 설정; SDK 문서 사전 검토 |
| 시스템 프롬프트 이식 시 출력 품질 차이       | High   | bash 스크립트 출력과 웹 앱 출력 비교 테스트; A/B 검증       |
| 스트리밍 응답의 후처리 타이밍 이슈           | Medium | 스트리밍 완료 후 후처리 적용; 또는 서버 측 transform stream  |
| 대용량 Findings 텍스트 입력 시 토큰 초과     | Low    | 입력 길이 제한 안내; max_tokens 설정 노출                   |
| API 키 클라이언트 유출                       | High   | Route Handler에서만 접근; .env.local 패턴 강제              |

---

## 5. 의존성

- `rad_conclusion.sh`: 시스템 프롬프트 원본 (보존 대상)
- LLM API 접근: 최소 1개 provider의 API 키 필요
- Node.js 20+ 런타임

---

## 6. Traceability

이 문서는 `SPEC-RAD-001/spec.md`의 요구사항을 구현하기 위한 계획이다.
검증 기준은 `SPEC-RAD-001/acceptance.md`에 정의한다.
