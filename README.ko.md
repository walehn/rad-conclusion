<h1 align="center">Rad Conclusion</h1>

<p align="center">
  <strong>로컬 언어 모델로 판독 결론과 구조화 보고서를 만드는 판독 보조 도구</strong>
</p>

<p align="center">
  <a href="./README.md">English</a> ·
  <a href="./README.ko.md">한국어</a>
</p>

<p align="center">
  <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-15-black?style=flat&logo=next.js" alt="Next.js"></a>
  <a href="https://react.dev"><img src="https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=white" alt="React"></a>
  <a href="https://tailwindcss.com"><img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat&logo=tailwindcss&logoColor=white" alt="Tailwind CSS"></a>
  <a href="https://ai-sdk.dev"><img src="https://img.shields.io/badge/AI_SDK-7-000?style=flat&logo=vercel" alt="AI SDK"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License: MIT"></a>
</p>

---

영상의학과 의사를 위한 브라우저 도구이며, 기능은 두 가지입니다.

- **결론 생성기** (`/conclusion`): 입력한 소견(Findings)으로 결론(Impression)을 쓰고, 쓰는 대로 화면에 보여 줍니다. 비교 모드에서는 두 가지 프롬프트 판으로 나란히 만들고, 어느 쪽이 나은지 투표를 받습니다.
- **구조화 보고서 생성기** (`/structured-report`): 질환별 입력 양식을 채우면 구조화 보고서를 씁니다. 신세포암, 전립선암, 자궁근종을 지원합니다.

서버 안에서 돌아가는 OpenAI 호환 언어 모델 서버(예: vLLM)를 기본으로 씁니다. 외부 서비스(OpenAI, Anthropic, Google)는 선택 사항입니다.

## 기능

### 결론 생성기
- **비교 모드**: v1(서명된 판독문 문체에 맞춘 프롬프트)과 v2(진단과 감별진단을 강화한 프롬프트)로 함께 만들고, 판독의가 더 나은 쪽에 투표합니다. 투표는 `data/votes.jsonl`에 한 줄씩 쌓입니다.
- **출력 형식**: 번호 목록(Numbered), 짧게(Short), 긴급 소견 먼저(Urgent-First)
- **출력 언어**: 영어, 한국어(표준 용어는 영어 유지), 혼용
- **입력 확인**: 소견 없이 등록번호만 붙여 넣었거나 잘못 누른 입력은 받지 않습니다. 이런 입력으로도 모델은 그럴듯한 결론을 지어내기 때문입니다.
- **규칙 점검**: 결론 아래에, 소견에 근거가 없는 내용(좌우, 숫자, 날짜, 변화 표현, 덧붙인 권고)과 형식 문제를 표시합니다. 결론 자체는 고치지 않습니다.
- **기록**: 만든 결과는 모두 저장됩니다. `/review`에서 묶음별로 보고 검색할 수 있고, 프롬프트 판 변경 이력도 볼 수 있습니다.

### 구조화 보고서 생성기
질환마다 `/structured-report/<주소>`에 양식이 있고, 각 서식은 따르는 기준을 밝혀 둡니다.

| 질환 | 주소 | 검사 | 기준 |
|------|------|------|------|
| 신세포암 | `rcc` | CT, MRI, 초음파 | SAR DFP 2019, AJCC 8판, Bosniak v2019, Neves-Mayo |
| 전립선암 | `prostate-cancer` | MRI | PI-RADS v2.1, AJCC 8판, EAU 2025/2026, PI-QUAL v2, Mehralivand EPE |
| 자궁근종 | `uterine-myoma` | MRI, 초음파 | FIGO 2011, ESUR 2018, Funaki |

질환 목록은 `lib/prompts/disease-registry.ts`에 있고, 항목 정의와 보고서 변환은 `lib/prompts/disease-templates/`에 있습니다.

