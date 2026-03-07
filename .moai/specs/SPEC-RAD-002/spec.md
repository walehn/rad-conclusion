---
id: SPEC-RAD-002
version: 1.0.0
status: Planned
created: 2026-03-07
updated: 2026-03-07
author: Hokun Kim
priority: medium
lifecycle_level: spec-first
---

## HISTORY

| 버전  | 날짜       | 작성자    | 변경 내용       |
| ----- | ---------- | --------- | --------------- |
| 1.0.0 | 2026-03-07 | Hokun Kim | 최초 SPEC 작성  |

---

# SPEC-RAD-002: Provider Settings - LLM 프로바이더 관리 시스템

## 1. Environment (환경)

### 1.1 기술 스택

| 기술           | 버전      | 용도                        |
| -------------- | --------- | --------------------------- |
| Next.js        | 16.1.x    | App Router 기반 웹 프레임워크 |
| React          | 19.x      | UI 라이브러리               |
| TypeScript     | 5.9+      | 타입 안전성                 |
| Tailwind CSS   | 4.x       | 스타일링                    |
| shadcn/ui      | latest    | UI 컴포넌트 라이브러리      |
| Zod            | 3.23+     | 스키마 검증                 |

### 1.2 지원 프로바이더

| Provider                  | Models                          | 비고              |
| ------------------------- | ------------------------------- | ----------------- |
| Local (OpenAI compatible) | gpt-oss-120b, custom            | Host URL 필요     |
| OpenAI                    | gpt-4o, gpt-4-turbo             | API key 필요      |
| Anthropic                 | claude-4-sonnet, claude-4-opus  | API key 필요      |
| Google                    | gemini-2.5-pro, gemini-2.5-flash| API key 필요      |

### 1.3 의존성

- SPEC-RAD-001의 Provider Registry (`lib/providers/registry.ts`)와 공유
- SPEC-RAD-001의 Provider 타입 정의 (`lib/providers/types.ts`)와 공유

---

## 2. Assumptions (가정)

- A1: 사용자는 하나 이상의 LLM 프로바이더를 사용한다.
- A2: API 키는 클라이언트 측 Local Storage에 암호화하여 저장한다 (서버 전송 없음).
- A3: API 키 검증은 각 프로바이더의 공식 API 엔드포인트에 테스트 요청을 보내는 방식이다.
- A4: Local 프로바이더는 OpenAI 호환 API를 사용하며, Host URL이 필수이다.
- A5: 프로바이더 활성화/비활성화 상태는 메인 페이지의 모델 선택기에 즉시 반영된다.
- A6: Provider Registry는 SPEC-RAD-001에서 이미 구현되어 있거나, 동시 개발 시 인터페이스가 합의된다.

---

## 3. Requirements (요구사항)

### 3.1 Event-Driven 요구사항 (WHEN/THEN)

- **REQ-E01**: **WHEN** 사용자가 Settings 페이지에서 API 키를 입력 **THEN** 시스템은 해당 키를 암호화하여 Local Storage에 저장한다.
- **REQ-E02**: **WHEN** 사용자가 프로바이더를 활성화/비활성화 **THEN** 메인 페이지의 모델 선택기에 해당 변경이 반영된다.
- **REQ-E03**: **WHEN** 사용자가 API 키 검증 버튼을 클릭 **THEN** 시스템은 해당 프로바이더 API에 테스트 요청을 전송한다.
- **REQ-E04**: **WHEN** API 키 검증이 성공 **THEN** 초록색 체크마크와 함께 성공 인디케이터를 표시한다.
- **REQ-E05**: **WHEN** API 키 검증이 실패 **THEN** 실패 사유와 함께 에러 메시지를 표시한다.

### 3.2 State-Driven 요구사항 (IF/THEN)

