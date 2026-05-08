import Link from "next/link";

// Tokens distilled from awesome-design-md/vercel/DESIGN.md (Geist)
const c = {
  bg: "#ffffff",
  ink: "#171717",
  ink600: "#4d4d4d",
  ink500: "#666666",
  ink400: "#808080",
  border: "#ebebeb",
  surface: "#fafafa",
  link: "#0072f5",
  ship: "#ff5b4f",
  preview: "#de1d8d",
  develop: "#0a72ef",
  badgeBlueBg: "#ebf5ff",
  badgeBlueText: "#0068d6",
} as const;

// Vercel's signature shadow-as-border + multi-layer card stack
const ringBorder = `0 0 0 1px ${c.border}`;
const cardShadow = `rgba(0,0,0,0.08) 0 0 0 1px, rgba(0,0,0,0.04) 0 2px 2px, rgba(0,0,0,0.04) 0 8px 8px -8px`;

const monoStack =
  "ui-monospace, SFMono-Regular, 'Geist Mono', Menlo, Monaco, monospace";

export default function VercelDemo() {
  return (
    <main
      className="min-h-screen antialiased"
      style={{
        background: c.bg,
        color: c.ink,
        fontFeatureSettings: '"liga" 1',
        // Geist falls back gracefully; the spec ships negative tracking.
      }}
    >
      {/* Top nav: shadow-bordered chip */}
      <header className="sticky top-0 z-30" style={{ background: c.bg }}>
        <div
          className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6"
          style={{ boxShadow: `inset 0 -1px 0 ${c.border}` }}
        >
          <div className="flex items-center gap-7">
            <Link
              href="/design-demo"
              className="flex items-center gap-2 text-[15px] font-semibold tracking-tight"
              style={{ color: c.ink, letterSpacing: "-0.32px" }}
            >
              <span
                className="grid h-6 w-6 place-items-center rounded-[6px]"
                style={{ background: c.ink, color: "#fff" }}
                aria-hidden
              >
                <svg width="12" height="10" viewBox="0 0 24 20" fill="none">
                  <path d="M12 0L24 20H0L12 0Z" fill="currentColor" />
                </svg>
              </span>
              radstack
            </Link>
            <nav
              className="hidden items-center gap-5 text-[14px] md:flex"
              style={{ color: c.ink600 }}
            >
              <a href="#features">Products</a>
              <a href="#metrics">Methodology</a>
              <a href="#changelog">Changelog</a>
              <a href="#pricing">Pricing</a>
              <a href="#docs">Docs</a>
            </nav>
          </div>
          <div className="flex items-center gap-2 text-[14px]">
            <a className="hidden md:inline-block" href="#" style={{ color: c.ink }}>
              Log in
            </a>
            <a
              href="#"
              className="rounded-[6px] px-3 py-1.5 font-medium"
              style={{
                background: c.bg,
                color: c.ink,
                boxShadow: ringBorder,
              }}
            >
              Contact
            </a>
            <a
              href="#"
              className="rounded-[6px] px-3 py-1.5 font-medium"
              style={{ background: c.ink, color: "#fff" }}
            >
              Start Deploying →
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-24 pt-24 text-center">
        <a
          href="#"
          className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[13px]"
          style={{
            background: c.surface,
            color: c.ink,
            boxShadow: ringBorder,
          }}
        >
          <span
            className="rounded px-1.5 py-0.5 text-[11px] font-medium"
            style={{ background: c.badgeBlueBg, color: c.badgeBlueText }}
          >
            NEW
          </span>
          <span style={{ color: c.ink600 }}>
            radstack on-prem inference is generally available
          </span>
          <span style={{ color: c.ink400 }}>→</span>
        </a>

        <h1
          className="mx-auto mt-7 max-w-4xl text-balance"
          style={{
            fontSize: "clamp(40px, 7.5vw, 88px)",
            fontWeight: 600,
            lineHeight: 1.0,
            letterSpacing: "-2.88px",
            color: c.ink,
          }}
        >
          Ship radiology
          <br />
          <span style={{ color: c.ink400 }}>without shipping risk.</span>
        </h1>

        <p
          className="mx-auto mt-6 max-w-2xl"
          style={{
            fontSize: 20,
            lineHeight: 1.5,
            color: c.ink600,
          }}
        >
          radstack is the platform for radiology teams. Generate, preview, and
          sign structured conclusions — with the same workflow your engineers
          already trust.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href="#"
            className="rounded-[6px] px-4 py-2.5 text-[14px] font-medium"
            style={{ background: c.ink, color: "#fff" }}
          >
            Start Deploying
          </a>
          <a
            href="#"
            className="rounded-[6px] px-4 py-2.5 text-[14px] font-medium"
            style={{ background: c.bg, color: c.ink, boxShadow: ringBorder }}
          >
            Get a Demo
          </a>
        </div>

        {/* Workflow chips: ship/preview/develop */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4 text-[12px] uppercase tracking-[0.04em]" style={{ fontFamily: monoStack, color: c.ink400 }}>
          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.develop }} />
            <span style={{ color: c.develop }}>develop</span>
          </span>
          <span style={{ color: c.ink400 }}>→</span>
          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.preview }} />
            <span style={{ color: c.preview }}>preview</span>
          </span>
          <span style={{ color: c.ink400 }}>→</span>
          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.ship }} />
            <span style={{ color: c.ship }}>ship</span>
          </span>
        </div>

        {/* Screenshot card with multi-layer shadow */}
        <div
          className="mx-auto mt-14 overflow-hidden rounded-xl text-left"
          style={{ background: c.bg, boxShadow: cardShadow }}
        >
          <div
            className="flex items-center gap-2 px-4 py-2.5"
            style={{ boxShadow: `inset 0 -1px 0 ${c.border}` }}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#e0e0e0" }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#e0e0e0" }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#e0e0e0" }} />
            <span
              className="ml-3 text-[12px]"
              style={{ color: c.ink500, fontFamily: monoStack }}
            >
              radstack.app/cases/MR-22418
            </span>
          </div>
          <div className="grid grid-cols-12">
            <aside
              className="col-span-4 p-5 text-[13px]"
              style={{
                background: c.surface,
                boxShadow: `inset -1px 0 0 ${c.border}`,
                color: c.ink600,
              }}
            >
              <div
                className="mb-3 text-[11px] font-medium uppercase"
                style={{ color: c.ink400, fontFamily: monoStack, letterSpacing: "0.04em" }}
              >
                workflow
              </div>
              {[
                { label: "Dictation captured", state: "done" },
                { label: "Findings parsed", state: "done" },
                { label: "Structured fields", state: "active" },
                { label: "Conclusion", state: "queued" },
                { label: "Sign-off", state: "queued" },
              ].map((s) => (
                <div key={s.label} className="mb-2 flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      background:
                        s.state === "done"
                          ? c.ink
                          : s.state === "active"
                          ? c.develop
                          : "transparent",
                      boxShadow: s.state === "queued" ? ringBorder : "none",
                    }}
                  />
                  <span style={{ color: s.state === "queued" ? c.ink400 : c.ink }}>
                    {s.label}
                  </span>
                </div>
              ))}
            </aside>
            <div className="col-span-8 p-6">
              <div
                className="text-[11px] font-medium uppercase"
                style={{ color: c.ink400, fontFamily: monoStack, letterSpacing: "0.04em" }}
              >
                conclusion · ready to ship
              </div>
              <div
                className="mt-3 rounded-md p-5 text-[14px] leading-[1.7]"
                style={{
                  background: c.surface,
                  boxShadow: ringBorder,
                  fontFamily: monoStack,
                  color: c.ink,
                }}
              >
                <span style={{ color: c.ink400 }}>1.</span>{" "}
                Peripheral zone lesion at left mid gland (16 × 11 mm), markedly
                hypointense on T2/ADC.
                <br />
                <span style={{ color: c.ink400 }}>2.</span> PI-RADS v2.1{" "}
                <span
                  className="rounded px-1.5 py-0.5 text-[12px] font-medium"
                  style={{
                    background: c.badgeBlueBg,
                    color: c.badgeBlueText,
                    fontFamily: "inherit",
                  }}
                >
                  category 5
                </span>
                .
                <br />
                <span style={{ color: c.ink400 }}>3.</span> Targeted biopsy
                recommended. No definite ECE/SVI.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Logos */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div
          className="text-center text-[12px] uppercase"
          style={{ fontFamily: monoStack, color: c.ink400, letterSpacing: "0.04em" }}
        >
          Used by reading rooms shipping in production
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-[18px]" style={{ color: c.ink400 }}>
          {["ASAN", "SEVERANCE", "SNUH", "SAMSUNG", "KOREA UNIV", "INHA"].map((logo) => (
            <span
              key={logo}
              style={{ letterSpacing: "-0.32px", fontWeight: 500 }}
            >
              {logo}
            </span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 pb-24">
        <div className="text-center">
          <h2
            style={{
              fontSize: 40,
              fontWeight: 600,
              lineHeight: 1.2,
              letterSpacing: "-2.4px",
              color: c.ink,
            }}
          >
            Three primitives. One conclusion.
          </h2>
          <p
            className="mx-auto mt-3 max-w-xl"
            style={{ fontSize: 18, color: c.ink600 }}
          >
            Every feature is a thin layer over what radiologists already do.
            Nothing more.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
          {[
            {
              tag: "INFER",
              accent: c.develop,
              title: "Local-first inference",
              body: "Runs on your reading-room workstation. Median TTFT 0.91s on a single 4090.",
            },
            {
              tag: "STRUCTURE",
              accent: c.preview,
              title: "Standards baked in",
              body: "PI-RADS v2.1, BI-RADS 5e, Lung-RADS 2022 — every category is a typed field, not free text.",
            },
            {
              tag: "AUDIT",
              accent: c.ship,
              title: "Diff before sign-off",
              body: "Each token in the conclusion links back to a span in your dictation. Review, edit, sign.",
            },
          ].map((f) => (
            <article
              key={f.title}
              className="rounded-xl p-6"
              style={{ background: c.bg, boxShadow: cardShadow }}
            >
              <div
                className="text-[11px] font-medium uppercase"
                style={{
                  fontFamily: monoStack,
                  color: f.accent,
                  letterSpacing: "0.04em",
                }}
              >
                {f.tag}
              </div>
              <h3
                className="mt-3"
                style={{
                  fontSize: 24,
                  fontWeight: 600,
                  lineHeight: 1.33,
                  letterSpacing: "-0.96px",
                  color: c.ink,
                }}
              >
                {f.title}
              </h3>
              <p
                className="mt-2"
                style={{ fontSize: 16, lineHeight: 1.56, color: c.ink600 }}
              >
                {f.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Metrics */}
      <section
        id="metrics"
        className="mx-auto max-w-6xl px-6 pb-24"
      >
        <div
          className="rounded-xl p-2"
          style={{ background: c.bg, boxShadow: cardShadow }}
        >
          <div className="grid grid-cols-2 md:grid-cols-4">
            {[
              ["38s", "median dictation → signed"],
              ["0.91s", "p50 time-to-first-token"],
              ["96.4%", "PI-RADS agreement vs. truth"],
              ["12K+", "studies last quarter"],
            ].map(([n, t], i) => (
              <div
                key={t}
                className="p-6"
                style={{
                  boxShadow:
                    i < 3
                      ? `inset -1px 0 0 ${c.border}`
                      : "none",
                }}
              >
                <div
                  style={{
                    fontSize: 40,
                    fontWeight: 600,
                    lineHeight: 1.0,
                    letterSpacing: "-2.4px",
                    color: c.ink,
                  }}
                >
                  {n}
                </div>
                <div className="mt-2 text-[14px]" style={{ color: c.ink600 }}>
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
          className="rounded-xl p-12 text-center"
          style={{ background: c.surface, boxShadow: ringBorder }}
        >
          <h3
            style={{
              fontSize: 32,
              fontWeight: 600,
              lineHeight: 1.25,
              letterSpacing: "-1.28px",
              color: c.ink,
            }}
          >
            Build your reading room on a workflow you can ship.
          </h3>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#"
              className="rounded-[6px] px-4 py-2.5 text-[14px] font-medium"
              style={{ background: c.ink, color: "#fff" }}
            >
              Start Deploying
            </a>
            <a
              href="#"
              className="rounded-[6px] px-4 py-2.5 text-[14px] font-medium"
              style={{ background: c.bg, color: c.ink, boxShadow: ringBorder }}
            >
              Get a Demo
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="mx-auto max-w-6xl px-6 py-10 text-[13px]"
        style={{
          color: c.ink500,
          boxShadow: `inset 0 1px 0 ${c.border}`,
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>© 2026 radstack · Vercel/Geist-inspired DESIGN.md demo</div>
          <div className="flex gap-5">
            <Link href="/design-demo" style={{ color: c.ink }}>
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
