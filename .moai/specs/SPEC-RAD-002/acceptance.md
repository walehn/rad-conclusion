# SPEC-RAD-002 인수 기준

## 관련 SPEC

- **SPEC-RAD-002**: Provider Settings - LLM 프로바이더 관리 시스템

---

## 1. 테스트 시나리오

### ACC-001: API 키 저장 (REQ-E01)

```gherkin
Scenario: 사용자가 API 키를 입력하고 저장한다
  Given 사용자가 Settings 페이지에 접속한다
  And OpenAI 프로바이더 카드가 표시된다
  When 사용자가 API 키 입력 필드에 "sk-test-key-12345"를 입력한다
  Then 시스템은 해당 키를 AES-GCM으로 암호화한다
  And 암호화된 키를 Local Storage에 저장한다
  And Local Storage에서 평문 키가 조회되지 않는다
```

### ACC-002: 프로바이더 활성화/비활성화 (REQ-E02)

```gherkin
Scenario: 프로바이더 비활성화 시 모델 선택기에 반영
  Given OpenAI 프로바이더가 활성화 상태이다
  And 메인 페이지 모델 선택기에 OpenAI 모델이 표시된다
  When 사용자가 OpenAI 프로바이더의 토글을 비활성화한다
  Then 메인 페이지 모델 선택기에서 OpenAI 모델이 제거된다
  And OpenAI 프로바이더 카드가 비활성 상태로 표시된다

Scenario: 프로바이더 활성화 시 모델 선택기에 반영
  Given Anthropic 프로바이더가 비활성화 상태이다
  And 유효한 API 키가 저장되어 있다
  When 사용자가 Anthropic 프로바이더의 토글을 활성화한다
  Then 메인 페이지 모델 선택기에 Anthropic 모델이 추가된다
```

### ACC-003: API 키 검증 성공 (REQ-E03, REQ-E04, REQ-S03)

```gherkin
Scenario: API 키 검증이 성공한다
  Given 사용자가 OpenAI API 키를 입력한 상태이다
  When 사용자가 "Validate" 버튼을 클릭한다
  Then 검증 버튼에 로딩 스피너가 표시된다
  And 시스템이 OpenAI API에 테스트 요청을 전송한다
  When 검증이 성공한다
  Then 초록색 체크마크가 표시된다
  And 로딩 스피너가 사라진다
  And 마지막 검증 시간이 업데이트된다
```

### ACC-004: API 키 검증 실패 (REQ-E05)

```gherkin
Scenario: 잘못된 API 키로 검증이 실패한다
  Given 사용자가 잘못된 API 키 "sk-invalid-key"를 입력한 상태이다
  When 사용자가 "Validate" 버튼을 클릭한다
  Then 시스템이 프로바이더 API에 테스트 요청을 전송한다
  When 검증이 실패한다 (401 Unauthorized)
  Then 빨간색 에러 아이콘이 표시된다
  And "Invalid API key" 에러 메시지가 표시된다
  And 프로바이더가 비활성 상태로 전환된다
```

### ACC-005: Local 프로바이더 Host URL 표시 (REQ-S01)

```gherkin
Scenario: Local 프로바이더 선택 시 Host URL 필드 표시
  Given Settings 페이지가 로드되었다
  When Local 프로바이더 카드를 확인한다
  Then Host URL 입력 필드가 표시된다
  And 플레이스홀더에 "http://localhost:11434" 같은 예시가 표시된다

Scenario: 비-Local 프로바이더에는 Host URL 필드 미표시
  Given Settings 페이지가 로드되었다
  When OpenAI 프로바이더 카드를 확인한다
  Then Host URL 입력 필드가 표시되지 않는다
```

### ACC-006: API 키 미설정 시 비활성 상태 (REQ-S02)

```gherkin
Scenario: API 키가 없는 프로바이더는 비활성 상태로 표시
  Given Anthropic 프로바이더에 API 키가 설정되어 있지 않다
  When Settings 페이지를 로드한다
  Then Anthropic 프로바이더 카드가 비활성(disabled) 스타일로 표시된다
  And 활성화 토글이 비활성화되어 있다
  And "API key required" 안내 메시지가 표시된다
```

---

## 2. 엣지 케이스 시나리오

### ACC-EC01: 네트워크 오류 시 검증 처리

