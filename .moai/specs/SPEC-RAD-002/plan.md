# SPEC-RAD-002 구현 계획

## 관련 SPEC

- **SPEC-RAD-002**: Provider Settings - LLM 프로바이더 관리 시스템
- **의존**: SPEC-RAD-001 (Provider Registry, Provider Types)

---

## 1. 마일스톤

### Primary Goal: 핵심 인프라 구축

- **Task 1.1**: Provider 타입 정의 확장 (`lib/providers/types.ts`)
  - `ProviderSettings` 인터페이스 정의
  - `ModelConfig` 인터페이스 정의
  - `ValidationStatus` 타입 정의
  - SPEC-RAD-001 타입과의 호환성 확보

- **Task 1.2**: 암호화 Storage 구현 (`lib/storage/settings-store.ts`)
  - Web Crypto API 기반 AES-GCM 암호화/복호화 유틸리티
  - Local Storage CRUD 래퍼
  - 키 존재 여부 확인 함수 (키 노출 없이)

- **Task 1.3**: Zod 검증 스키마 작성
  - 프로바이더별 API 키 패턴 검증 (OpenAI: `sk-*`, Anthropic: `sk-ant-*` 등)
  - Host URL 형식 검증
  - ProviderSettings 전체 스키마

### Secondary Goal: UI 컴포넌트 개발

- **Task 2.1**: ApiKeyInput 컴포넌트 (`components/settings/api-key-input.tsx`)
  - 마스킹된 입력 필드 구현
  - 표시/숨기기 토글
  - 검증 버튼 및 상태 표시 (로딩 스피너, 성공 체크마크, 에러 메시지)

- **Task 2.2**: ModelList 컴포넌트 (`components/settings/model-list.tsx`)
  - 프로바이더별 사용 가능 모델 목록 표시
  - 기본 모델 선택 기능

- **Task 2.3**: ProviderCard 컴포넌트 (`components/settings/provider-card.tsx`)
  - 프로바이더 정보 표시 (이름, 상태)
  - 활성화/비활성화 토글
  - ApiKeyInput, ModelList 통합
  - Local 프로바이더 시 Host URL 필드 조건부 표시

### Final Goal: 페이지 통합 및 연동

- **Task 3.1**: Settings 페이지 구현 (`app/settings/page.tsx`, `layout.tsx`)
  - ProviderCard 목록 렌더링
  - 프로바이더별 설정 상태 관리
  - Settings 레이아웃 (네비게이션 포함)

- **Task 3.2**: API 키 검증 로직 구현
  - 프로바이더별 테스트 요청 전송 (models endpoint 활용)
  - 검증 결과 피드백 (성공/실패 사유)
  - 에러 핸들링 (네트워크 오류, 타임아웃, 잘못된 키)

- **Task 3.3**: 메인 페이지 모델 선택기 연동
  - Provider Registry와 Settings Store 연결
  - 활성화된 프로바이더만 모델 선택기에 노출
  - 설정 변경 시 실시간 반영

### Optional Goal: 사용자 경험 향상

- **Task 4.1**: 프로바이더별 로고/아이콘 표시
- **Task 4.2**: API 키 마지막 검증 시간 표시
- **Task 4.3**: 프로바이더 연결 상태 대시보드

---

## 2. 기술적 접근 방식

### 2.1 암호화 전략

- **알고리즘**: AES-GCM (Web Crypto API)
- **키 생성**: `crypto.subtle.generateKey()`로 생성, 별도 저장
- **IV**: 각 암호화 시 랜덤 IV 생성
- **저장 형식**: `{ iv: base64, data: base64 }` 구조로 Local Storage에 저장

### 2.2 상태 관리

- React `useState`/`useReducer`를 활용한 로컬 상태 관리
- Settings Store는 싱글톤 패턴으로 전역 접근 가능
- 프로바이더 활성화/비활성화 변경 시 이벤트 기반 알림 (Custom Event 또는 Zustand)

### 2.3 API 키 검증 방식

| Provider  | 검증 엔드포인트          | 메서드 | 성공 조건      |
| --------- | ------------------------ | ------ | -------------- |
| Local     | `{hostUrl}/v1/models`    | GET    | 200 응답       |
| OpenAI    | `api.openai.com/v1/models` | GET  | 200 응답       |
| Anthropic | `api.anthropic.com/v1/messages` | POST | 200/400 응답 |
| Google    | `generativelanguage.googleapis.com` | GET | 200 응답 |

### 2.4 SPEC-RAD-001 통합 포인트

- `lib/providers/registry.ts`: Provider Registry에 설정 상태 반영
- `lib/providers/types.ts`: 공유 타입 정의 확장
- 메인 페이지 모델 선택기: 활성 프로바이더 필터링

---

## 3. 리스크 분석

| 리스크                              | 영향도 | 발생 가능성 | 대응 방안                                      |
| ----------------------------------- | ------ | ----------- | ---------------------------------------------- |
| SPEC-RAD-001 미완성 시 타입 충돌     | 높음   | 중간        | 인터페이스 사전 합의, 공유 타입 파일 우선 작성   |
| Web Crypto API 브라우저 호환성       | 중간   | 낮음        | 폴리필 또는 대체 라이브러리 준비                |
| CORS 이슈로 API 키 검증 실패         | 높음   | 높음        | Next.js API Route를 프록시로 활용               |
| Local Storage 용량 제한              | 낮음   | 낮음        | 설정 데이터 최소화, IndexedDB 대체 검토          |
| API 키 검증 시 Rate Limiting         | 중간   | 중간        | 검증 요청 디바운싱, 최소한의 테스트 요청 사용     |

---

## 4. 아키텍처 설계 방향

```
[Settings Page]
    |
    +-- [ProviderCard] x N
    |       |
    |       +-- [ApiKeyInput] --- validate ---> [Provider API]
    |       |                                        |
    |       +-- [ModelList]                    [Validation Result]
    |       |
    |       +-- Toggle (enable/disable)
    |
    +-- [SettingsStore] <--- encrypt/decrypt ---> [Local Storage]
    |
    +-- [Provider Registry] (SPEC-RAD-001 공유)
            |
            +-- [Main Page Model Selector]
```

---

## 5. 추적성 태그

- SPEC: `SPEC-RAD-002`
- 의존 SPEC: `SPEC-RAD-001`
- 관련 요구사항: REQ-E01 ~ REQ-E05, REQ-S01 ~ REQ-S03, REQ-U01 ~ REQ-U03
