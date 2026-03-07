#!/usr/bin/env bash
set -euo pipefail

# Load .env from skills/rad-conclusion if present
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_ENV="$SCRIPT_DIR/../skills/rad-conclusion/.env"
if [[ -f "$SKILL_ENV" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$SKILL_ENV"
  set +a
fi

# rad_conclusion.sh
# Unified Radiology Impression generator — Gemini CLI or local LLM backend.
#
# Usage:
#   cat findings.txt | ./scripts/rad_conclusion.sh [OPTIONS]
#   echo "..." | ./scripts/rad_conclusion.sh --backend local --lang ko
#
# Options:
#   --backend <name>    gemini | local             (default: local)
#   --model <name>      Override model name
#                         gemini default : gemini-3.1-pro-preview
#                         local default  : gpt-oss-120b
#   --host <url>        Local LLM API base URL     (default: $RAD_LOCAL_HOST or http://localhost:5100)
#   --style <mode>      short | numbered | urgent-first  (default: numbered)
#   --lang <mode>       ko | en | mixed             (default: en)
#   --title <string>    Header label                (default: Conclusion)
#   --max-tokens <n>    Max tokens (local only)     (default: 2000)
#
# Requirements:
#   gemini backend : gemini CLI installed + authenticated
#   local backend  : curl, jq, python3; OpenAI-compatible LLM server running

# ── Defaults ─────────────────────────────────────────────────────────────────
BACKEND="local"
MODEL=""
HOST="${RAD_LOCAL_HOST:-http://localhost:5100}"
STYLE="numbered"
LANG="en"
TITLE="Conclusion"
MAX_TOKENS=2000

# ── Arg parsing ───────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --backend)    BACKEND="$2";    shift 2;;
    --model)      MODEL="$2";      shift 2;;
    --host)       HOST="$2";       shift 2;;
    --style)      STYLE="$2";      shift 2;;
    --lang)       LANG="$2";       shift 2;;
    --title)      TITLE="$2";      shift 2;;
    --max-tokens) MAX_TOKENS="$2"; shift 2;;
    -h|--help)
      sed -n '1,35p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

# ── Validate backend ──────────────────────────────────────────────────────────
case "$BACKEND" in
  gemini|local) ;;
  *) echo "Invalid --backend: $BACKEND (choose: gemini | local)" >&2; exit 2;;
esac

# ── Default models ────────────────────────────────────────────────────────────
if [[ -z "$MODEL" ]]; then
  case "$BACKEND" in
    gemini) MODEL="gemini-3.1-pro-preview";;
    local)  MODEL="${RAD_LOCAL_MODEL:-gpt-oss-120b}";;
  esac
fi

# ── Read stdin ────────────────────────────────────────────────────────────────
if [[ -t 0 ]]; then
  echo "No stdin detected. Pipe/paste the Findings text via stdin." >&2
  exit 2
fi
FINDINGS="$(cat)"
if [[ -z "${FINDINGS//[[:space:]]/}" ]]; then
  echo "Empty input." >&2
  exit 2
fi

# ── Language instruction ──────────────────────────────────────────────────────
case "$LANG" in
  ko)    LANG_INSTR="Write the conclusion primarily in Korean (medical style). Keep standard radiology/anatomical terms in English when conventional (e.g., T2WI, SUV, CT, MR, DCIS).";;
  en)    LANG_INSTR="Write the conclusion in English ONLY (formal radiology report style). Do not use Korean.";;
  mixed) LANG_INSTR="Write the conclusion in a natural Korean+English mix that mirrors the tone of the Findings.";;
  *)     echo "Invalid --lang: $LANG (choose: ko | en | mixed)" >&2; exit 2;;
esac

# ── Style instruction ─────────────────────────────────────────────────────────
case "$STYLE" in
  short)
    STYLE_INSTR="Keep it very concise: 2–4 lines total. One sentence per key finding.";;
  numbered)
    STYLE_INSTR="Use a numbered Impression list — 1., 2., 3. — ordered by clinical priority (most important first).";;
  urgent-first)
    STYLE_INSTR="If any potentially urgent or critical finding is present, place it as item (1) with explicit urgency language; list remaining findings in descending priority.";;
  *)
    echo "Invalid --style: $STYLE (choose: short | numbered | urgent-first)" >&2; exit 2;;
esac

# ── System prompt (unified) ───────────────────────────────────────────────────

SYSTEM_PROMPT="You are a board-certified radiologist with subspecialty expertise in diagnostic imaging. Your task is to write a concise, publication-quality ${TITLE} (Impression) section from the provided Findings.

