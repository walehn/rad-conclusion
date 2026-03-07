# rad-conclusion — Radiology Conclusion Generator

방사선 판독 소견(Findings)을 입력받아 임상적으로 자연스러운 Conclusion/Impression을 자동 생성하는 OpenClaw 스킬입니다. Gemini CLI 또는 로컬 LLM (gpt-oss-120b, OpenAI-compatible API) 두 가지 백엔드를 지원합니다.

---

## 디렉토리 구조

```
skills/rad-conclusion/
├── README.md                  # 이 파일
├── SKILL.md                   # OpenClaw 스킬 메타데이터
├── .env.example               # 환경변수 템플릿 (공개)
├── .env                       # 실제 설정값 (로컬 전용, clawhubignore)
├── .clawhubignore             # ClawHub 업로드 제외 목록
└── scripts/
    └── rad_conclusion         # 스킬 래퍼 (.env 자동 로드, local 백엔드 강제)

scripts/
└── rad_conclusion.sh          # 핵심 통합 스크립트 (gemini | local)
```

---

## 핵심 스크립트: `scripts/rad_conclusion.sh`

### 기본값

| 항목 | 기본값 |
|------|--------|
| `--backend` | `local` |
| `--model` (local) | `$RAD_LOCAL_MODEL` 또는 `gpt-oss-120b` |
| `--model` (gemini) | `gemini-3.1-pro-preview` |
| `--host` | `$RAD_LOCAL_HOST` 또는 `http://localhost:5100` |
| `--style` | `numbered` |
| `--lang` | `en` |
| `--title` | `Conclusion` |
| `--max-tokens` | `2000` (local 전용) |

### 의존성

| 백엔드 | 필요 조건 |
|--------|-----------|
| `local` | `curl`, `jq`, `python3`; OpenAI-compatible LLM 서버 실행 중 |
| `gemini` | `gemini` CLI 설치 및 인증 완료 |

### 옵션 전체 목록

| 옵션 | 값 | 설명 |
|------|----|------|
| `--backend` | `local` \| `gemini` | 사용할 AI 백엔드 |
| `--model` | 문자열 | 모델 이름 오버라이드 |
| `--host` | URL | 로컬 LLM API 서버 주소 |
| `--style` | `short` \| `numbered` \| `urgent-first` | 결론 출력 스타일 |
| `--lang` | `en` \| `ko` \| `mixed` | 출력 언어 |
| `--title` | 문자열 | 결론 섹션 헤더 레이블 |
| `--max-tokens` | 정수 | 최대 출력 토큰 (local 전용) |

### 스타일 옵션

- **`numbered`**: 번호형 Impression 목록 (`1.`, `2.`, `3.`), 임상적 우선순위 순
- **`short`**: 2–4줄 이내 간결한 요약
- **`urgent-first`**: 긴급/중증 소견을 (1)번으로 먼저 출력

### 언어 옵션

- **`en`**: 영어 전용 (공식 방사선 보고서 스타일)
- **`ko`**: 한국어 주체, 표준 방사선 용어는 영어 유지
- **`mixed`**: Findings 톤에 맞춘 한국어+영어 혼용

### 사용 예시

```bash
# 기본 (local / gpt-oss-120b / numbered / en)
echo "Liver S8에 2.1cm 과혈관성 결절..." | ./scripts/rad_conclusion.sh

# Gemini 백엔드로 한국어 짧게
cat findings.txt | ./scripts/rad_conclusion.sh --backend gemini --lang ko --style short

# 긴급 소견 우선, 토큰 상향
echo "..." | ./scripts/rad_conclusion.sh --style urgent-first --max-tokens 3000

# 제목 변경
echo "..." | ./scripts/rad_conclusion.sh --title "Impression"
```

### 출력 포맷

```
Conclusion:
1. 주요 소견 요약 (임상적으로 가장 중요한 것 먼저)
2. 두 번째 소견

Elapsed: 7.30s  [backend: local, model: gpt-oss-120b]
```

> max_tokens 초과 시 stderr에 `[WARNING] Output truncated` 경고 출력.

---

## 스킬 래퍼: `skills/rad-conclusion/scripts/rad_conclusion`

