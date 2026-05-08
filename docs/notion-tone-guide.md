# Notion-Tone Application Guide

이 문서는 `rad_conclusion` 프로젝트에 적용된 **절제된 Notion 톤**을 다른 페이지에 동일하게 옮길 수 있도록 정리한 가이드입니다. `app/conclusion/conclusion-client.tsx` 가 표준 구현 예시입니다.

- **출처**: [VoltAgent/awesome-design-md – notion](https://github.com/VoltAgent/awesome-design-md) → `design-md/notion/DESIGN.md`
- **브랜치**: `design/notion-tone`
- **레퍼런스 데모**: `app/design-demo/notion/page.tsx` (마케팅 톤, 풀 변형)
- **레퍼런스 적용**: `app/conclusion/conclusion-client.tsx` (임상 워크스페이스 톤, 절제 변형)

---

## 1. 디자인 철학

| 항목 | 원본 Notion | 임상용(이 프로젝트) |
| --- | --- | --- |
| Hero band | 네이비 + 6색 이모지 도트 | **제거** — hairline border 만 |
| 카드 tint | 6종 파스텔 (peach/rose/mint…) | **흰색 카드 + hairline 보더** |
| 풀 pill 버튼 | 모든 버튼 | **CTA에만** (Generate 같은 주 액션) |
| 컬러 도트/이모지 라벨 | 곳곳에 | **거의 제거** (페이지 아이콘 1개) |
| 다층 elevation | 적극적 | `shadow-none`, 보더만 |
| Reading width | `max-w-3xl` | 단일 = `max-w-3xl`, 작업 도구 = `max-w-6xl` (2단) |

**한 줄 정리**: Notion의 *워크스페이스 페이지 메타포* 와 *따뜻한 미니멀리즘 팔레트* 는 가져오되, 캐주얼한 컬러 액센트는 빼고 임상 도메인의 정밀함을 유지합니다.

---

## 2. Color Tokens

페이지 wrapper에서 **CSS 변수 override 방식**으로 적용합니다. `globals.css` 의 전역 토큰은 절대 손대지 않습니다 (다른 페이지에 영향 없음).

### 2.1 인라인 적용 코드 (`notionTokens` 상수)

```tsx
const notionTokens = {
  "--color-background": "#fafaf9",         // warm off-white canvas
  "--color-foreground": "#37352f",         // charcoal ink
  "--color-muted":      "#f0eeec",
  "--color-muted-foreground": "#787671",
  "--color-border":     "#e5e3df",
  "--color-input":      "#e5e3df",
  "--color-ring":       "#5645d4",
  "--color-primary":    "#5645d4",         // Notion purple, CTA에만
  "--color-primary-foreground": "#ffffff",
  "--color-secondary":  "#f6f5f4",
  "--color-secondary-foreground": "#37352f",
  "--color-card":       "#ffffff",
  "--color-card-foreground": "#37352f",
  "--color-popover":    "#ffffff",
  "--color-popover-foreground": "#37352f",
  "--color-accent":     "#f0eeec",
  "--color-accent-foreground": "#37352f",
} as React.CSSProperties;

// 페이지 최상단 wrapper에 적용
<div className="min-h-screen" style={{ ...notionTokens, background: "#fafaf9" }}>
  ...
</div>
```

이렇게 하면 자식 트리 안의 shadcn `<Card>`, `<Button>` 등도 자동으로 새 팔레트를 따릅니다.

### 2.2 인라인 색 상수 (`C` 객체)

자식 컴포넌트 안에서 직접 색을 쓰는 경우, 페이지 컴포넌트 안에 `C` 상수를 정의합니다:

```tsx
const C = {
  canvas:        "#fafaf9",
  surface:       "#f6f5f4",
  surfaceSoft:   "#fbfaf8",
  card:          "#ffffff",
  hairline:      "#e5e3df",   // 기본 보더
  hairlineSoft:  "#ede9e4",   // 더 옅은 구분선
  ink:           "#1a1a1a",   // 가장 진한 헤딩
  charcoal:      "#37352f",   // 본문 텍스트
  slate:         "#5d5b54",   // 보조 텍스트
  steel:         "#787671",   // 라벨/메타
  stone:         "#a4a097",   // 더 옅은 메타
  primary:       "#5645d4",   // Notion purple
  primaryDeep:   "#4534b3",   // hover/pressed
  accentBg:      "#e6e0f5",   // pill 배경
  accentText:    "#5645d4",   // pill 텍스트
  cardLavender:  "#f5f2fa",   // callout 배경
};
```

### 2.3 절대 쓰지 말 것

- 6색 파스텔 카드 (`#ffe8d4`, `#fde0ec`, `#d9f3e1` 등) — 마케팅 데모에만 사용
- 네이비 hero (`#0a1530`) — 의료 도구에서 너무 무거움
- 이모지 도트 (📋🧠🫁) — 임상 도구에 부적절

---

## 3. Typography Scale

| 역할 | 크기 | 굵기 | letter-spacing | 비고 |
| --- | --- | --- | --- | --- |
| Page H1 | **44px** | 700 | -0.6px | 페이지 타이틀 |
| Page subtitle | 15px | 400 | normal | 부제 |
| Section H2 (Block) | 15px | 600 | -0.1px | Block 라벨 |
| OutputBlock H3 | 20px | 600 | -0.2px | 결과 헤딩 |
| Body | 14–15px | 400 | normal | 본문 |
| Property label (dt) | 13px | 400 | normal | dl 좌측 라벨 |
| Caption / hint | 12–13px | 400 | normal | 메타정보 |
| Eyebrow / pill | 11px | 500 | **0.08em** | uppercase 라벨 |

**원칙**:
- weight는 400 / 500 / 600 / 700 네 단계만 사용
- 헤딩에만 negative tracking (-0.2px ~ -0.6px), 본문은 normal
- `text-balance` 를 H1에 적용하면 줄바꿈이 균등해져 더 Notion 스럽게

---

## 4. Layout Architecture

### 4.1 페이지 셸 (Sidebar + Main)

```tsx
<div style={{ ...notionTokens, background: C.canvas }} className="min-h-screen">
  <div className={
    sidebarCollapsed
      ? "grid"
      : "grid lg:grid-cols-[260px_minmax(0,1fr)]"
  }>
    {/* 좌측: 워크스페이스 사이드바 */}
    {!sidebarCollapsed && (
      <aside className="hidden border-r lg:block"
             style={{
               background: C.surfaceSoft,
               borderColor: C.hairlineSoft,
               position: "sticky",
               top: 56,                                  /* AppNav 높이 */
               alignSelf: "flex-start",
               height: "calc(100vh - 56px)",
               overflowY: "auto",
             }}>
        ...
      </aside>
    )}

    {/* 우측: 메인 페이지 */}
    <main className="px-4 sm:px-8 lg:px-14" style={{ background: C.canvas }}>
      {sidebarCollapsed && <ExpandToggle />}
      <div className="mx-auto max-w-6xl py-10">
        {/* 페이지 메타: breadcrumb, emoji, h1, subtitle, properties */}
        {/* 작업 영역: 2-col grid */}
        {/* 푸터 */}
      </div>
    </main>
  </div>
</div>
```

**주의**:
- `top: 56` 은 RootLayout 의 `AppNav` 높이. AppNav 가 없는 페이지면 `top: 0`.
- 사이드바는 `sticky` + `height: calc(100vh - 56px)` 조합으로 화면 안에서만 스크롤됨.

### 4.2 메인 페이지 메타 영역 (위에서 아래)

순서가 시그니처입니다 — 임의로 뒤바꾸면 Notion 느낌이 깨집니다.

1. **Breadcrumb** (12px, `C.steel`, `ChevronRight` 구분자, 마지막 항목만 `C.charcoal`)
2. **Page icon** (`EmojiPickerTrigger`, 56×56)
3. **Page title** (H1, 44px, weight 700, `-0.6px`)
4. **Subtitle** (15px, `C.slate`)
5. **Property bar** (`dl` grid, 좌측 라벨 / 우측 pill 또는 텍스트 값)
6. **Divider** (`my-8 h-px`, `C.hairlineSoft`)

### 4.3 작업 영역 (Single vs 2-col)

**기준**: 페이지가 *읽기 위주* 면 single, *입력 + 결과* 면 2-col.

```tsx
{/* 2-col 작업 영역 */}
<div className="grid gap-x-8 gap-y-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
  {/* LEFT: input column — 자연 흐름 */}
  <div className="flex min-w-0 flex-col">
    <Block ...>...</Block>
    <CalloutBlock ...>...</CalloutBlock>
    <CtaFrame />
  </div>

  {/* RIGHT: output column — sticky on desktop */}
  <div className="mt-10 flex min-w-0 flex-col lg:mt-7 lg:sticky lg:self-start"
       style={{ top: 80 }}>
    <OutputBlock ...>...</OutputBlock>
  </div>
</div>
```

**핵심**:
- `minmax(0, 1fr)` 로 좌우 같은 비율, 자식의 `min-content` 로 인한 grid blowout 방지
- 우측만 `lg:sticky lg:self-start top:80` → 데스크톱에선 결과가 고정, 모바일/태블릿에선 자연스럽게 아래로 떨어짐
- `min-w-0` 를 좌우 컬럼에 모두 적용해야 긴 텍스트가 컬럼 밖으로 안 비어져 나옴

---

## 5. Reusable Components

모두 `app/conclusion/conclusion-client.tsx` 의 파일 끝에 정의되어 있습니다. 다른 페이지에서 재사용하려면 별도 모듈로 추출하는 것이 좋습니다 — 추출 위치 제안: `components/notion-tone/{Block,CalloutBlock,OutputBlock,SidebarSection,SidebarItem,PropRow,EmojiPickerTrigger}.tsx`.

### 5.1 `Block`

라벨 위 / 흰 카드 아래 — 가장 기본 블록. Notion 페이지에서 헤딩 + 콘텐츠 블록 한 단위에 해당.

```tsx
<Block label="Configuration" hint="Provider, model, and output format.">
  ...children...
</Block>
```

```tsx
function Block({ label, hint, children }: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-7">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-semibold"
            style={{ color: "#1a1a1a", letterSpacing: "-0.1px" }}>
          {label}
        </h2>
        {hint && (
          <span className="text-[12px]" style={{ color: "#787671" }}>
            {hint}
          </span>
        )}
      </div>
      <div className="mt-2 rounded-lg border p-4"
           style={{ borderColor: "#e5e3df", background: "#ffffff" }}>
        {children}
      </div>
    </section>
  );
}
```

### 5.2 `CalloutBlock`

좌측 4px 컬러 바 + 옅은 배경. 페이지에서 **가장 중요한 입력 한 곳에만** 사용 (페이지당 1개 권장). 시각적 대비로 시선이 끌림.

```tsx
<CalloutBlock
  label="Findings"
  hint="0 characters · paste from your dictation"
  note="Paste exactly what you dictated. Don't pre-format — standards-aware parsing happens at generation time."
  barColor={C.primary}
  tint={C.cardLavender}
  borderColor={C.accentBg}
>
  <FindingsInput ... />
</CalloutBlock>
```

내부 구조: `border-l-4` 컬러 바 + `tint` 배경 + 안내문 + children.

### 5.3 `OutputBlock`

라벨 + H3 + pill 헤더 + 컨테이너. A/B variant 결과 표시에 적합.

```tsx
<OutputBlock
  label="Variant V1"
  title="Basic"
  pill={{ text: "baseline", bg: C.surface, color: C.slate }}
  C={C}
>
  ...
</OutputBlock>

<OutputBlock
  label="Variant V2"
  title="Advanced — Dx / DDx"
  pill={{ text: "experimental", bg: C.accentBg, color: C.primary }}
  C={C}
  highlight
>
  ...
</OutputBlock>
```

`highlight` props 는 강조용 — 보더가 `C.accentBg` 로 lavender 톤 변경.

### 5.4 `SidebarSection` / `SidebarItem`

워크스페이스 사이드바의 트리 메타포.

```tsx
<SidebarSection title="Quick access" mt={10}>
  <SidebarItem icon={<Sparkles className="h-3.5 w-3.5" />} active>
    New conclusion
  </SidebarItem>
  <SidebarItem icon={<FileText className="h-3.5 w-3.5" />}>
    Drafts
  </SidebarItem>
</SidebarSection>

<SidebarSection
  title="Templates"
  mt={6}
  action={<Plus className="h-3.5 w-3.5" />}
>
  ...
</SidebarSection>
```

**Notion 트리 색상 규칙**:
- 활성: 배경 `#ece8f7` (옅은 lavender), 텍스트 `C.charcoal`, 아이콘 `C.primary`, weight 500
- 비활성: 배경 `transparent`, 텍스트 `C.slate`, 아이콘 `C.stone`

### 5.5 `PropRow`

페이지 properties (Notion 의 `Status: In progress`, `Tags: ...` 같은 행).

```tsx
<dl className="mt-6 grid grid-cols-1 gap-y-1.5 text-[13px] sm:grid-cols-[120px_1fr]"
    style={{ color: C.charcoal }}>
  <PropRow label="Modality" value="MRI / CT / Mammography" />
  <PropRow label="Standard" value="Numbered list" pillBg={C.surface} />
  <PropRow label="Mode"     value="A/B compare"
           pillBg={C.accentBg} pillColor={C.primary} />
  <PropRow label="Length"   value="0 characters" muted />
</dl>
```

**값 표현 두 종류**:
- `pillBg` 지정 → pill 형태 (배경색 있음, 살짝 더 강조)
- `pillBg` 없음 → 그냥 텍스트 (`muted` 시 `C.steel` 색상)

### 5.6 `EmojiPickerTrigger`

페이지 아이콘 자리. 클릭하면 popover 가 열리고 18종 의료 emoji 그리드. localStorage 동기화.

```tsx
const [pageEmoji, setPageEmoji] = React.useState<string | null>("🩺");
const [emojiPickerOpen, setEmojiPickerOpen] = React.useState(false);

<EmojiPickerTrigger
  emoji={pageEmoji}
  open={emojiPickerOpen}
  onOpenChange={setEmojiPickerOpen}
  onSelect={(e) => { setPageEmoji(e); setEmojiPickerOpen(false); }}
  onClear={() => { setPageEmoji(null); setEmojiPickerOpen(false); }}
  C={C}
/>
```

**동작**:
- 외부 클릭 / Esc 로 닫힘
- hover 시 우하단 흰 원에 작은 `Smile` 아이콘 + lavender ring (affordance)
- "Remove" 버튼으로 emoji 해제 → 기본 lucide 아이콘 (현재는 `Stethoscope`) 으로 폴백
- 18종 emoji: 🩺 🩻 🧠 🫀 🫁 🦴 🩸 💉 💊 🧬 🔬 🧪 🩹 ⚕️ 📋 📝 🔍 📊
- 다른 도메인이면 `MEDICAL_EMOJI` 배열만 갈아끼우면 됨

---

## 6. Behavioral Patterns

### 6.1 localStorage 키 (네이밍 규약)

```
radc.sidebar-collapsed   "0" | "1"
radc.page-emoji          "🩺" | (없음 → null fallback)
```

페이지/기능별 prefix 는 `radc.` 로 통일. 새 키 추가 시 동일 prefix 유지.

### 6.2 Hydration 안전 패턴

```tsx
const [hydrated, setHydrated] = React.useState(false);
const [foo, setFoo] = React.useState<T>(defaultValue);

// 마운트 후 localStorage 에서 값 로드
React.useEffect(() => {
  try {
    const saved = localStorage.getItem("radc.foo");
    if (saved) setFoo(parse(saved));
  } catch {}
  setHydrated(true);
}, []);

// 값 변경 시 localStorage 에 저장 (마운트 전엔 저장 X)
React.useEffect(() => {
  if (!hydrated) return;
  try {
    localStorage.setItem("radc.foo", serialize(foo));
  } catch {}
}, [foo, hydrated]);
```

`hydrated` 플래그 없이 useEffect 하면 SSR/CSR 미스매치로 hydration warning 이 발생합니다.

### 6.3 SSR 가드 (document/window 접근)

```tsx
function getCsrfToken(): string {
  if (typeof document === "undefined") return "";   // ← SSR 가드 필수
  return document.cookie
    .split("; ")
    .find((c) => c.startsWith("csrf_token="))
    ?.split("=")[1] ?? "";
}
```

Client Component 라도 첫 렌더는 서버에서 일어납니다. `document` / `window` / `localStorage` 직접 접근은 모두 가드 또는 useEffect 안으로.

### 6.4 사이드바 토글 / 펼침 토글

```tsx
{/* Sidebar 안의 collapse 버튼 (펼침 → 접기) */}
<button onClick={() => setSidebarCollapsed(true)}>
  <PanelLeftClose className="h-4 w-4" />
</button>

{/* Main 영역의 expand 버튼 (접힘 상태에서만 노출) */}
{sidebarCollapsed && (
  <button onClick={() => setSidebarCollapsed(false)}>
    <PanelLeftOpen /> Open sidebar
  </button>
)}
```

토글 버튼은 두 군데 — Notion 표준입니다. 한 군데만 두면 접힌 후 다시 펼치는 진입점이 사라집니다.

---

## 7. 새 페이지에 적용하는 단계

다른 라우트(예: `/structured-report`, `/dashboard`) 에 같은 톤을 적용하려면:

1. **인증 가드 확인** — `requireSession()` 등 기존 가드는 그대로 두고, UI 만 갈아엎습니다.
2. **`notionTokens` 와 `C` 상수 복사** — 페이지 컴포넌트 함수 안에.
3. **워크스페이스 셸 적용** — `sidebarCollapsed` state + grid 분기.
4. **사이드바 항목 변경** — `Quick access`, `Templates` 등 페이지 맥락에 맞게.
   - 현재 페이지를 `active` 로 표시 (`active` prop)
5. **메타 영역 6단 적용** — breadcrumb / emoji / H1 / subtitle / property bar / divider.
6. **작업 영역 결정** — single (`max-w-3xl`) vs 2-col (`max-w-6xl` + grid).
7. **콘텐츠를 Block / CalloutBlock / OutputBlock 으로 감싸기** — 가장 중요한 입력 1개에만 CalloutBlock.
8. **CTA 프레임** — Generate 같은 주 액션은 lavender frame 안의 풀 pill.
9. **localStorage 키 네이밍** — `radc.<기능>-<항목>` 규약.
10. **타입체크** — `npx tsc --noEmit` 으로 0 errors 확인.

---

## 8. 체크리스트 (페이지 적용 전 / 후)

- [ ] `notionTokens` 가 페이지 wrapper 에 적용되어 있는가
- [ ] 헤딩 `weight` 가 600 이상이고 negative tracking 이 적용되었는가
- [ ] 카드는 `shadow-none` + `1px solid #e5e3df` (보더만) 인가
- [ ] CalloutBlock 은 페이지당 **1개** 이하인가 (시각 잡음 방지)
- [ ] 풀 pill 버튼은 주 CTA에만 사용하는가
- [ ] 6색 파스텔 카드 / 이모지 도트가 들어가 있지 않은가
- [ ] 사이드바 collapse 토글이 양쪽(접기/펼치기)에 다 있는가
- [ ] localStorage 키가 `radc.` prefix 를 따르는가
- [ ] `document` / `window` / `localStorage` 직접 접근에 SSR 가드가 있는가
- [ ] `npx tsc --noEmit` 0 errors

---

## 9. 참고 파일

| 파일 | 역할 |
| --- | --- |
| `design-md/notion/DESIGN.md` | 원본 DESIGN.md (VoltAgent 컬렉션) |
| `app/design-demo/notion/page.tsx` | 원본 톤 데모 (마케팅 변형, 풀 컬러) |
| `app/design-demo/page.tsx` | 4종 디자인 비교 인덱스 |
| `app/conclusion/conclusion-client.tsx` | 절제된 임상용 변형 (이 가이드의 표준 구현) |
| `app/globals.css` | **건드리지 말 것** — 다른 페이지의 medical teal 톤 보존 |

---

## 10. 변경 이력

| 일자 | 변경 |
| --- | --- |
| 2026-05-08 | 초안 작성. `app/conclusion` 적용 후 정리. |
