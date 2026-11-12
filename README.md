<h1 align="center">Rad Conclusion</h1>

<p align="center">
  <strong>Radiology reporting assistant: conclusion and structured-report generation with a local LLM</strong>
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

A browser-based assistant for radiologists with two tools:

- **Conclusion generator** (`/conclusion`) turns typed Findings into an Impression, streamed as it is written. An A/B mode runs two prompt versions side by side and records which one the radiologist preferred.
- **Structured report generator** (`/structured-report`) fills a disease-specific form and writes a structured report for renal cell carcinoma, prostate cancer or uterine myoma.

It is built to run on a local, OpenAI-compatible LLM server (e.g. vLLM). Hosted providers (OpenAI, Anthropic, Google) are optional.

## Features

### Conclusion generator
- **A/B compare** — v1 (house style fitted to signed reports) and v2 (advanced Dx/DDx) run together; the radiologist votes for the better one. Votes are appended to `data/votes.jsonl`.
- **Output style** — Numbered, Short or Urgent-First.
- **Output language** — English, Korean (standard terms kept in English) or Mixed.
- **Input check** — input with no findings text (a pasted registration number, a stray keystroke) is rejected instead of producing an invented conclusion.
- **Rule checks** — under each finished conclusion, the page flags content the Findings do not support (a side, a number, a date, an interval-change word, an added recommendation) and output-format problems. The conclusion itself is never altered.
- **History** — every generation is saved; `/review` lists past results by batch with search, and shows the prompt revision history.

### Structured report generator
One form per disease at `/structured-report/<slug>`; the template cites the standard it follows.

| Disease | Slug | Modalities | Standards |
|---------|------|-----------|-----------|
| Renal cell carcinoma | `rcc` | CT, MRI, US | SAR DFP 2019, AJCC 8th, Bosniak v2019, Neves-Mayo |
| Prostate cancer | `prostate-cancer` | MRI | PI-RADS v2.1, AJCC 8th, EAU 2025/2026, PI-QUAL v2, Mehralivand EPE |
| Uterine myoma | `uterine-myoma` | MRI, US | FIGO 2011, ESUR 2018, Funaki |

The disease list lives in `lib/prompts/disease-registry.ts`; field definitions and serializers are in `lib/prompts/disease-templates/`.

### Accounts and roles
- Sign in with an account ID (or e-mail) and password. Passwords are hashed with argon2id.
- **admin** — everything. **restricted** — local model only, own history only, A/B voting, password change; no hosted providers, API keys or provider checks. Roles are defined in `lib/auth/roles.ts` and read from the database on every request.
- Generations and votes from restricted accounts are stored like any other but left out of evaluation (`lib/eval`).
- **Account admin** (`/admin/accounts`, admin only):
  - **Invite links** create a restricted account; the invitee picks the ID and password.
  - **Password reset links** set a new password and sign the account out everywhere else.
  - **Suspend / reinstate** an account; suspension ends its sessions at once.
  - Links are single-use, expire after 48 hours and can be revoked. The token travels only in the URL fragment (`/account/setup#…`), so it never reaches server or proxy logs, and the database stores only its sha256.
  - When a link cannot be used, the page says whether it was already used (with a login button), expired or revoked.

### Settings
- Password change (signs out other devices).
- Admin only: per-account API keys for hosted providers, encrypted at rest (AES-256-GCM), and a connection check per provider.

## Supported LLM providers

| Provider | Models (default first) | Notes |
|----------|------------------------|-------|
| **Local LLM** | DeepSeek V4 Flash, Qwen3.6 35B (A3B-FP8) | OpenAI-compatible endpoint; one host per model (see below). The only provider restricted accounts can use. |
| **OpenAI** | GPT-4o, GPT-4o Mini, GPT-4.1 | API key required |
| **Anthropic** | Claude Sonnet 4, Claude Opus 4, Claude Haiku 4 | API key required |
| **Google AI** | Gemini 3.1 Flash-Lite (Preview), Gemini 2.5 Flash, Gemini 2.5 Flash-Lite, Gemini 2.5 Pro, Gemini 3 Flash (Preview) | API key required |