```gherkin
Scenario: 네트워크 오류로 API 키 검증 실패
  Given 사용자가 유효한 API 키를 입력한 상태이다
  And 네트워크 연결이 불안정하다
  When 사용자가 "Validate" 버튼을 클릭한다
  Then 시스템이 검증 요청을 전송한다
  When 네트워크 타임아웃이 발생한다
  Then "Network error: Unable to reach provider" 에러 메시지가 표시된다
  And 검증 상태가 "invalid"로 설정된다
  And 사용자가 재시도할 수 있다
```

### ACC-EC02: 빈 API 키 입력 방지

```gherkin
Scenario: 빈 API 키로 검증 시도
  Given API 키 입력 필드가 비어있다
  When 사용자가 "Validate" 버튼을 클릭한다
  Then "API key is required" 검증 에러가 인라인으로 표시된다
  And 프로바이더 API로 요청이 전송되지 않는다
```

### ACC-EC03: CORS 프록시 동작

```gherkin
Scenario: CORS 이슈 발생 시 프록시 라우트 사용
  Given 브라우저에서 직접 프로바이더 API 호출 시 CORS 에러가 발생한다
  When API 키 검증을 수행한다
  Then Next.js API Route를 통해 프록시 요청이 전송된다
  And 프로바이더 API 응답이 정상적으로 반환된다
```

### ACC-EC04: Local Storage 데이터 무결성

```gherkin
Scenario: 손상된 Local Storage 데이터 처리
  Given Local Storage의 암호화된 설정 데이터가 손상되었다
  When Settings 페이지를 로드한다
  Then 시스템이 데이터 복호화 실패를 감지한다
  And 해당 프로바이더 설정을 초기 상태로 리셋한다
  And 사용자에게 "Settings have been reset due to data corruption" 알림을 표시한다
```

---

## 3. 보안 기준 (REQ-U01, REQ-U02, REQ-U03)

### ACC-007: 보안 요구사항 검증

```gherkin
Scenario: API 키가 평문으로 저장되지 않음 (REQ-U01)
  Given 사용자가 API 키를 입력하고 저장한다
  When Local Storage 내용을 직접 검사한다
  Then API 키 원문이 Local Storage 값에 포함되어 있지 않다
  And 저장된 값이 Base64 인코딩된 암호화 데이터임을 확인한다

Scenario: API 키가 서버 로그에 기록되지 않음 (REQ-U02)
  Given API 키 검증 요청이 프록시 라우트를 통해 전송된다
  When 서버 사이드 로그를 검사한다
  Then API 키 원문이 로그에 포함되어 있지 않다
  And 로그에 "[REDACTED]" 또는 마스킹된 형태만 존재한다

Scenario: API 키가 서드파티에 전송되지 않음 (REQ-U03)
  Given 사용자가 API 키를 입력하고 검증한다
  When 네트워크 요청을 모니터링한다
  Then API 키가 포함된 요청은 해당 프로바이더 API 엔드포인트로만 전송된다
  And 다른 도메인으로 API 키가 전송되지 않는다
```

---

## 4. Quality Gate 기준

### 4.1 Definition of Done

- [ ] 모든 EARS 요구사항(REQ-E01~E05, REQ-S01~S03, REQ-U01~U03)이 구현됨
- [ ] 4개 프로바이더(Local, OpenAI, Anthropic, Google) 설정이 정상 동작
- [ ] API 키 암호화 저장 및 복호화 검증 완료
- [ ] API 키 검증 (성공/실패) 흐름 검증 완료
- [ ] 프로바이더 활성화/비활성화 시 모델 선택기 반영 확인
- [ ] 보안 요구사항 3건 모두 검증 통과
- [ ] TypeScript 타입 에러 0건
- [ ] Lint 에러 0건

### 4.2 검증 도구

| 검증 항목              | 도구/방법                       |
| ---------------------- | ------------------------------- |
| 컴포넌트 렌더링         | React Testing Library           |
| 암호화 동작 검증        | Vitest + Web Crypto API mock    |
| API 검증 흐름           | MSW (Mock Service Worker)       |
| 타입 안전성             | `tsc --noEmit`                  |
| 접근성                 | axe-core                        |
| E2E 테스트             | Playwright                      |

---

## 5. 추적성 태그

- SPEC: `SPEC-RAD-002`
- 요구사항: REQ-E01 ~ REQ-E05, REQ-S01 ~ REQ-S03, REQ-U01 ~ REQ-U03
- 테스트: ACC-001 ~ ACC-007, ACC-EC01 ~ ACC-EC04
