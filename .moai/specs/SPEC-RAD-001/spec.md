---
id: SPEC-RAD-001
version: "1.0.0"
status: Planned
created: "2026-03-07"
updated: "2026-03-07"
author: Hokun Kim
priority: high
lifecycle_level: spec-first
---

## HISTORY

| 버전  | 일자       | 작성자    | 변경 내용        |
| ----- | ---------- | --------- | ---------------- |
| 1.0.0 | 2026-03-07 | Hokun Kim | 최초 SPEC 작성   |

---

# SPEC-RAD-001: Core Application - 영상의학 Conclusion 생성 웹 앱

## 1. Environment (환경)

### 1.1 프로젝트 배경

기존 bash 스크립트(`rad_conclusion.sh`)로 운영 중인 영상의학 Conclusion/Impression 생성 도구를 Next.js 기반 웹 애플리케이션으로 전환한다. 현재 스크립트는 stdin으로 Findings 텍스트를 입력받아 LLM을 통해 Conclusion을 생성하며, Gemini CLI와 로컬 OpenAI-compatible 서버 두 가지 백엔드를 지원한다.

### 1.2 기술 스택

| 기술                | 버전       | 용도                              |
| ------------------- | ---------- | --------------------------------- |
| Next.js             | 16.1.x     | App Router, Server Actions        |
| React               | 19.x       | Server Components, 클라이언트 UI  |
| TypeScript          | 5.9+       | 타입 안전성                       |
| Vercel AI SDK       | 5.x        | Multi-LLM 추상화, 스트리밍       |
| Tailwind CSS        | 4.x        | 스타일링                          |
| shadcn/ui           | latest     | UI 컴포넌트                       |
| Zod                 | 3.23+      | 입력 유효성 검증                  |

### 1.3 대상 사용자

- 영상의학과 전문의/전공의
- 의료 영상 판독 업무 담당자

---

## 2. Assumptions (가정)

- A1: 사용자는 웹 브라우저에서 애플리케이션에 접근한다.
- A2: LLM API 키는 서버 측 환경 변수로 관리되며, 클라이언트에 노출되지 않는다.
- A3: 기존 bash 스크립트의 13개 시스템 프롬프트 규칙은 그대로 보존한다.
- A4: Findings 텍스트에는 환자 식별 정보(PII)가 포함되지 않아야 한다.
- A5: Vercel AI SDK를 통해 다양한 LLM provider를 지원하며, provider 추가가 용이해야 한다.
- A6: 인증/로그인 기능은 MVP 범위에서 제외한다.

---

## 3. Requirements (요구사항)

### 3.1 Ubiquitous Requirements (항상 적용)

- **[REQ-U-001]** 시스템은 **항상** TypeScript strict mode를 사용해야 한다.
- **[REQ-U-002]** 시스템은 **항상** 기존 `rad_conclusion.sh`의 13개 시스템 프롬프트 규칙을 보존해야 한다.
  - Content Rules 7개: Synthesize, Prioritize, Actionable language, Indeterminate findings, Relevant negatives, No fabrication, No patient identifiers
  - Style/Writing Quality Rules 6개: Active/direct language, No filler openers, No meta-commentary, Consistent terminology, Measurements, Hedging

### 3.2 Event-Driven Requirements (이벤트 기반)

- **[REQ-E-001]** **WHEN** 사용자가 Findings 텍스트를 입력하고 Generate 버튼을 클릭 **THEN** 시스템은 선택된 LLM을 통해 Conclusion을 생성하여 화면에 표시한다.
- **[REQ-E-002]** **WHEN** LLM 응답이 스트리밍 중 **THEN** 시스템은 텍스트를 실시간으로 렌더링한다.
- **[REQ-E-003]** **WHEN** 생성이 완료되면 **THEN** 시스템은 응답 소요 시간을 표시한다.
- **[REQ-E-004]** **WHEN** 사용자가 다른 스타일을 선택하면 **THEN** 출력 포맷이 해당 스타일에 맞게 변경된다.

### 3.3 State-Driven Requirements (상태 기반)

- **[REQ-S-001]** **IF** style이 "numbered" **THEN** 번호 목록 형식(1., 2., 3.)으로 출력한다.
- **[REQ-S-002]** **IF** style이 "short" **THEN** 2-4줄의 간결한 형식으로 출력한다.
- **[REQ-S-003]** **IF** style이 "urgent-first" **THEN** 긴급 소견을 항목 1번에 배치한다.
- **[REQ-S-004]** **IF** lang이 "ko" **THEN** 한국어 의학 용어 스타일로 Conclusion을 작성한다 (표준 영상의학 용어는 영어 유지).
- **[REQ-S-005]** **IF** lang이 "en" **THEN** 영어로만 Conclusion을 작성한다.
- **[REQ-S-006]** **IF** lang이 "mixed" **THEN** 한국어+영어 혼합 스타일로 Conclusion을 작성한다.