### 계정과 권한
- 아이디(또는 이메일)와 비밀번호로 로그인합니다. 비밀번호는 argon2id로 바꿔서 저장합니다.
- **admin(관리자)**: 모든 기능을 씁니다.
- **restricted(제한)**: 로컬 모델만 쓸 수 있고, 자기 기록만 보며, 투표와 비밀번호 변경을 할 수 있습니다. 외부 서비스, API 키, 연결 확인은 쓸 수 없습니다.
- 권한은 `lib/auth/roles.ts`에 정의돼 있고, 요청마다 데이터베이스에서 읽습니다.
- 제한 계정의 생성 기록과 투표도 똑같이 저장되지만, 평가(`lib/eval`)에서는 빠집니다.
- **계정 관리** (`/admin/accounts`, 관리자만)
  - **초대 링크**: 제한 계정을 만듭니다. 받은 사람이 아이디와 비밀번호를 정합니다.
  - **비밀번호 재설정 링크**: 새 비밀번호를 정하게 하고, 그 계정의 다른 로그인은 모두 끊습니다.
  - **정지와 다시 사용**: 정지하면 그 계정은 바로 로그아웃됩니다.
  - 링크는 한 번만 쓸 수 있고, 48시간 뒤 만료되며, 취소할 수 있습니다.
  - 링크 값은 주소의 `#` 뒤(`/account/setup#…`)에만 있어서 서버와 중계 서버의 접속 기록에 남지 않습니다. 데이터베이스에는 sha256 값만 저장합니다.
  - 쓸 수 없는 링크를 열면 이미 쓴 링크인지(로그인 버튼과 함께), 기한이 지났는지, 취소됐는지 알려 줍니다.

### 설정
- 비밀번호 변경. 바꾸면 다른 기기의 로그인은 끊깁니다.
- 관리자만: 외부 서비스용 API 키를 계정별로 저장하고(AES-256-GCM으로 암호화), 서비스마다 연결을 확인합니다.

## 지원하는 언어 모델

| 제공자 | 모델 (첫째가 기본값) | 비고 |
|--------|---------------------|------|
| **Local LLM** | DeepSeek V4 Flash, Qwen3.6 35B (A3B-FP8) | OpenAI 호환 서버. 모델마다 주소가 따로 있습니다(아래 참고). 제한 계정은 이것만 쓸 수 있습니다. |
| **OpenAI** | GPT-4o, GPT-4o Mini, GPT-4.1 | API 키 필요 |
| **Anthropic** | Claude Sonnet 4, Claude Opus 4, Claude Haiku 4 | API 키 필요 |
| **Google AI** | Gemini 3.1 Flash-Lite (Preview), Gemini 2.5 Flash, Gemini 2.5 Flash-Lite, Gemini 2.5 Pro, Gemini 3 Flash (Preview) | API 키 필요 |

로컬 모델의 이름, 주소, 대화 서식 설정은 `lib/providers/local-config.ts` 한 곳에서만 정합니다.

## 시작하기

### 필요한 것
- Node.js 22
- 로컬 모델을 쓰려면 OpenAI 호환 서버(`/v1/chat/completions`). 예: vLLM

### 설치

```bash
git clone https://github.com/walehn/rad-conclusion.git
cd rad-conclusion
npm install
```

### 환경 설정

`.env.local` 파일을 만듭니다.

```bash
# 필수: 로그인 쿠키 암호화용 (32자 이상)
SESSION_SECRET=change-me-to-a-long-random-string

# 설정 화면에서 API 키를 저장하려면 필수
API_KEY_ENCRYPTION_SECRET=another-long-random-string

# 로컬 모델 서버 주소 (/v1 없이). 적힌 값이 기본값
RAD_LOCAL_DEEPSEEK_HOST=http://localhost:8888   # DeepSeek V4 Flash
RAD_LOCAL_HOST=http://localhost:8080            # Qwen3.6 35B
# 선택: 요청에 모델 이름이 없을 때 쓸 모델
# RAD_LOCAL_MODEL=deepseek-v4-flash-0731

# 선택: 외부 서비스의 서버 공용 키 (계정에 저장된 키가 없을 때 사용)
# OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...
# GOOGLE_AI_API_KEY=AI...

# 선택: 생성마다 걸린 시간을 한 줄로 기록
# RAD_PERF_LOG=1
```

### 데이터베이스

```bash
npm run db:migrate   # data/auth.sqlite를 만들고 drizzle/의 변경 사항을 적용
```

첫 계정은 `npm run seed:user -- <아이디> --role admin`으로 만듭니다. 아직 적용하지 않은 데이터베이스 변경도 이 명령이 먼저 적용합니다. 비밀번호는 터미널에서 직접 입력하며, 입력한 글자는 화면에 보이지 않습니다. 역할을 빼면 `restricted`입니다. 그다음 계정은 `/admin/accounts`의 초대 링크로 만들면 됩니다.

