<h1 align="center">Rad Conclusion</h1>

<p align="center">
  <strong>AI-powered Radiology Conclusion Generator</strong>
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

Enter radiological **Findings** text and generate clinically natural **Conclusion/Impression** statements with real-time streaming. Supports 4 LLM providers as a browser-based web application.

## Key Features

- **Real-time streaming** — Token-by-token streaming output from LLM
- **4 LLM providers** — Local LLM, OpenAI, Anthropic, Google AI
- **Dark / Light mode** — Medical-professional teal color theme
- **Encrypted API key storage** — AES-GCM encryption, browser-local only (never sent to server)
- **Output styles** — Numbered, Short, Urgent-First
- **Multilingual output** — English, Korean, Mixed mode
- **Settings page** — Per-provider API key management and connection testing

## Supported LLM Providers

| Provider | Models | Notes |
|----------|--------|-------|
| **Local LLM** | gpt-oss-120b | OpenAI-compatible API, default host `localhost:5100` |
| **OpenAI** | gpt-4o, gpt-4o-mini, gpt-4.1 | API key required |
| **Anthropic** | Claude Sonnet 4, Claude Opus 4 | API key required |
| **Google AI** | Gemini 2.5 Flash, Gemini 2.5 Pro | API key required |

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

### Production

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
RAD_LOCAL_HOST=http://localhost:5100
RAD_LOCAL_MODEL=gpt-oss-120b

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
│   │   ├── generate/          # LLM streaming API endpoint
│   │   └── providers/         # Provider list & validation API
│   ├── settings/              # Provider settings page
│   ├── page.tsx               # Main page
│   ├── layout.tsx             # Root layout
│   └── globals.css            # Theme definitions
├── components/
│   ├── ui/                    # Base UI components (Button, Card, Input, etc.)
│   ├── settings/              # Settings page components
│   ├── findings-input.tsx     # Findings input field
│   ├── conclusion-output.tsx  # Conclusion output area
│   ├── model-selector.tsx     # Provider/model selector
│   ├── options-panel.tsx      # Style/language options
│   └── theme-toggle.tsx       # Dark/light mode toggle
├── lib/
│   ├── providers/             # LLM provider registry & config
│   ├── prompts/               # System prompt builder
│   ├── storage/               # Encrypted API key store
│   └── post-process.ts        # LLM output post-processing
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

## Notes

- Local LLM requires an OpenAI-compatible server (`/v1/chat/completions`) running
- API keys are AES-GCM encrypted and stored in the browser only
- Closing the browser tab invalidates the encryption key; re-entry required
- Do not include patient identifiable information (PII) in input

## License

MIT
