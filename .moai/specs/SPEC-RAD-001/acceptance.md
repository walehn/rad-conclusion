---
spec_id: SPEC-RAD-001
type: acceptance-criteria
created: "2026-03-07"
updated: "2026-03-07"
---

# SPEC-RAD-001 인수 기준

## 1. 핵심 시나리오

### TC-001: TypeScript Strict Mode 검증

**Given** 프로젝트의 `tsconfig.json`이 존재할 때
**When** TypeScript 컴파일러로 빌드를 실행하면
**Then** `strict: true` 설정이 활성화되어 있고, 타입 에러 없이 빌드가 완료된다.

### TC-002: 시스템 프롬프트 보존 검증

**Given** `lib/prompts/system-prompt.ts`에 시스템 프롬프트가 정의되어 있을 때
**When** `buildSystemPrompt({ style: "numbered", lang: "en", title: "Conclusion" })`을 호출하면
**Then** 생성된 프롬프트에 다음 13개 규칙이 모두 포함되어 있다:
  - Content Rules: Synthesize, Prioritize, Actionable language, Indeterminate findings, Relevant negatives, No fabrication, No patient identifiers
  - Style Rules: Active/direct language, No filler openers, No meta-commentary, Consistent terminology, Measurements, Hedging

### TC-003: Findings -> Conclusion 생성 (정상 흐름)

**Given** 유효한 Findings 텍스트가 입력되어 있고, style은 "numbered", lang은 "en"으로 설정되어 있을 때
**When** 사용자가 Generate 버튼을 클릭하면
**Then** 시스템은 선택된 LLM API를 호출하고, Conclusion 텍스트를 스트리밍으로 화면에 표시한다.

### TC-004: 스트리밍 실시간 렌더링

**Given** Generate 요청이 서버로 전송되었을 때
**When** LLM이 토큰 단위로 응답을 반환하면
**Then** 각 토큰이 수신되는 즉시 `conclusion-output` 컴포넌트에 실시간으로 추가 렌더링된다.

### TC-005: 응답 시간 표시

**Given** Conclusion 생성이 시작되었을 때
**When** 스트리밍이 완료되면
**Then** 화면 하단에 "Elapsed: X.XXs" 형식으로 총 소요 시간이 표시된다.

### TC-006: 스타일 변경 반영

**Given** Findings 텍스트가 이미 입력되어 있을 때
**When** 사용자가 style을 "short"로 변경하고 Generate를 클릭하면
**Then** 출력이 2-4줄의 간결한 형식으로 생성된다.

### TC-007: 언어별 출력 형식

**Given** 동일한 Findings 텍스트가 입력되어 있을 때

**When** lang을 "ko"로 설정하고 생성하면
**Then** Conclusion이 한국어 의학 스타일로 작성되며, 표준 방사선학 용어(예: T2WI, SUV, CT)는 영어를 유지한다.

**When** lang을 "en"으로 설정하고 생성하면
**Then** Conclusion이 영어로만 작성된다.

**When** lang을 "mixed"로 설정하고 생성하면
**Then** Conclusion이 한국어+영어 혼합 스타일로 작성된다.

---

## 2. 보안 시나리오

### TC-008: API 키 클라이언트 비노출

**Given** 애플리케이션이 브라우저에서 실행 중일 때
**When** 브라우저 개발자 도구(Network 탭, Sources 탭)를 검사하면
**Then** LLM API 키가 어떤 클라이언트 측 코드, 응답 헤더, 또는 네트워크 요청에도 포함되지 않는다.

### TC-009: PII 비저장/비로깅

**Given** Findings 텍스트에 환자 이름이 포함된 입력이 전송되었을 때
**When** 서버 로그 및 저장소를 검사하면
**Then** 입력 텍스트나 환자 식별 정보가 서버 측 로그, 파일 시스템, 또는 데이터베이스에 저장되어 있지 않다.

### TC-010: Fabrication 방지

**Given** "Right lung 3cm nodule" 라는 단일 소견만 포함된 Findings가 입력되었을 때
**When** Conclusion을 생성하면
**Then** 출력에 입력되지 않은 소견(예: left lung 관련 소견, 간 소견 등)이 포함되지 않는다.

---

## 3. Edge Case 시나리오

### TC-011: 빈 입력 처리

**Given** Findings 텍스트 입력 필드가 비어있거나 공백만 포함할 때
**When** 사용자가 Generate 버튼을 클릭하면
**Then** 생성이 실행되지 않고, "Findings 텍스트를 입력해주세요" 와 같은 유효성 검증 메시지가 표시된다.

### TC-012: 네트워크/API 오류 처리

**Given** LLM API 서버가 응답하지 않거나 500 에러를 반환할 때
**When** 사용자가 Generate를 시도하면
**Then** 사용자에게 친화적인 에러 메시지가 표시되고, 애플리케이션이 크래시되지 않는다.

### TC-013: 대용량 Findings 입력

**Given** 10,000자를 초과하는 매우 긴 Findings 텍스트가 입력되었을 때
**When** Generate를 실행하면
**Then** 시스템이 정상적으로 처리하거나, 입력 길이 제한에 대한 안내 메시지를 표시한다.

### TC-014: 연속 생성 요청

**Given** 이전 Conclusion 생성이 아직 스트리밍 중일 때
**When** 사용자가 다시 Generate 버튼을 클릭하면
**Then** 이전 스트리밍이 중단되고 새로운 생성이 시작되거나, 생성 중에는 버튼이 비활성화된다.

---

## 4. 성능 기준

| 항목                         | 기준                                |
| ---------------------------- | ----------------------------------- |
| 첫 번째 토큰 수신 (TTFT)    | API 호출 후 3초 이내                |
| 페이지 초기 로드             | 2초 이내 (Lighthouse 기준)          |
| TypeScript 빌드              | 에러 0건, 경고 0건                  |
| 입력 유효성 검증 응답        | 100ms 이내                          |
| 스트리밍 렌더링 지연         | 토큰 수신 후 50ms 이내 화면 반영    |

---

## 5. Definition of Done

- [ ] 모든 TC-001 ~ TC-014 시나리오가 통과한다.
- [ ] `npm run build` (또는 `pnpm build`)가 에러 없이 완료된다.
- [ ] TypeScript strict mode에서 타입 에러가 0건이다.
- [ ] 기존 bash 스크립트의 시스템 프롬프트 13개 규칙이 `system-prompt.ts`에 보존되어 있다.
- [ ] API 키가 클라이언트 번들에 포함되지 않는다.
- [ ] 최소 1개 LLM provider로 end-to-end 스트리밍 테스트가 통과한다.
- [ ] 반응형 레이아웃이 데스크톱 및 모바일에서 정상 동작한다.

---

## 6. Traceability

이 문서는 `SPEC-RAD-001/spec.md`의 요구사항에 대한 인수 기준을 정의한다.
구현 계획은 `SPEC-RAD-001/plan.md`를 참조한다.