> `scripts/` 폴더에서는 `seed-user.ts`(계정 만들기)와 `migrate.js`(컨테이너가 `entrypoint.sh`에서 실행하는 데이터베이스 변경 적용)만 이 저장소에 있습니다. 프롬프트 판 도우미, 로컬 분석 도구, `Dockerfile`, `docker-compose.yml`, `.dockerignore`는 넣지 않았습니다.

### 개발

```bash
npm run dev    # http://localhost:3001
npm test       # Vitest
```

### 운영 실행

```bash
npm run build
npm run start -- --hostname 127.0.0.1   # http://127.0.0.1:3957
```

`next.config.ts`가 독립 실행 서버(`output: "standalone"`)로 빌드하기 때문에, `next start`를 쓰면 Next.js가 경고를 한 줄 띄웁니다. 서버는 그대로 돌아가고, 저장소 폴더의 `data/`를 씁니다. 컨테이너 배포에서는 `.next/standalone/server.js`를 실행합니다. 이 서버는 시작할 때 자기 폴더로 옮겨 가므로, `data/`와 `drizzle/`도 그 옆에 있어야 합니다. 서버를 띄우기 전에 `entrypoint.sh`가 `scripts/migrate.js`로 데이터베이스 변경을 적용합니다.

화면 아래에는 `v<package.json 버전>`과 `Updated <빌드 날짜> · <커밋>`이 나옵니다. 커밋은 `BUILD_COMMIT` 환경변수에서 읽고, 없으면 빌드하는 곳의 `git`에서 읽습니다.

## 보안 구조

- **접속 주소 제한**
  - `middleware.ts`는 허용 목록에 있는 주소만 들여보냅니다. 정확한 주소는 `ALLOWED_IPS`에, 주소 범위는 `ALLOWED_RANGES`에 넣습니다.
  - 접속한 사람의 주소는 `CF-Connecting-IP`, `X-Forwarded-For`, `X-Real-IP` 순서로 읽습니다. 그래서 **이 값을 대신 채워 주는 중계 서버(예: 클라우드플레어 터널) 뒤에 두고, `127.0.0.1`에서만 받아야 합니다.** 포트에 바로 들어올 수 있으면 이 값을 꾸며 낼 수 있습니다.
- **로그인 유지**: 암호화한 쿠키(iron-session)를 씁니다. 역할, 정지 여부, 강제 로그아웃 시각은 요청마다 데이터베이스와 맞춰 봅니다.
- **요청 위조 방지**: 쿠키와 요청 머리글의 값이 같아야 하고, 상태를 바꾸는 요청은 출처(Origin)와 호스트(Host)도 맞춰 봅니다.
- **시도 횟수 제한**: 로그인 실패는 주소별과 계정별로, 링크 확인 실패는 주소별로 제한합니다.

## 저장하는 자료

앱이 저장하는 자료는 모두 `data/`에 있고, 이 폴더는 git에서 빠져 있습니다.

| 파일 | 내용 |
|------|------|
| `data/auth.sqlite` | 계정, 암호화된 API 키, 생성 기록(소견과 결과), 구조화 보고서, 계정 링크 |
| `data/votes.jsonl` | 비교 모드 투표 |
| `data/eval.sqlite` | 평가 결과 |

소견은 입력한 그대로 저장됩니다. 환자를 알아볼 수 있는 정보는 넣지 마세요. `data/`는 진료 자료로 다루고, 커밋하거나 공유하지 마세요.

## 프롬프트 판 관리

결론마다 어떤 프롬프트로 만들었는지 기록해서, 프롬프트를 고친 뒤에도 기록끼리 비교할 수 있게 합니다.

- `lib/prompts/revisions.ts`가 변경 기록입니다. `r1`(2026-08-25)은 기준 프롬프트이고, `r2`(2026-10-14)에서 v1을 판독문 문체 프롬프트로 바꿨습니다.
- 판마다 짧은 sha256 값으로 구별합니다. 이 값은 코드가 만들 수 있는 모든 프롬프트(두 판, 모든 언어와 형식 조합)로 계산합니다.
- 생성할 때마다 `generations.prompt_revision`과 `generations.prompt_hash`를 함께 저장합니다.
- `lib/prompts/system-prompt.ts`를 고치고 기록을 추가하지 않으면 `npm test`가 실패하고, 새 값을 알려 줍니다. `npm run prompt:revision`은 바로 붙여 넣을 기록을 만들어 줍니다. 다만 이 스크립트는 로컬에만 있고 이 저장소에는 없습니다.