Local models are listed in `lib/providers/local-config.ts`, the single source of truth for their ids, hosts and chat-template options.

## Getting started

### Requirements
- Node.js 22
- For the local provider: an OpenAI-compatible server (`/v1/chat/completions`), e.g. vLLM

### Install

```bash
git clone https://github.com/walehn/rad-conclusion.git
cd rad-conclusion
npm install
```

### Configure

Create `.env.local`:

```bash
# Required: encrypts the session cookie (32+ characters)
SESSION_SECRET=change-me-to-a-long-random-string

# Required to save API keys on the Settings page
API_KEY_ENCRYPTION_SECRET=another-long-random-string

# Local LLM hosts (without /v1); defaults shown
RAD_LOCAL_DEEPSEEK_HOST=http://localhost:8888   # DeepSeek V4 Flash
RAD_LOCAL_HOST=http://localhost:8080            # Qwen3.6 35B
# Optional: model id used when the request names none
# RAD_LOCAL_MODEL=deepseek-v4-flash-0731

# Optional server-side keys for hosted providers (fallback when an account has none)
# OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...
# GOOGLE_AI_API_KEY=AI...

# Optional: one JSON line per generation with latency figures
# RAD_PERF_LOG=1
```

### Database

```bash
npm run db:migrate   # creates data/auth.sqlite and applies drizzle/ migrations
```

Create the first account with `npm run seed:user -- <id> --role admin`. It applies pending migrations itself and asks for the password in the terminal, without echoing it; the default role is `restricted`. After that, further accounts come from invite links on `/admin/accounts`.

> Of `scripts/`, only `seed-user.ts` (account seeding) and `migrate.js` (the migration runner a container calls from `entrypoint.sh`) are in this repository. The prompt-revision helper, local analysis tools, `Dockerfile`, `docker-compose.yml` and `.dockerignore` are kept out.

### Development

```bash
npm run dev    # http://localhost:3001
npm test       # Vitest
```

### Production

```bash
npm run build
npm run start -- --hostname 127.0.0.1   # http://127.0.0.1:3957
```

Next.js warns that `next start` does not match the `output: "standalone"` setting in `next.config.ts`; the server still runs, using `data/` in the repository folder. A container deployment runs `.next/standalone/server.js` instead, which changes into its own folder, so `data/` and `drizzle/` must sit next to it there; `entrypoint.sh` runs `scripts/migrate.js` before starting it.

The footer shows `v<package.json version>` and `Updated <build date> · <commit>`. The commit comes from `BUILD_COMMIT`, or from `git` when the build runs inside a checkout.

## Security model

- **IP allowlist** — `middleware.ts` admits only listed client addresses (exact addresses in `ALLOWED_IPS`, ranges in `ALLOWED_RANGES`). It reads the client address from `CF-Connecting-IP`, then `X-Forwarded-For`, then `X-Real-IP`, so the app **must sit behind a proxy that sets these headers** (e.g. Cloudflare Tunnel) and listen on `127.0.0.1` only. If the port is reachable directly, the headers can be forged.
- **Sessions** — encrypted cookie (iron-session). Role, suspension and "signed out after" are checked against the database on every request.
- **CSRF** — double-submit cookie plus an Origin/Host check on state-changing requests.
- **Rate limits** — failed logins per IP and per account; failed account-link attempts per IP.

## Data

Everything the app stores is under `data/`, which is git-ignored:

| File | Contents |
|------|----------|
| `data/auth.sqlite` | Accounts, encrypted API keys, generation history (Findings and outputs), structured reports, account links |
| `data/votes.jsonl` | A/B votes |
| `data/eval.sqlite` | Offline evaluation results |

Findings text is stored as typed. Do not enter patient identifiers, and treat `data/` as clinical data: never commit or share it.

## Prompt versioning

Every generated conclusion records which prompt text produced it, so history stays comparable after a prompt is edited.

