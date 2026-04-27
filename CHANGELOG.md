# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- **Server-side API key storage**: API keys now stored per-account in SQLite with AES-256-GCM encryption; keys persist across browser sessions and multiple devices
- **API key management endpoints**: `GET/POST /api/user/api-keys` and `DELETE /api/user/api-keys/[provider]` for per-user CRUD; all protected by session auth and CSRF
- **localStorage migration banner**: First-visit detection prompts users to migrate existing browser-stored keys to server storage
- **New environment variable**: `API_KEY_ENCRYPTION_SECRET` required for server-side key encryption
- **Structured Report Generator** (`/structured-report`): Disease-specific structured report generator with 6-section streaming output (Background/Technique/Comparison/Findings/Impression/Recommendations)
- **RCC Structured Input Form**: 14-field controlled form for RCC (Renal Cell Carcinoma) findings following SAR §3.3 format with Bosniak 2019 and Neves-Mayo classification support
- **Tab toggle pattern**: WAI-ARIA tablist allowing "Free Text" and "RCC Structured" input modes with state preservation via sessionStorage (`rad:srep:active-tab`)
- **SAR §3.3 serializer**: Pure-function `serializeRccStructuredInput()` that produces standardized `- <Feature>: <Value>` bullet format; 15 unit tests
- **Disease dashboard** (`/`): Feature-selection card layout; original conclusion generator moved to `/conclusion`
- **Common navigation bar**: Sticky `<AppNav>` across all authenticated pages
- **DiseaseCategoryIndicator overline variant**: New `variant="overline"` with `index` prop for above-H1 placement (backward compatible with existing `variant="pill"`)
- **Disease registry**: `lib/prompts/disease-registry.ts` + RCC-specific prompt builder in `lib/prompts/disease-templates/rcc.ts`
- **IPv6 loopback support** (`middleware.ts`): Added `::ffff:127.0.0.1` to ALLOWED_IPS
- **SegmentedControl component** (`components/ui/segmented-control.tsx`): Generic, accessible radio-style toggle with CVA size variants (sm/md), full ARIA radiogroup semantics, roving tabindex, and keyboard navigation (arrows/Home/End/Space/Enter). Active option highlighted via direct background+ring (Radix Toggle Group / Linear / Vercel pattern). (SPEC-UI-001)
- **RadioCardGroup component** (`components/ui/radio-card-group.tsx`): Generic radio card grid with semantic tone variants (`neutral` | `success` | `warning` | `orange` | `destructive`), responsive `columns 1|2|3`, left accent bar, optional sublabel, and disabled-state lock icon with `aria-describedby` note.
- **Semantic color coding for clinical radios**: Bosniak v2019 grades (I/II → success "Benign", IIF → warning "Surveillance", III → orange "Surgical", IV → destructive "Malignant") and Trajectory (New/Increasing → destructive "Active growth", Stable → neutral, Decreasing → success "Regression"). Color is always paired with text label and sublabel (WCAG 1.4.1 — never color-alone).
- **`--color-orange` design token** in `app/globals.css` (light + dark) for the Bosniak III tone.
- **Color-coding disclaimer banner** at the top of `RccStructuredForm`: notifies users that color is a visual aid and clinical decisions remain the radiologist's responsibility (Korean visible + sr-only English).
- **`lib/ui/rcc-options-meta.ts`**: Tone/sublabel mapping for Bosniak and Trajectory radio options.

### Changed
- **Migrated 14 radio inputs** in the structured input form to the unified primitives: (SPEC-UI-001)
  - `rcc-mass-card.tsx` — 11 radios (Bosniak + Trajectory as `RadioCardGroup`; Side, Mass type, Margins, Cranio-caudal, Macroscopic Fat, Solid Enhancement, Axial Location, Exophytic Ratio, Thrombus Kind as `SegmentedControl`)
  - `rcc-study-level-card.tsx` — 2 radios (Regional LN, Distant Met as `SegmentedControl`)
  - `structured-report-client.tsx` — 1 radio (Modality hint as `SegmentedControl`)
  - All call-site behavior preserved: controlled `value`/`onChange`, `disabled` + `disabledNote` (Bosniak gated by `massType=Solid`), Thrombus / LN / Met sub-field branching, Mass type cysticPredominant reset.
- **Removed local `RadioGroup<T>` helpers** previously inlined in `rcc-mass-card.tsx` and `rcc-study-level-card.tsx`.
- **Conditional rendering for cystic-only fields** (RCC structured form): when `massType === "Solid"`, the `Bosniak` card group and `Predominantly cystic` checkbox are now removed from the DOM (previously displayed in a disabled state with `Not applicable (solid mass)` notes). Eliminates unnecessary form length when the Bosniak classification is not applicable.
- **Serializer output**: the structured input serializer now omits the `Bosniak` and `Predominantly cystic` lines entirely for solid masses (previously emitted `Not applicable (solid mass)` placeholders). Solid masses now serialize 14 lines per mass; cystic still 16. Dead-code constants `BOSNIAK_NA_SOLID` and `PRED_CYSTIC_NA_SOLID` removed.
- **System prompt** (`rcc.ts`): instructs the LLM to omit Bosniak/Predominantly cystic bullets for solid masses, matching the new serializer behavior.
- **TECHNIQUE section now includes the exam date** when `Study date` is present in the structured input. Output is language-aware: `Date of examination: YYYY-MM-DD` for `lang=en`, `검사일: YYYY-MM-DD` for `lang=ko` / `mixed`. Line is omitted when no study date is provided.

### Fixed
- **Critical: Radio option label truncation** — long option labels (e.g., `<50% exophytic`, `>=50% exophytic`, `Indeterminate`, `Upper pole`) were collapsing to ellipsis (`...`) under the previous `auto-cols-fr` equal-distribution layout combined with a `truncate` class on each label span. Replaced with `inline-flex flex-wrap items-stretch` + content-sized options + active-button direct highlight; labels now render in full and wrap to a new row only when the container is narrower than the row's natural width. No horizontal scroll, no clipping, full keyboard flow preserved. (SPEC-UI-001)
