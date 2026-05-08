import Link from "next/link";

// Tokens distilled from awesome-design-md/notion/DESIGN.md
const c = {
  canvas: "#ffffff",
  surface: "#f6f5f4",
  surfaceSoft: "#fafaf9",
  hairline: "#e5e3df",
  hairlineSoft: "#ede9e4",
  ink: "#1a1a1a",
  charcoal: "#37352f",
  slate: "#5d5b54",
  steel: "#787671",
  stone: "#a4a097",
  brandNavy: "#0a1530",
  brandNavyMid: "#1a2a52",
  primary: "#5645d4",
  primaryPressed: "#4534b3",
  brandPurple: "#7b3ff2",
  brandPink: "#ff64c8",
  brandOrange: "#dd5b00",
  brandTeal: "#2a9d99",
  brandGreen: "#1aae39",
  cardPeach: "#ffe8d4",
  cardRose: "#fde0ec",
  cardMint: "#d9f3e1",
  cardLavender: "#e6e0f5",
  cardSky: "#dcecfa",
  cardYellow: "#fef7d6",
  cardCream: "#f8f5e8",
  cardGray: "#f0eeec",
} as const;

export default function NotionDemo() {
  return (
    <main
      className="min-h-screen antialiased"
      style={{ background: c.canvas, color: c.charcoal }}
    >
      {/* Top nav */}
      <header className="sticky top-0 z-30" style={{ background: c.canvas }}>
        <div
          className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6"
          style={{ borderBottom: `1px solid ${c.hairlineSoft}` }}
        >
          <div className="flex items-center gap-7">
            <Link
              href="/design-demo"
              className="flex items-center gap-2 font-semibold tracking-tight"
              style={{ color: c.charcoal }}
            >
              <span
                className="grid h-7 w-7 place-items-center rounded-md text-[15px]"
                style={{
                  background: c.canvas,
                  color: c.charcoal,
                  border: `1px solid ${c.hairline}`,
                  fontFamily: "'Lyon', 'Iowan Old Style', Georgia, serif",
                  fontWeight: 700,
                }}
              >
                R
              </span>
              <span style={{ fontSize: 17, letterSpacing: "-0.2px" }}>
                Radspace
              </span>
            </Link>
            <nav
              className="hidden items-center gap-6 text-[14px] md:flex"
              style={{ color: c.slate }}
            >
              <a href="#features">Product</a>
              <a href="#metrics">Solutions</a>
              <a href="#pricing">Pricing</a>
              <a href="#docs">Templates</a>
              <a href="#docs">Resources</a>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-[14px]">
            <a className="hidden md:inline-block" href="#" style={{ color: c.charcoal }}>
              Log in
            </a>
            <a
              href="#"
              className="rounded-full px-4 py-2 font-medium text-white"
              style={{ background: c.primary }}
            >
              Get Radspace free
            </a>
          </div>
        </div>
      </header>

      {/* Hero band — deep navy with playful sticky-note dots */}
      <section
        className="relative overflow-hidden"
        style={{ background: c.brandNavy, color: "white" }}
      >
        {/* sticky-note dots */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <Dot top="14%" left="6%" color={c.brandPink} size={22} />
          <Dot top="22%" left="86%" color={c.brandOrange} size={28} />
          <Dot top="62%" left="11%" color={c.brandTeal} size={18} />
          <Dot top="74%" left="78%" color={c.brandPurple} size={26} />
          <Dot top="40%" left="93%" color={c.brandGreen} size={14} />
          <Dot top="46%" left="3%" color="#f5d75e" size={20} />
        </div>

        <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-20">
          <h1
            className="max-w-4xl text-balance"
            style={{
              fontSize: "clamp(44px, 7vw, 80px)",
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: "-2px",
            }}
          >
            The all-in-one workspace for your reading room.
          </h1>
          <p
            className="mt-6 max-w-2xl"
            style={{
              fontSize: 18,
              lineHeight: 1.55,
              color: "#cdd5e6",
            }}
          >
            Worklist, dictation, structured findings, conclusions, sign-off.
            One workspace your radiologists actually like opening.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#"
              className="rounded-full px-5 py-3 text-[15px] font-medium text-white"
              style={{ background: c.primary }}
            >
              Get Radspace free
            </a>
            <a
              href="#"
              className="rounded-full px-5 py-3 text-[15px] font-medium"
              style={{
                background: "rgba(255,255,255,0.08)",
                color: "white",
                border: "1px solid rgba(255,255,255,0.18)",
              }}
            >
              Request a demo →
            </a>
          </div>

          {/* Live workspace mockup directly inside hero band */}
          <div
            className="mt-14 overflow-hidden rounded-xl"
            style={{
              background: c.canvas,
              color: c.charcoal,
              boxShadow:
                "0 30px 60px -20px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.08)",
            }}
          >
            <div
              className="flex items-center gap-2 px-4 py-2.5 text-[12px]"
              style={{ borderBottom: `1px solid ${c.hairline}`, color: c.steel }}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: "#ff5f57" }}
              />
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: "#ffbd2e" }}
              />
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: "#28c840" }}
              />
              <span style={{ marginLeft: 10 }}>radspace.app</span>
            </div>
            <div className="grid grid-cols-12">
              <aside
                className="col-span-3 p-4 text-[13px]"
                style={{
                  background: c.surfaceSoft,
                  borderRight: `1px solid ${c.hairline}`,
                  color: c.slate,
                }}
              >
                <div className="px-2 py-1 text-[12px]" style={{ color: c.steel }}>
                  Workspace
                </div>
                {[
                  { i: "📋", label: "Worklist", count: 14, active: true },
                  { i: "🧠", label: "Brain MR" },
                  { i: "🫁", label: "Chest CT" },
                  { i: "🔎", label: "Prostate MRI" },
                  { i: "🩻", label: "Mammography" },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="mt-1 flex items-center justify-between rounded-md px-2 py-1.5"
                    style={{
                      background: row.active ? c.cardLavender : "transparent",
                      color: row.active ? c.charcoal : c.slate,
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <span>{row.i}</span>
                      {row.label}
                    </span>
                    {row.count !== undefined && (
                      <span
                        className="rounded-full px-2 text-[11px]"
                        style={{ background: c.canvas, color: c.steel }}
                      >
                        {row.count}
                      </span>
                    )}
                  </div>
                ))}
              </aside>

              <div className="col-span-9 p-6">
                <div
                  className="text-[12px] uppercase"
                  style={{ color: c.steel, letterSpacing: "0.08em" }}
                >
                  /worklist · prostate mri · MR-22418
                </div>
                <h3
                  className="mt-1"
                  style={{
                    fontSize: 28,
                    fontWeight: 600,
                    lineHeight: 1.25,
                    color: c.ink,
                    letterSpacing: "-0.4px",
                  }}
                >
                  67 / M · suspected peripheral zone lesion
                </h3>

                {/* Notion-style property pills */}
                <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
                  <Pill bg={c.cardPeach} label="Modality · MRI" />
                  <Pill bg={c.cardSky} label="Standard · PI-RADS v2.1" />
                  <Pill bg={c.cardMint} label="Status · live" />
                  <Pill bg={c.cardYellow} label="Volume · 38 mL" />
                </div>

                <div
                  className="mt-5 rounded-md p-5 text-[15px] leading-[1.7]"
                  style={{
                    background: c.surfaceSoft,
                    border: `1px solid ${c.hairline}`,
                    color: c.charcoal,
                  }}
                >
                  <div>
                    <span style={{ color: c.steel }}>1.</span> Peripheral zone
                    lesion at left mid gland (16 × 11 mm), markedly hypointense
                    on T2 / ADC.
                  </div>
                  <div className="mt-2">
                    <span style={{ color: c.steel }}>2.</span> PI-RADS v2.1{" "}
                    <span
                      className="rounded px-1.5 py-0.5 text-[12px] font-semibold"
                      style={{ background: c.primary, color: "white" }}
                    >
                      category 5
                    </span>
                    . Targeted biopsy recommended.
                  </div>
                  <div className="mt-2">
                    <span style={{ color: c.steel }}>3.</span> No definite
                    extracapsular extension or seminal vesicle invasion.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Logos band */}
      <section className="mx-auto max-w-6xl px-6 py-14">
        <div
          className="text-center text-[13px]"
          style={{ color: c.slate }}
        >
          Reading rooms running on Radspace today
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-12 gap-y-3 text-[20px]" style={{ color: c.steel, fontWeight: 600, letterSpacing: "-0.4px" }}>
          {["Asan", "Severance", "SNUH", "Samsung", "Korea Univ", "Inha"].map(
            (logo) => (
              <span key={logo}>{logo}</span>
            ),
          )}
        </div>
      </section>

      {/* Pastel feature cards — Notion's signature */}
      <section id="features" className="mx-auto max-w-6xl px-6 pb-20">
        <div className="max-w-3xl">
          <div
            className="text-[13px] font-semibold"
            style={{ color: c.brandPurple }}
          >
            Everything in one space
          </div>
          <h2
            className="mt-2"
            style={{
              fontSize: 48,
              fontWeight: 600,
              lineHeight: 1.15,
              letterSpacing: "-0.5px",
              color: c.ink,
            }}
          >
            Replace five tools with one workspace.
          </h2>
          <p
            className="mt-3 text-[18px]"
            style={{ color: c.slate, lineHeight: 1.55 }}
          >
            Worklist, dictation, findings, conclusions, audit. Each module is a
            building block — connect them into a workflow that fits your room.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
          {[
            {
              tint: c.cardPeach,
              emoji: "📋",
              title: "Worklist",
              body: "Drag, group, filter. The same database affordances your team already loves, tuned for radiology.",
            },
            {
              tint: c.cardLavender,
              emoji: "🧠",
              title: "AI conclusions",
              body: "Generate PI-RADS, BI-RADS, and Lung-RADS aligned conclusions in seconds — locally.",
            },
            {
              tint: c.cardMint,
              emoji: "🔍",
              title: "Findings as fields",
              body: "Lesion size, location, ADC, T2 — every finding is a typed property, queryable across cases.",
            },
            {
              tint: c.cardSky,
              emoji: "🔗",
              title: "Live linking",
              body: "Each conclusion sentence links back to its dictation span. Sign-off with full provenance.",
            },
            {
              tint: c.cardRose,
              emoji: "🤝",
              title: "Built for teams",
              body: "Comment on cases, request second reads, share templates. A workspace, not a single-player app.",
            },
            {
              tint: c.cardYellow,
              emoji: "🛡️",
              title: "Compliant by default",
              body: "HIPAA, GDPR, and SOC 2 ready. Self-host on-prem with the same UX as the cloud.",
            },
          ].map((f) => (
            <article
              key={f.title}
              className="rounded-xl p-6"
              style={{ background: f.tint, color: c.charcoal }}
            >
              <div className="text-[28px]">{f.emoji}</div>
              <h3
                className="mt-3"
                style={{
                  fontSize: 22,
                  fontWeight: 600,
                  lineHeight: 1.3,
                  letterSpacing: "-0.2px",
                  color: c.ink,
                }}
              >
                {f.title}
              </h3>
              <p
                className="mt-2 text-[15px]"
                style={{ color: c.charcoal, lineHeight: 1.55 }}
              >
                {f.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Metrics on cream background */}
      <section
        id="metrics"
        className="mx-auto max-w-6xl px-6 pb-20"
      >
        <div
          className="rounded-2xl p-10 md:p-14"
          style={{ background: c.cardCream }}
        >
          <h3
            style={{
              fontSize: 36,
              fontWeight: 600,
              lineHeight: 1.2,
              letterSpacing: "-0.5px",
              color: c.ink,
            }}
          >
            Numbers we&apos;re proud of.
          </h3>
          <div className="mt-8 grid grid-cols-2 gap-y-8 md:grid-cols-4">
            {[
              ["38s", "median dictation → signed"],
              ["0.91s", "p50 time-to-first-token"],
              ["96.4%", "PI-RADS agreement"],
              ["12K+", "studies last quarter"],
            ].map(([n, t]) => (
              <div key={t}>
                <div
                  style={{
                    fontSize: 48,
                    fontWeight: 600,
                    lineHeight: 1.1,
                    letterSpacing: "-0.5px",
                    color: c.ink,
                  }}
                >
                  {n}
                </div>
                <div className="mt-2 text-[14px]" style={{ color: c.slate }}>
                  {t}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA banner */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div
          className="overflow-hidden rounded-2xl p-10 md:p-14"
          style={{
            background: c.brandNavy,
            color: "white",
          }}
        >
          <h3
            style={{
              fontSize: 40,
              fontWeight: 600,
              lineHeight: 1.15,
              letterSpacing: "-0.5px",
              maxWidth: "32ch",
            }}
          >
            Bring your reading room into one workspace.
          </h3>
          <p
            className="mt-3 max-w-xl text-[16px]"
            style={{ color: "#cdd5e6", lineHeight: 1.55 }}
          >
            Start free for individual radiologists. Scale to enterprise when
            your hospital network is ready.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a
              href="#"
              className="rounded-full px-5 py-3 text-[15px] font-medium text-white"
              style={{ background: c.primary }}
            >
              Get Radspace free
            </a>
            <a
              href="#"
              className="rounded-full px-5 py-3 text-[15px] font-medium"
              style={{
                background: "transparent",
                color: "white",
                border: "1px solid rgba(255,255,255,0.25)",
              }}
            >
              Request a demo
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="mx-auto max-w-6xl px-6 py-10 text-[13px]"
        style={{
          color: c.slate,
          borderTop: `1px solid ${c.hairlineSoft}`,
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>© 2026 Radspace · Notion-inspired DESIGN.md demo</div>
          <div className="flex gap-5">
            <Link href="/design-demo" style={{ color: c.charcoal }}>
              ← All design demos
            </Link>
            <a href="#">Privacy</a>
            <a href="#">DPA</a>
            <a href="#">Status</a>
          </div>
        </div>
      </footer>
    </main>
  );
}

function Dot({
  top,
  left,
  color,
  size,
}: {
  top: string;
  left: string;
  color: string;
  size: number;
}) {
  return (
    <span
      aria-hidden
      className="absolute rounded-full"
      style={{
        top,
        left,
        width: size,
        height: size,
        background: color,
        boxShadow: "0 6px 14px -6px rgba(0,0,0,0.35)",
      }}
    />
  );
}

function Pill({ bg, label }: { bg: string; label: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1"
      style={{ background: bg, color: "#37352f", fontWeight: 500 }}
    >
      {label}
    </span>
  );
}
