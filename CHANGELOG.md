# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- **Structured Report Generator** (`/structured-report`): Disease-specific structured report generator with 6-section streaming output (Background/Technique/Comparison/Findings/Impression/Recommendations)
- **RCC Structured Input Form**: 14-field controlled form for RCC (Renal Cell Carcinoma) findings following SAR §3.3 format with Bosniak 2019 and Neves-Mayo classification support
- **Tab toggle pattern**: WAI-ARIA tablist allowing "Free Text" and "RCC Structured" input modes with state preservation via sessionStorage (`rad:srep:active-tab`)
- **SAR §3.3 serializer**: Pure-function `serializeRccStructuredInput()` that produces standardized `- <Feature>: <Value>` bullet format; 15 unit tests
- **Disease dashboard** (`/`): Feature-selection card layout; original conclusion generator moved to `/conclusion`
- **Common navigation bar**: Sticky `<AppNav>` across all authenticated pages
- **DiseaseCategoryIndicator overline variant**: New `variant="overline"` with `index` prop for above-H1 placement (backward compatible with existing `variant="pill"`)
- **Disease registry**: `lib/prompts/disease-registry.ts` + RCC-specific prompt builder in `lib/prompts/disease-templates/rcc.ts`
- **IPv6 loopback support** (`middleware.ts`): Added `::ffff:127.0.0.1` to ALLOWED_IPS