=== CONTENT RULES ===
1. Synthesize — do NOT copy or paraphrase Findings verbatim. Translate observations into clinical meaning.
2. Prioritize — lead with the most clinically significant finding. Minor/incidental findings come last.
3. Actionable language — if a finding warrants follow-up, correlation, or further workup, state it explicitly and briefly (e.g., \"clinical correlation recommended\", \"6-month follow-up CT suggested\").
4. Indeterminate findings — if something cannot be characterized, say so and propose a next step.
5. Relevant negatives — include only clinically meaningful normal findings (e.g., no lymphadenopathy when malignancy is in the differential). Omit unremarkable structures that add no value.
6. No fabrication — do not introduce details, measurements, or diagnoses not present in the Findings. Do not add recommendations, follow-up suggestions, or clinical decisions unless explicitly stated in the Findings.
7. No patient identifiers.

=== STYLE / WRITING QUALITY RULES ===
8. Active, direct language — avoid passive constructions where possible.
9. No filler openers — do NOT start with \"In summary\", \"Overall\", \"Based on the above findings\", or similar redundant preambles.
10. No meta-commentary — do not say \"I hope this helps\", \"Please note\", or reference your own instructions.
11. Consistent terminology — use the same term throughout (e.g., do not switch between \"mass\" and \"lesion\" arbitrarily).
12. Measurements — retain exact numbers from Findings; do not round or approximate.
13. Hedging — use appropriate radiologic hedging only when genuinely uncertain (\"likely\", \"compatible with\", \"cannot exclude\"). Do not over-hedge clear findings.

=== OUTPUT FORMAT ===
- First line: \"${TITLE}:\" — nothing before it, no markdown bold/italic.
- Then the conclusion content.
- When numbered style is requested, format each item as 1. ..., 2. ..., 3. ... (NOT (1) style, NOT bullets).
- No preamble, no postscript. No reasoning. Output the conclusion directly.

${LANG_INSTR}
${STYLE_INSTR}"

USER_PROMPT="FINDINGS:
${FINDINGS}

Write the ${TITLE} section now."

# ── Timer start ───────────────────────────────────────────────────────────────
START_TS=$(python3 -c "import time; print(time.perf_counter())")

# ═════════════════════════════════════════════════════════════════════════════
# BACKEND: GEMINI
# ═════════════════════════════════════════════════════════════════════════════
if [[ "$BACKEND" == "gemini" ]]; then
  if ! command -v gemini >/dev/null 2>&1; then
    echo "Error: 'gemini' CLI not found. Install it and authenticate first." >&2
    exit 127
  fi

  FULL_PROMPT="${SYSTEM_PROMPT}

---
${USER_PROMPT}"

  printf "%s" "$FINDINGS" | gemini -m "$MODEL" -o text -p "$FULL_PROMPT"

# ═════════════════════════════════════════════════════════════════════════════
# BACKEND: LOCAL (OpenAI-compatible LLM server)
# ═════════════════════════════════════════════════════════════════════════════
elif [[ "$BACKEND" == "local" ]]; then
  for cmd in curl jq python3; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      echo "Error: '$cmd' is required for local backend." >&2
      exit 127
    fi
  done

  PAYLOAD=$(jq -n \
    --arg model "$MODEL" \
    --arg system "$SYSTEM_PROMPT" \
    --arg user "$USER_PROMPT" \
    --argjson max_tokens "$MAX_TOKENS" \
    '{
      model: $model,
      messages: [
        {role: "system", content: $system},
        {role: "user",   content: $user}
      ],
      max_tokens: $max_tokens,
      temperature: 0.3,
      top_p: 0.9,
      stream: false
    }')

  TMP_RESP=$(mktemp)
  curl -sf "${HOST}/v1/chat/completions" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" > "$TMP_RESP"

  TMP_PARSED=$(mktemp)
  python3 - "$TMP_RESP" "$TITLE" > "$TMP_PARSED" <<'PYEOF'
import sys, json, re, base64

with open(sys.argv[1]) as f:
    d = json.load(f)
title = sys.argv[2]
c = d['choices'][0]
content = c['message']['content']
finish = c.get('finish_reason', '')

# Korean aliases for common English titles
KO_ALIASES = {'Conclusion': '결론', 'Impression': '인상소견', 'Summary': '요약'}
ko_title = KO_ALIASES.get(title, '')

# Build regex pattern: matches title OR Korean alias, with optional bold markers
titles_pat = re.escape(title)
if ko_title:
    titles_pat = f'(?:{titles_pat}|{re.escape(ko_title)})'
pattern = re.compile(r'(?:^|\*+)' + titles_pat + r'(?:\*+)?:', re.MULTILINE)

def strip_bold(text, t, ko_t):
    """Remove bold markdown around title: **Title**: or **Title:**"""
    text = re.sub(r'\*+(' + re.escape(t) + r')\*+:', r'\1:', text)
    text = re.sub(r'\*+(' + re.escape(t) + r':)\*+', r'\1', text)
    if ko_t:
        text = re.sub(r'\*+(' + re.escape(ko_t) + r')\*+:', r'\1:', text)
        text = re.sub(r'\*+(' + re.escape(ko_t) + r':)\*+', r'\1', text)
    return text

def extract_from_last_title(text):
    matches = list(pattern.finditer(text))
    if matches:
        last = matches[-1]
        return strip_bold(text[last.start():], title, ko_title)
    return None

# 1) Try to find title in full content
result = extract_from_last_title(content)

# 2) If not found and content starts with 'thought\n', search inside thought block
if result is None and content.startswith('thought\n'):
    rest = content[len('thought\n'):]
    result = extract_from_last_title(rest)
    if result is None:
        result = rest  # best-effort: return everything after thought\n

content = (result if result is not None else content).strip()

# Strip leading/trailing whitespace
content = content.strip()

print(finish + '|||' + base64.b64encode(content.encode()).decode())
PYEOF
  rm -f "$TMP_RESP"

  PARSED=$(cat "$TMP_PARSED"); rm -f "$TMP_PARSED"
  FINISH_REASON="${PARSED%%|||*}"
  CONTENT=$(echo "${PARSED#*|||}" | base64 -d)

  echo "$CONTENT"

  if [[ "$FINISH_REASON" == "length" ]]; then
    echo "" >&2
    echo "[WARNING] Output truncated (max_tokens=${MAX_TOKENS}). Use --max-tokens to increase." >&2
  fi
fi

# ── Timer end ─────────────────────────────────────────────────────────────────
END_TS=$(python3 -c "import time; print(time.perf_counter())")
ELAPSED=$(python3 -c "print(f'{float(\"${END_TS}\") - float(\"${START_TS}\"):.2f}')")
echo "Elapsed: ${ELAPSED}s  [backend: ${BACKEND}, model: ${MODEL}]"