### 3.4 Unwanted Requirements (금지 사항)

- **[REQ-N-001]** 시스템은 API 키를 클라이언트 측에 노출**하지 않아야 한다**.
- **[REQ-N-002]** 시스템은 환자 식별 정보(PII)를 저장하거나 로그에 기록**하지 않아야 한다**.
- **[REQ-N-003]** 시스템은 입력된 Findings에 없는 소견을 생성(fabrication)**하지 않아야 한다**.

---

## 4. Specifications (세부 사양)

### 4.1 아키텍처

```
app/
  layout.tsx              # Root layout (shadcn/ui ThemeProvider)
  page.tsx                # Main - Findings 입력 + Conclusion 출력
  api/
    generate/
      route.ts            # Vercel AI SDK 스트리밍 엔드포인트
lib/
  prompts/
    system-prompt.ts      # 기존 시스템 프롬프트 보존 (13개 규칙)
  providers/
    registry.ts           # Provider registry (multi-LLM)
  post-process.ts         # Python parser 로직 -> TypeScript 변환
components/
  findings-input.tsx      # Findings 텍스트 입력 컴포넌트
  conclusion-output.tsx   # 스트리밍 출력 표시 컴포넌트
  options-panel.tsx       # Style, lang, title 선택 패널
  model-selector.tsx      # LLM 모델/provider 선택기
```

### 4.2 시스템 프롬프트 (보존 대상)

기존 `rad_conclusion.sh`에서 추출한 시스템 프롬프트 구조:

**역할 정의**: Board-certified radiologist with subspecialty expertise in diagnostic imaging

**Content Rules (7개)**:
1. Synthesize - 소견을 임상적 의미로 변환 (단순 복사/패러프레이즈 금지)
2. Prioritize - 가장 임상적으로 중요한 소견을 먼저 배치
3. Actionable language - 후속 조치 필요 시 명시적으로 기술
4. Indeterminate findings - 특성화 불가 시 다음 단계 제안
5. Relevant negatives - 임상적으로 의미 있는 정상 소견만 포함
6. No fabrication - Findings에 없는 세부사항, 측정값, 진단 추가 금지
7. No patient identifiers - 환자 식별 정보 제외

**Style/Writing Quality Rules (6개)**:
8. Active, direct language - 능동태 사용
9. No filler openers - "In summary", "Overall" 등 불필요한 서두 금지
10. No meta-commentary - "I hope this helps" 등 자기 참조 금지
11. Consistent terminology - 동일 용어 일관 사용
12. Measurements - 정확한 수치 유지 (반올림/근사치 금지)
13. Hedging - 진정한 불확실성에만 적절한 hedging 사용

**Output Format Rules**:
- 첫 줄: `{Title}:` (markdown bold/italic 없음)
- 번호 스타일 시: `1.`, `2.`, `3.` 형식 (괄호 스타일이나 bullets 아님)
- preamble, postscript, reasoning 없음

### 4.3 API 엔드포인트

| 엔드포인트              | 메서드 | 설명                                |
| ----------------------- | ------ | ----------------------------------- |
| `/api/generate`         | POST   | Findings -> Conclusion 스트리밍 생성 |

**Request Body** (Zod 스키마):
- `findings`: string (필수, 비어있지 않음)
- `style`: "numbered" | "short" | "urgent-first" (기본값: "numbered")
- `lang`: "ko" | "en" | "mixed" (기본값: "en")
- `title`: string (기본값: "Conclusion")
- `model`: string (선택, provider별 기본 모델)
- `provider`: string (선택, 기본 provider)

**Response**: Server-Sent Events (SSE) 스트리밍

### 4.4 Traceability (추적성)

| 요구사항 ID  | 구현 파일                    | 테스트 시나리오        |
| ------------ | ---------------------------- | ---------------------- |
| REQ-U-001    | tsconfig.json                | TC-001                 |
| REQ-U-002    | lib/prompts/system-prompt.ts | TC-002                 |
| REQ-E-001    | app/api/generate/route.ts    | TC-003                 |
| REQ-E-002    | components/conclusion-output.tsx | TC-004             |
| REQ-E-003    | components/conclusion-output.tsx | TC-005             |
| REQ-E-004    | components/options-panel.tsx | TC-006                 |
| REQ-S-001~006| lib/prompts/system-prompt.ts | TC-007                 |
| REQ-N-001    | app/api/generate/route.ts    | TC-008                 |
| REQ-N-002    | 전체 시스템                  | TC-009                 |
| REQ-N-003    | lib/prompts/system-prompt.ts | TC-010                 |