- `lib/prompts/revisions.ts` is the change log: `r1` (2026-08-25) is the base prompt; `r2` (2026-10-14) replaced v1 with the house-style prompt.
- Each revision is identified by a short sha256 over every prompt the code can render (both versions, all language/style combinations).
- `generations.prompt_revision` and `generations.prompt_hash` are stamped on each row at generation time.
- `npm test` fails when `lib/prompts/system-prompt.ts` changes without a new registry entry; the failing test prints the new fingerprint. `npm run prompt:revision` prints a ready-to-paste entry; its script is local-only and not in this repository.

## Offline evaluation

`npm run eval -- <command>` scores recorded conclusions without touching the app database (opened read-only; results go to `data/eval.sqlite`):

| Command | Purpose |
|---------|---------|
| `rules` | Rule checks on new generations |
| `judge --judge local\|gemini` | LLM judge |
| `report [--by version\|revision\|model\|month\|all]` | Summary tables |
| `show <id>` | One generation with its results |
| `deid` | Preview what an external judge receives |
| `import-finals <reports.jsonl>` | Import signed reports and match them to generations |
| `replay --candidates v2,r2 --set matched\|pacs` | Regenerate past inputs with candidate prompts and score them against signed conclusions |
| `findings-review` | Internal-consistency review of signed Findings |

See the header of `lib/eval/cli.ts` for every option.

## Project structure

```
rad-conclusion/
├── app/
│   ├── api/
│   │   ├── generate/                 # Conclusion streaming
│   │   ├── structured-report/        # Structured report streaming
│   │   ├── vote/                     # A/B votes
│   │   ├── generations/              # History
│   │   ├── auth/                     # Login, logout, password change
│   │   ├── account-links/            # Invite / reset link check and use (public)
│   │   ├── admin/                    # Accounts, links, suspension (admin)
│   │   ├── providers/                # Provider list and connection check
│   │   └── user/api-keys/            # Per-account API keys
│   ├── conclusion/                   # Conclusion generator
│   ├── structured-report/            # Disease selector and per-disease forms
│   ├── review/                       # History and prompt revisions
│   ├── settings/                     # Password, API keys, providers
│   ├── admin/accounts/               # Account admin
│   ├── account/setup/                # Invite / reset link page
│   ├── login/
│   ├── design-demo/                  # Design reference pages
│   └── page.tsx                      # Dashboard
├── components/                       # Forms, outputs, navigation, UI primitives
├── lib/
│   ├── auth/                         # Sessions, roles, CSRF, rate limits, account links
│   ├── providers/                    # Provider registry and local model catalog
│   ├── prompts/                      # Conclusion prompts, revisions, disease templates
│   ├── eval/                         # Offline evaluation CLI
│   ├── db/                           # Drizzle schema and SQLite client
│   ├── crypto/ · api-keys/           # API key encryption and lookup
│   ├── findings-check.ts             # Rejects input without findings
│   └── post-process.ts               # Cleans model output
├── drizzle/                          # SQL migrations
├── tests/                            # Vitest suites
├── docs/notion-tone-guide.md         # UI tone guide
└── middleware.ts                     # IP allowlist and CSRF cookie
```

## Tech stack

| Category | Technology |
|----------|-----------|
| Framework | Next.js 15, React 19 |
| Styling | Tailwind CSS 4 |
| LLM | AI SDK 7 (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`) |
| Database | SQLite via better-sqlite3, Drizzle ORM |
| Auth | iron-session, @node-rs/argon2 |
| Language | TypeScript 5.8, Zod 4 |
| Tests | Vitest, Testing Library, happy-dom |
| UI | shadcn/ui-style components, Radix Dialog, Lucide icons |

## Built with

This project was built using [Claude Code](https://claude.ai/claude-code) and [MoAI-ADK](https://github.com/modu-ai/moai-adk) (Agentic Development Kit for Claude Code).

## License

MIT — see [LICENSE](./LICENSE).