- **REQ-S01**: **IF** Local 프로바이더가 선택됨 **THEN** Host URL 입력 필드를 표시한다.
- **REQ-S02**: **IF** 프로바이더에 유효한 API 키가 없음 **THEN** 해당 프로바이더를 비활성 상태로 표시한다.
- **REQ-S03**: **IF** 프로바이더 검증이 진행 중 **THEN** 검증 버튼에 로딩 스피너를 표시한다.

### 3.3 Unwanted 요구사항 (SHALL NOT)

- **REQ-U01**: 시스템은 API 키를 평문으로 저장**하지 않아야 한다**.
- **REQ-U02**: 시스템은 API 키를 서버 로그에 기록**하지 않아야 한다**.
- **REQ-U03**: 시스템은 API 키를 해당 프로바이더 이외의 서드파티 서비스에 전송**하지 않아야 한다**.

---

## 4. Specifications (명세)

### 4.1 아키텍처

```
app/
  settings/
    page.tsx              # Settings 메인 페이지
    layout.tsx            # Settings 레이아웃
components/
  settings/
    provider-card.tsx     # 개별 프로바이더 설정 카드
    api-key-input.tsx     # 마스킹된 API 키 입력 (검증 포함)
    model-list.tsx        # 프로바이더별 사용 가능 모델 목록
lib/
  providers/
    registry.ts           # Provider Registry (SPEC-RAD-001 공유)
    types.ts              # Provider 타입 정의
  storage/
    settings-store.ts     # API 키 암호화 Local Storage 관리
```

### 4.2 주요 컴포넌트 설계

#### ProviderCard (`components/settings/provider-card.tsx`)

- 프로바이더 이름, 로고, 활성화 토글 표시
- API 키 입력 필드 포함
- 검증 상태 인디케이터 (미검증/성공/실패/진행 중)
- Local 프로바이더인 경우 Host URL 필드 추가 표시

#### ApiKeyInput (`components/settings/api-key-input.tsx`)

- 마스킹된 입력 필드 (기본: `sk-****...****`)
- 표시/숨기기 토글 버튼
- 검증 버튼 (Validate)
- 검증 결과 인라인 피드백

#### SettingsStore (`lib/storage/settings-store.ts`)

- Web Crypto API를 사용한 AES-GCM 암호화
- Local Storage 기반 영속화
- Provider별 설정 CRUD 인터페이스
- 키 존재 여부 확인 (키 자체를 노출하지 않음)

### 4.3 데이터 모델

```typescript
interface ProviderSettings {
  id: string;                    // provider unique identifier
  name: string;                  // display name
  enabled: boolean;              // activation status
  apiKey?: string;               // encrypted API key
  hostUrl?: string;              // Local provider only
  validationStatus: 'none' | 'validating' | 'valid' | 'invalid';
  lastValidatedAt?: string;      // ISO 8601 timestamp
  models: ModelConfig[];         // available models
}

interface ModelConfig {
  id: string;                    // model identifier
  name: string;                  // display name
  isDefault: boolean;            // default selection flag
}
```

### 4.4 Zod 검증 스키마

- API 키 형식 검증 (프로바이더별 prefix 패턴)
- Host URL 형식 검증 (URL format + reachability)
- 프로바이더 설정 전체 스키마 검증

---

## 5. Traceability (추적성)

| 요구사항 ID | 컴포넌트                | 테스트 시나리오       |
| ----------- | ----------------------- | --------------------- |
| REQ-E01     | settings-store.ts       | ACC-001               |
| REQ-E02     | provider-card.tsx       | ACC-002               |
| REQ-E03     | api-key-input.tsx       | ACC-003               |
| REQ-E04     | api-key-input.tsx       | ACC-003               |
| REQ-E05     | api-key-input.tsx       | ACC-004               |
| REQ-S01     | provider-card.tsx       | ACC-005               |
| REQ-S02     | provider-card.tsx       | ACC-006               |
| REQ-S03     | api-key-input.tsx       | ACC-003               |
| REQ-U01     | settings-store.ts       | ACC-007               |
| REQ-U02     | settings-store.ts       | ACC-007               |
| REQ-U03     | api-key-input.tsx       | ACC-007               |
