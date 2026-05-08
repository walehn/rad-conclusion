import Link from "next/link";

// Tokens distilled from awesome-design-md/linear/DESIGN.md
const c = {
  canvas: "#010102",
  surface1: "#0f1011",
  surface2: "#141516",
  hairline: "#23252a",
  hairlineStrong: "#34343a",
  ink: "#f7f8f8",
  inkMuted: "#d0d6e0",
  inkSubtle: "#8a8f98",
  inkTertiary: "#62666d",
  primary: "#5e6ad2",
  primaryHover: "#828fff",
  success: "#27a644",
} as const;

export default function LinearDemo() {
  return (
    <main
      className="min-h-screen antialiased"
      style={{ background: c.canvas, color: c.ink, letterSpacing: "-0.05px" }}
    >
      {/* Top nav */}
      <header
        className="sticky top-0 z-30 backdrop-blur"
        style={{
          background: `${c.canvas}cc`,
          borderBottom: `1px solid ${c.hairline}`,
        }}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6 text-sm">
          <div className="flex items-center gap-7">
            <Link
              href="/design-demo"
              className="flex items-center gap-2 font-semibold tracking-tight"
              style={{ color: c.ink }}
            >
              <span
                className="grid h-6 w-6 place-items-center rounded-md"
                style={{ background: c.primary }}
                aria-hidden
              >
                <span className="block h-2.5 w-2.5 rotate-45 rounded-[2px] bg-white" />
              </span>
              Radline
            </Link>
            <nav className="hidden items-center gap-5 md:flex" style={{ color: c.inkSubtle }}>
              <a className="hover:text-white" href="#features">Features</a>
              <a className="hover:text-white" href="#metrics">Method</a>
              <a className="hover:text-white" href="#changelog">Changelog</a>
              <a className="hover:text-white" href="#pricing">Pricing</a>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <a
              className="hidden rounded-md px-3 py-1.5 text-sm md:inline-block"
              href="#"
              style={{ color: c.ink }}
            >
              Log in
            </a>
            <a
              className="rounded-md px-3 py-1.5 text-sm font-medium"
              href="#"
              style={{ background: c.primary, color: "white" }}
            >
              Open app
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-24 pt-24">
        <div
          className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs"
          style={{
            background: c.surface2,
            color: c.inkMuted,
            border: `1px solid ${c.hairline}`,
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: c.success }}
          />
          v1.4 · structured reports for prostate MRI
        </div>

        <h1
          className="mt-6 max-w-3xl text-balance"
          style={{
            fontSize: "clamp(40px, 7vw, 80px)",
            fontWeight: 600,
            lineHeight: 1.05,
            letterSpacing: "-3px",
            color: c.ink,
          }}
        >
          Radiology conclusions,{" "}
          <span style={{ color: c.inkSubtle }}>
            engineered for the reading room.
          </span>
        </h1>

        <p
          className="mt-5 max-w-2xl"
          style={{
            color: c.inkMuted,
            fontSize: 18,
            lineHeight: 1.5,
            letterSpacing: "-0.1px",
          }}
        >
          Radline turns dictated findings into PI-RADS v2.1, BI-RADS, and Lung-RADS
          aligned conclusions in seconds. Built for radiologists who think in
          standards, not in templates.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a
            href="#"
            className="rounded-md px-3.5 py-2 text-sm font-medium"
            style={{ background: c.primary, color: "white" }}
          >
            Start reading →
          </a>
          <a
            href="#"
            className="rounded-md px-3.5 py-2 text-sm font-medium"
            style={{
              background: c.surface1,
              color: c.ink,
              border: `1px solid ${c.hairline}`,
            }}
          >
            Watch a 90s walkthrough
          </a>
          <span className="ml-1 text-xs" style={{ color: c.inkTertiary }}>
            Free for academic use · SOC 2 in progress
          </span>
        </div>

        {/* Product screenshot card */}
        <div
          className="mt-16 overflow-hidden rounded-2xl"
          style={{
            background: c.surface1,
            border: `1px solid ${c.hairline}`,
          }}
        >
          <div
            className="flex items-center gap-2 border-b px-4 py-2.5"
            style={{ borderColor: c.hairline }}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#3a3d44" }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#3a3d44" }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#3a3d44" }} />
            <span
              className="ml-3 text-xs"
              style={{ color: c.inkSubtle, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
            >
              radline.app/case/MR-22418
            </span>
          </div>
          <div className="grid grid-cols-12 gap-0">
            <aside
              className="col-span-3 border-r p-4 text-xs"
              style={{
                borderColor: c.hairline,
                background: c.canvas,
                color: c.inkSubtle,
              }}
            >
              <div className="mb-3 text-[11px] font-medium uppercase tracking-wider" style={{ color: c.inkTertiary }}>
                Worklist
              </div>
              {[
                { id: "MR-22418", label: "Prostate MRI · 67 / M", active: true },
                { id: "MR-22417", label: "Brain MR · 41 / F" },
                { id: "CT-13390", label: "Chest CT · 58 / M" },
                { id: "MG-08711", label: "Mammography · 49 / F" },
              ].map((row) => (
                <div
                  key={row.id}
                  className="mb-1 rounded-md px-2 py-1.5"
                  style={{
                    background: row.active ? c.surface2 : "transparent",
                    color: row.active ? c.ink : c.inkSubtle,
                    border: row.active ? `1px solid ${c.hairlineStrong}` : "1px solid transparent",
                  }}
                >
                  <div className="text-[11px]" style={{ color: c.inkTertiary }}>
                    {row.id}
                  </div>
                  <div>{row.label}</div>
                </div>
              ))}
            </aside>
            <div className="col-span-9 p-6">
              <div className="text-[11px] font-medium uppercase tracking-wider" style={{ color: c.inkTertiary }}>
                Generated conclusion
              </div>
              <div
                className="mt-3 rounded-lg p-5 text-[15px] leading-relaxed"
                style={{
                  background: c.surface2,
                  border: `1px solid ${c.hairline}`,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  color: c.inkMuted,
                }}
              >
                <div>
                  <span style={{ color: c.primary }}>1.</span> Peripheral zone lesion at
                  left mid gland (16 × 11 mm), markedly hypointense on T2 and ADC,
                  early enhancement.
                </div>
                <div className="mt-2">
                  <span style={{ color: c.primary }}>2.</span> PI-RADS v2.1 category{" "}
                  <span
                    className="rounded px-1.5 py-0.5"
                    style={{ background: c.primary, color: "white" }}
                  >
                    5
                  </span>
                  . Targeted biopsy is recommended.
                </div>
                <div className="mt-2">
                  <span style={{ color: c.primary }}>3.</span> No definite extracapsular
                  extension or seminal vesicle invasion. Prostate volume 38 mL.
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-[11px]" style={{ color: c.inkSubtle }}>
                {["PI-RADS v2.1", "Standard phrasing", "Bilingual", "1.2s ⌁ TTFT"].map((t) => (
                  <span
                    key={t}
                    className="rounded px-2 py-1"
                    style={{ background: c.surface1, border: `1px solid ${c.hairline}` }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Customer logos */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div
          className="text-[11px] font-medium uppercase tracking-[0.18em]"
          style={{ color: c.inkTertiary }}
        >
          Trusted by reading rooms across
        </div>
        <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-md sm:grid-cols-5"
          style={{ background: c.hairline }}>
          {["Asan", "Severance", "SNUH", "Samsung", "Inha"].map((logo) => (
            <div
              key={logo}
              className="flex h-16 items-center justify-center text-sm"
              style={{ background: c.canvas, color: c.inkSubtle, letterSpacing: 0 }}
            >
              {logo}
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 pb-24">
        <h2
          style={{
            fontSize: 40,
            fontWeight: 600,
            lineHeight: 1.15,
            letterSpacing: "-1px",
            color: c.ink,
          }}
        >
          Built for the modality, not the tool.
        </h2>
        <p className="mt-3 max-w-2xl text-base" style={{ color: c.inkMuted }}>
          Each feature is a deliberate stripe of work — no decoration, no
          dashboards-for-the-sake-of-dashboards.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            {
              tag: "01 · Reasoning",
              title: "Modality-aware prompts",
              body: "PI-RADS v2.1, BI-RADS 5e, Lung-RADS, ACR TI-RADS — the model picks the right rubric from your dictation, not from a dropdown.",
            },
            {
              tag: "02 · Latency",
              title: "Local model, sub-second TTFT",
              body: "Runs on your reading-room workstation. Average 0.9s time-to-first-token measured on 4090s.",
            },
            {
              tag: "03 · Audit",
              title: "Every token is trackable",
              body: "Findings, structured fields, and the conclusion are linked back to the original dictation span. Diff before sign-off.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-xl p-6"
              style={{
                background: c.surface1,
                border: `1px solid ${c.hairline}`,
              }}
            >
              <div
                className="text-[11px] font-medium uppercase tracking-[0.18em]"
                style={{ color: c.inkTertiary }}
              >
                {f.tag}
              </div>
              <div
                className="mt-3 text-[22px]"
                style={{ fontWeight: 500, letterSpacing: "-0.4px", color: c.ink }}
              >
                {f.title}
              </div>
              <p className="mt-2 text-[15px] leading-relaxed" style={{ color: c.inkMuted }}>
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Metrics */}
      <section id="metrics" className="mx-auto max-w-6xl px-6 pb-24">
        <div
          className="grid grid-cols-2 gap-px overflow-hidden rounded-xl md:grid-cols-4"
          style={{ background: c.hairline }}
        >
          {[
            ["38s", "median dictation → signed conclusion"],
            ["0.91s", "p50 time-to-first-token (RTX 4090)"],
            ["96.4%", "PI-RADS category agreement vs. ground truth"],
            ["12K+", "studies through Radline last quarter"],
          ].map(([n, t]) => (
            <div key={t} className="p-6" style={{ background: c.canvas }}>
              <div
                style={{
                  fontSize: 40,
                  fontWeight: 600,
                  letterSpacing: "-1px",
                  color: c.ink,
                }}
              >
                {n}
              </div>
              <div className="mt-1 text-sm" style={{ color: c.inkSubtle }}>
                {t}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA banner */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div
          className="rounded-xl p-12"
          style={{
            background: c.surface1,
            border: `1px solid ${c.hairline}`,
          }}
        >
          <div
            style={{
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: "-0.6px",
              color: c.ink,
            }}
          >
            Stop typing the same conclusion. Start signing.
          </div>
          <p className="mt-3 max-w-xl text-base" style={{ color: c.inkMuted }}>
            Drop Radline into your worklist viewer. We&apos;ll handle the
            standard phrasing, the structured fields, and the audit trail.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="#"
              className="rounded-md px-3.5 py-2 text-sm font-medium"
              style={{ background: c.primary, color: "white" }}
            >
              Start reading →
            </a>
            <a
              href="#"
              className="rounded-md px-3.5 py-2 text-sm font-medium"
              style={{
                background: c.canvas,
                color: c.ink,
                border: `1px solid ${c.hairline}`,
              }}
            >
              Talk to the team
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="mx-auto max-w-6xl px-6 py-10 text-xs"
        style={{
          color: c.inkSubtle,
          borderTop: `1px solid ${c.hairline}`,
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>© 2026 Radline · Linear-inspired DESIGN.md demo</div>
          <div className="flex gap-5">
            <Link href="/design-demo" style={{ color: c.inkMuted }}>
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
