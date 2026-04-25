<h1 align="center">Rad Conclusion</h1>

<p align="center">
  <strong>AI-powered Radiology Report Generator</strong>
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

A browser-based radiology AI assistant with two tools: a **Conclusion Generator** that converts Findings text into clinically natural Impression statements via real-time streaming, and a **Structured Report Generator** that produces disease-specific structured reports (currently RCC) following SAR §3.3 format. Supports 4 LLM providers.

## Key Features

- **Real-time streaming** — Token-by-token streaming output from LLM
- **Conclusion Generator** — A/B Compare mode with V1 (Basic) vs V2 (Advanced Dx/DDx) prompt comparison and voting
- **LLM-as-Judge evaluation** — Automated quality scoring of generated conclusions
- **Structured Report Generator** — Disease-specific (RCC) structured input form with SAR §3.3 serialization; tab toggle between Free Text and RCC Structured modes
- **Disease dashboard** — Feature-selection card layout at root (`/`); original conclusion generator at `/conclusion`
- **Common navigation bar** — Sticky nav across all authenticated pages
- **4 LLM providers** — Local LLM, OpenAI, Anthropic, Google AI
- **Session-based authentication** — Email/password login with server-side session management and CSRF protection
- **Dark / Light mode** — Medical-professional teal color theme
- **Output styles** — Numbered, Short, Urgent-First
- **Multilingual output** — English, Korean, Mixed mode
- **Docker deployment** — Production-ready with host network mode for local LLM access
- **Settings page** — Per-provider API key management and connection testing

## Supported LLM Providers

| Provider | Models | Notes |
|----------|--------|-------|
| **Local LLM** | Qwen3.6 35B (A3B-FP8) | OpenAI-compatible API (e.g. vLLM), default host `localhost:8080` |
| **OpenAI** | gpt-4o, gpt-4o-mini, gpt-4.1 | API key required |
| **Anthropic** | Claude Sonnet 4, Claude Opus 4, Claude Haiku 4 | API key required |
| **Google AI** | Gemini 2.5 Flash, Gemini 2.5 Flash-Lite, Gemini 2.5 Pro, Gemini 3 Flash (Preview), Gemini 3.1 Flash-Lite (Preview) | API key required |

## Getting Started

### Installation

```bash
git clone https://github.com/walehn/rad-conclusion.git
cd rad-conclusion
npm install
```

### Development

```bash
npm run dev
# http://localhost:3957
```

### Production (Docker)

```bash
docker compose up -d --build
# http://localhost:3957
```

### Production (Manual)

```bash
npm run build
npm run start
# http://localhost:3957
```

## Configuration

### Environment Variables

Create a `.env.local` file for server-side configuration, or manage API keys via the Settings page in the browser.

```bash
# Local LLM (OpenAI-compatible server)
RAD_LOCAL_HOST=http://localhost:8080
RAD_LOCAL_MODEL=Qwen/Qwen3.6-35B-A3B-FP8

# Commercial provider API keys (optional)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=AI...
```

### Output Styles

| Style | Description |
|-------|-------------|
| **Numbered** | Numbered impression list (1., 2., 3.), ordered by clinical priority |
| **Short** | Concise summary in 2–4 lines |
| **Urgent-First** | Critical/urgent findings listed first |

### Output Languages

| Language | Description |
|----------|-------------|
| **English** | English only (formal radiology report style) |
| **Korean** | Korean with standard radiology terms kept in English |
| **Mixed** | Korean + English blend matching the Findings tone |

## Project Structure

```
rad-conclusion/
├── app/
│   ├── api/
│   │   ├── generate/          # Conclusion streaming API
│   │   ├── evaluate/          # LLM-as-Judge evaluation
│   │   ├── vote/              # A/B vote collection
│   │   ├── auth/              # Login / logout API
│   │   ├── providers/         # Provider list & validation
│   │   └── structured-report/ # Structured report streaming API
│   ├── conclusion/            # Conclusion generator page
│   ├── structured-report/     # Structured report generator page
│   ├── dashboard-cards.tsx    # Feature-selection cards
│   ├── login/                 # Login page
│   ├── settings/              # Provider settings page
│   ├── page.tsx               # Dashboard (feature selection)
│   ├── layout.tsx             # Root layout
│   └── globals.css            # Theme definitions
├── components/
│   ├── ui/                    # Base UI components
│   ├── settings/              # Settings components
│   ├── app-nav.tsx            # Common sticky navigation bar
│   ├── disease-category-indicator.tsx  # Disease category badge (pill/overline)
│   ├── rcc-structured-form.tsx         # RCC 14-field structured input form
│   ├── tabbed-findings-input.tsx       # Tab toggle: Free Text | RCC Structured
│   ├── structured-report-output.tsx    # 6-section streaming output
│   ├── findings-input.tsx     # Free-text findings field
│   ├── conclusion-output.tsx  # Conclusion output area
│   ├── model-selector.tsx     # Provider/model selector
│   ├── options-panel.tsx      # Style/language options
│   └── theme-toggle.tsx       # Dark/light mode toggle
├── lib/
│   ├── auth/                  # Session management, CSRF, auth guard
│   ├── providers/             # LLM provider registry & config
│   ├── prompts/               # Structured report prompts + disease registry
│   │   └── disease-templates/ # RCC fields enum + SAR §3.3 serializer
│   ├── storage/               # Encrypted API key store
│   └── post-process.ts        # LLM output post-processing
├── middleware.ts               # IP allowlist access control
├── docker-compose.yml         # Docker deployment config
├── Dockerfile                 # Multi-stage production build
└── package.json
```

## Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | Next.js 15, React 19 |
| Styling | Tailwind CSS 4 |
| AI/LLM | Vercel AI SDK 4 |
| Provider SDKs | @ai-sdk/openai, @ai-sdk/anthropic, @ai-sdk/google |
| Language | TypeScript 5.8 |
| Validation | Zod |
| UI | Custom shadcn/ui-style components, Lucide React |

## Built With

This project was built using [Claude Code](https://claude.ai/claude-code) and [MoAI-ADK](https://github.com/modu-ai/moai-adk) (Agentic Development Kit for Claude Code).

## Notes

- Local LLM requires an OpenAI-compatible server (`/v1/chat/completions`) running
- When deploying with Docker, use `network_mode: host` to access local LLM bound to `127.0.0.1`
- API keys are managed via server environment variables (Docker) or the Settings page (browser)
- Authentication uses server-side sessions with a CSRF double-submit cookie pattern; set `AUTH_EMAIL` and `AUTH_PASSWORD_HASH` in `.env.local`
- Do not include patient identifiable information (PII) in input

## License

MIT