## 평가

`npm run eval -- <명령>`으로 저장된 결론을 채점합니다. 앱 데이터베이스는 읽기만 하고, 결과는 `data/eval.sqlite`에 저장합니다.

| 명령 | 하는 일 |
|------|---------|
| `rules` | 새 생성 결과에 규칙 점검 |
| `judge --judge local\|gemini` | 언어 모델로 채점 |
| `report [--by version\|revision\|model\|month\|all]` | 요약 표 |
| `show <번호>` | 생성 결과 하나와 채점 결과 |
| `deid` | 외부 채점 모델이 받는 내용을 미리 보기 |
| `import-finals <reports.jsonl>` | 서명된 판독문을 가져와 생성 결과와 짝짓기 |
| `replay --candidates v2,r2 --set matched\|pacs` | 지난 입력을 후보 프롬프트로 다시 만들고 서명된 결론과 비교 |
| `findings-review` | 서명된 소견 안의 앞뒤 모순 점검 |

모든 옵션은 `lib/eval/cli.ts` 머리말에 있습니다.

## 폴더 구조

```
rad-conclusion/
├── app/
│   ├── api/
│   │   ├── generate/                 # 결론 생성
│   │   ├── structured-report/        # 구조화 보고서 생성
│   │   ├── vote/                     # 비교 모드 투표
│   │   ├── generations/              # 기록
│   │   ├── auth/                     # 로그인, 로그아웃, 비밀번호 변경
│   │   ├── account-links/            # 초대·재설정 링크 확인과 사용 (로그인 없이)
│   │   ├── admin/                    # 계정, 링크, 정지 (관리자)
│   │   ├── providers/                # 제공자 목록과 연결 확인
│   │   └── user/api-keys/            # 계정별 API 키
│   ├── conclusion/                   # 결론 생성기
│   ├── structured-report/            # 질환 선택과 질환별 양식
│   ├── review/                       # 기록과 프롬프트 판 이력
│   ├── settings/                     # 비밀번호, API 키, 제공자
│   ├── admin/accounts/               # 계정 관리
│   ├── account/setup/                # 초대·재설정 링크 화면
│   ├── login/
│   ├── design-demo/                  # 디자인 참고 화면
│   └── page.tsx                      # 첫 화면
├── components/                       # 양식, 출력, 메뉴, 기본 화면 요소
├── lib/
│   ├── auth/                         # 로그인 유지, 권한, 요청 위조 방지, 시도 제한, 계정 링크
│   ├── providers/                    # 제공자 목록과 로컬 모델 목록
│   ├── prompts/                      # 결론 프롬프트, 판 기록, 질환 서식
│   ├── eval/                         # 평가 명령
│   ├── db/                           # Drizzle 표 정의와 SQLite 연결
│   ├── crypto/ · api-keys/           # API 키 암호화와 조회
│   ├── findings-check.ts             # 소견 없는 입력 거르기
│   └── post-process.ts               # 모델 출력 정리
├── drizzle/                          # 데이터베이스 변경 SQL
├── tests/                            # Vitest 시험
├── docs/notion-tone-guide.md         # 화면 문체 안내
└── middleware.ts                     # 접속 주소 제한과 요청 위조 방지 쿠키
```

## 기술 구성

| 분류 | 기술 |
|------|------|
| 프레임워크 | Next.js 15, React 19 |
| 스타일 | Tailwind CSS 4 |
| 언어 모델 | AI SDK 7 (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`) |
| 데이터베이스 | SQLite(better-sqlite3), Drizzle ORM |
| 로그인 | iron-session, @node-rs/argon2 |
| 언어 | TypeScript 5.8, Zod 4 |
| 시험 | Vitest, Testing Library, happy-dom |
| 화면 요소 | shadcn/ui 방식 컴포넌트, Radix Dialog, Lucide 아이콘 |

## 개발 도구

이 프로젝트는 [Claude Code](https://claude.ai/claude-code)와 [MoAI-ADK](https://github.com/modu-ai/moai-adk) (Agentic Development Kit for Claude Code)로 만들었습니다.

## 라이선스

MIT. 자세한 내용은 [LICENSE](./LICENSE)를 보세요.
