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
- **Conditional rendering for cystic-only fields** (RCC structured form): the `Bosniak` card group and `Predominantly cystic` checkbox now render **only when `massType === "Cystic"`** (previously rendered for Cystic OR a disabled-but-visible state under Solid). They stay collapsed in the initial unselected state and only appear after the user explicitly chooses Cystic — eliminating unnecessary form length both before any selection and for solid masses.
- **Serializer output**: the structured input serializer now emits the `Bosniak` and `Predominantly cystic` lines **only when `massType === "Cystic"`** (previously: Cystic OR undefined, with Solid forced to `Not applicable (solid mass)` placeholders). Cystic masses serialize 16 lines per mass; Solid / undefined / any other mass type serialize 14 lines. Dead-code constants `BOSNIAK_NA_SOLID` and `PRED_CYSTIC_NA_SOLID` removed.
- **System prompt** (`rcc.ts`): instructs the LLM to omit Bosniak/Predominantly cystic bullets for solid masses, matching the new serializer behavior.
- **TECHNIQUE section now includes the exam date** when `Study date` is present in the structured input. Output is language-aware: `Date of examination: YYYY-MM-DD` for `lang=en`, `검사일: YYYY-MM-DD` for `lang=ko` / `mixed`. Line is omitted when no study date is provided.
- **Desktop two-column form layout** for the RCC structured input: `RccMassCard`, `RccStudyLevelCard`, and `RccClinicalContextCard` now render fields in a `md:grid-cols-2` grid with `gap-x-6 gap-y-5`. Bulky controls (`RadioCardGroup` for Trajectory/Bosniak, Predominantly cystic checkbox, LN/Met multi-select, Thrombus details, Clinical Information textarea) span both columns via `md:col-span-2`. Mobile (`<md`) layout is unchanged (single column). Each field is wrapped in a uniform bordered tile (`rounded-lg border border-border p-3`) so labels and controls keep a consistent visual rhythm across SegmentedControl, NumberField, DateInput, and RadioCardGroup.
- **Higher-contrast active state for `SegmentedControl`**: active option now uses `bg-primary text-primary-foreground font-semibold shadow-sm` (Medical Professional teal #0F766E with white bold text) instead of the previous near-white `bg-background`. Container gains `border border-border + p-1 + gap-1` for clearer option separation; option padding bumped to `px-3/4` for larger click targets. Inactive options gain a `hover:bg-background` cue.
- **Stronger selection emphasis for `RadioCardGroup`**: selected card now uses 100% tone border (was 60%), `bg-{tone}/10` (was `/5`), `ring-2 ring-{tone}/50` (was `/40`), `shadow-md`, and `font-bold` label. Hover on unselected cards adds `hover:border-foreground/30 hover:bg-muted/30 hover:shadow-sm` so clickability is more obvious.
- **`CheckboxGroup` accepts `className`** in `rcc-study-level-card.tsx` so multi-select groups can adopt `md:col-span-2` cleanly.

### Fixed
- **Critical: Radio option label truncation** — long option labels (e.g., `<50% exophytic`, `>=50% exophytic`, `Indeterminate`, `Upper pole`) were collapsing to ellipsis (`...`) under the previous `auto-cols-fr` equal-distribution layout combined with a `truncate` class on each label span. Replaced with `inline-flex flex-wrap items-stretch` + content-sized options + active-button direct highlight; labels now render in full and wrap to a new row only when the container is narrower than the row's natural width. No horizontal scroll, no clipping, full keyboard flow preserved. (SPEC-UI-001)