local 백엔드를 강제하고 `.env`를 자동 로드. 두 가지 호출 방식 지원.

```bash
# 방식 1: 첫 번째 인자로 Findings 텍스트 전달 (legacy mode)
skills/rad-conclusion/scripts/rad_conclusion "간 S8 병변 관찰됨..."

# 방식 2: stdin
echo "간 S8 병변 관찰됨..." | skills/rad-conclusion/scripts/rad_conclusion

# 옵션 전달
echo "..." | skills/rad-conclusion/scripts/rad_conclusion --lang ko --style short
```

내부적으로 `rad_conclusion.sh --backend local`을 호출하며, 나머지 옵션은 그대로 전달.

---

## 출력 정책

스크립트 stdout을 **있는 그대로** 채팅에 전달. 에이전트가 임의로 수정, 요약, 생략하지 않음.

---

## Telegram 채팅 사용법

### 등록된 슬래시 명령어

```
/rad-conclusion <findings 텍스트>
```

또는 Findings 텍스트를 그냥 채팅으로 올려도 처리.

### 자동 옵션 파싱 규칙

옵션 미지정 시 기본값: `--style numbered --lang en`

| 사용자 입력 | 적용 옵션 |
|------------|----------|
| "한국어", "한글", "ko" | `--lang ko` |
| "영어", "English", "en" | `--lang en` |
| "혼용", "mixed" | `--lang mixed` |
| "짧게", "간단히", "short" | `--style short` |
| "긴급 먼저", "urgent" | `--style urgent-first` |
| "길게", "자세히", "토큰 늘려" | `--max-tokens` 상향 |

---

## 시스템 프롬프트 (통합, 두 백엔드 공용)

**콘텐츠 규칙:**
1. Findings 합성 — 원문 복붙 금지, 임상적 의미로 변환
2. 임상적 우선순위 배치
3. Actionable language — 추가 검사 필요 시 명시
4. 불확실한 소견 → "cannot exclude", "clinical correlation recommended" 등
5. 임상적으로 의미 있는 음성 소견만 포함
6. **No fabrication** — Findings에 없는 내용, 권고사항 추가 금지
7. PII 금지

**문체 규칙:**
- Active voice, filler opener 금지 ("In summary", "Based on..." 등)
- 메타 코멘트 금지
- 일관된 용어 사용
- 수치 원문 그대로 유지
- 불확실할 때만 hedging 사용

---

## 출력 후처리 파이프라인 (local 백엔드)

LLM 출력 → Python 파서 → stdout

**파서 동작:**
1. `Conclusion:` 또는 `결론:` 패턴 탐색 (정규식, 마지막 occurrence 기준)
2. `**Conclusion:**` / `**Conclusion**:` bold 마크업 자동 제거
3. `thought\n` 접두사 블록 처리 — 블록 이후 타이틀 재탐색

---

## 설치 및 환경 설정

```bash
cp skills/rad-conclusion/.env.example skills/rad-conclusion/.env
# .env 파일에서 RAD_LOCAL_HOST, RAD_LOCAL_MODEL 설정
```

```bash
# .env 예시
RAD_LOCAL_HOST=http://localhost:5100
RAD_LOCAL_MODEL=gpt-oss-120b
```

### 로컬 LLM 서버 요구사항

- OpenAI-compatible chat completions API (`/v1/chat/completions`) 지원
- 권장 모델: `gpt-oss-120b`

### Gemini 백엔드 사용 시

```bash
gemini  # 최초 1회 인증
```

---

## 백엔드별 권장 용도

| 용도 | 권장 백엔드 | 응답 속도 |
|------|------------|---------|
| 영어/혼용 소견 | `local` (기본) | ~5–9초 |
| 한국어 소견 | `gemini` 또는 `local` | ~7s / ~17s |
| 오프라인/프라이버시 | `local` | ~5–9초 |
| 고품질 우선 | `gemini` | ~17초 |

---

## 주의사항

- 로컬 LLM 서버가 실행 중이어야 local 백엔드 사용 가능
- 입력은 Findings 텍스트만 사용 (PII 제거 권장)
- `thought\n` 블록 등 모델 내부 reasoning은 파서가 자동 제거
- Gemini 백엔드 사용 시 `gemini` CLI 인증 필요
