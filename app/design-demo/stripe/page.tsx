import Link from "next/link";

// Tokens distilled from awesome-design-md/stripe/DESIGN.md
const c = {
  bg: "#ffffff",
  heading: "#061b31",
  brandDark: "#1c1e54",
  primary: "#533afd",
  primaryHover: "#4434d4",
  purpleLight: "#b9b9f9",
  purpleSoft: "#d6d9fc",
  ruby: "#ea2261",
  magenta: "#f96bee",
  magentaLight: "#ffd7ef",
  label: "#273951",
  body: "#64748d",
  border: "#e5edf5",
  successText: "#108c3d",
  successBg: "#e8f8ee",
} as const;

// Stripe's signature blue-tinted multi-layer shadow
const cardShadow =
  "rgba(50,50,93,0.10) 0 7px 14px 0, rgba(0,0,0,0.07) 0 3px 6px 0";
const cardShadowHover =
  "rgba(50,50,93,0.20) 0 13px 27px -5px, rgba(0,0,0,0.30) 0 8px 16px -8px";
const monoStack =
  "'SourceCodePro', ui-monospace, SFMono-Regular, Menlo, monospace";

export default function StripeDemo() {
  return (
    <main
      className="min-h-screen antialiased"
      style={{
        background: c.bg,
        color: c.heading,
        fontFeatureSettings: '"ss01" 1',
      }}
    >
      {/* Soft gradient atmosphere band */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[640px]"
        style={{
          background:
            "radial-gradient(80% 100% at 50% 0%, #efe9ff 0%, #fbf5ff 35%, #ffffff 75%)",
        }}
      />

      {/* Top nav */}
      <header className="relative z-30">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-8">
            <Link
              href="/design-demo"
              className="flex items-center gap-2 font-semibold tracking-tight"
              style={{ color: c.heading, letterSpacing: "-0.32px" }}
            >
              <span
                className="grid h-7 w-7 place-items-center rounded-md"
                style={{
                  background: c.primary,
                  boxShadow: "rgba(83,58,253,0.3) 0 6px 18px -6px",
                }}
              >
                <span
                  style={{
                    color: "white",
                    fontFamily: monoStack,
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  R
                </span>
              </span>
              <span style={{ fontSize: 17 }}>Radia</span>
            </Link>
            <nav
              className="hidden items-center gap-7 text-[14px] md:flex"
              style={{ color: c.label, fontWeight: 400 }}
            >
              <a href="#features">Products</a>
              <a href="#metrics">Methodology</a>
              <a href="#pricing">Pricing</a>
              <a href="#docs">Docs</a>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-[14px]">
            <a className="hidden md:inline-block" href="#" style={{ color: c.heading }}>
              Sign in
            </a>
            <a
              href="#"
              className="rounded px-3 py-2 font-medium text-white"
              style={{
                background: c.primary,
                fontFeatureSettings: '"ss01" 1',
              }}
            >
              Contact sales →
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-6 pb-20 pt-20">
        <div
          className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[13px]"
          style={{
            background: "white",
            color: c.heading,
            boxShadow: cardShadow,
            border: `1px solid ${c.border}`,
          }}
        >
          <span
            className="rounded px-1.5 py-0.5 text-[11px] font-medium"
            style={{ background: c.successBg, color: c.successText }}
          >
            NEW
          </span>
          <span style={{ color: c.body }}>
            Radia for Enterprise — HIPAA & GDPR ready
          </span>
        </div>

        <h1
          className="mt-7 max-w-4xl text-balance"
          style={{
            fontSize: "clamp(44px, 7vw, 80px)",
            fontWeight: 300,
            lineHeight: 1.03,
            letterSpacing: "-1.4px",
            color: c.heading,
          }}
        >
          The radiology platform
          <br />
          <span
            style={{
              background:
                "linear-gradient(135deg, #533afd 0%, #f96bee 60%, #ea2261 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            built for confidence at scale.
          </span>
        </h1>

        <p
          className="mt-6 max-w-2xl"
          style={{
            fontSize: 18,
            lineHeight: 1.5,
            color: c.body,
            fontWeight: 300,
          }}
        >
          Millions of conclusions are signed every year on Radia. From a single
          radiologist&apos;s reading room to the largest enterprise hospital
          network — Radia is the standardised infrastructure for radiology.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a
            href="#"
            className="rounded px-5 py-3 text-[15px] font-normal text-white"
            style={{
              background: c.primary,
              boxShadow: "rgba(50,50,93,0.25) 0 6px 16px -6px",
            }}
          >
            Start now →
          </a>
          <a
            href="#"
            className="rounded px-5 py-3 text-[15px] font-normal"
            style={{
              background: "transparent",
              color: c.primary,
            }}
          >
            Contact sales →
          </a>
        </div>

        {/* Product card */}
        <div
          className="mt-16 overflow-hidden rounded-lg"
          style={{
            background: "white",
            boxShadow: cardShadowHover,
            border: `1px solid ${c.border}`,
          }}
        >
          <div
            className="flex items-center justify-between px-5 py-3 text-[13px]"
            style={{
              borderBottom: `1px solid ${c.border}`,
              color: c.body,
              fontFamily: monoStack,
            }}
          >
            <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#e5edf5" }} />
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#e5edf5" }} />
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#e5edf5" }} />
              <span style={{ marginLeft: 8 }}>radia.app/cases/MR-22418</span>
            </div>
            <span
              className="rounded px-2 py-0.5 text-[11px]"
              style={{
                background: c.successBg,
                color: c.successText,
                fontFamily: "inherit",
              }}
            >
              ● live
            </span>
          </div>

          <div className="grid grid-cols-12">
            <aside
              className="col-span-4 p-6"
              style={{ borderRight: `1px solid ${c.border}` }}
            >
              <div
                className="text-[11px] uppercase"
                style={{
                  color: c.body,
                  fontFamily: monoStack,
                  letterSpacing: "0.04em",
                }}
              >
                cases · today
              </div>
              <ul className="mt-4 space-y-3 text-[14px]" style={{ color: c.label }}>
                {[
                  { id: "MR-22418", body: "Prostate MRI · 67 / M", state: "live" },
                  { id: "MR-22417", body: "Brain MR · 41 / F" },
                  { id: "CT-13390", body: "Chest CT · 58 / M" },
                  { id: "MG-08711", body: "Mammography · 49 / F" },
                ].map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center justify-between"
                  >
                    <div>
                      <div
                        className="text-[12px]"
                        style={{ color: c.body, fontFamily: monoStack }}
                      >
                        {row.id}
                      </div>
                      <div>{row.body}</div>
                    </div>
                    {row.state === "live" && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px]"
                        style={{
                          background: c.purpleSoft,
                          color: c.primary,
                          fontWeight: 500,
                        }}
                      >
                        active
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </aside>

            <div className="col-span-8 p-7">
              <div
                className="text-[11px] uppercase"
                style={{
                  color: c.body,
                  fontFamily: monoStack,
                  letterSpacing: "0.04em",
                }}
              >
                conclusion · pi-rads v2.1
              </div>

              <div
                className="mt-4 rounded-md p-5 text-[14px] leading-[1.65]"
                style={{
                  background: "#f7f9fc",
                  border: `1px solid ${c.border}`,
                  color: c.heading,
                  fontFeatureSettings: '"ss01" 1',
                }}
              >
                <span style={{ color: c.body }}>1.</span> Peripheral zone lesion
                at left mid gland (16 × 11 mm), markedly hypointense on T2 / ADC.
                <br />
                <span style={{ color: c.body }}>2.</span> PI-RADS v2.1{" "}
                <span
                  className="rounded px-1.5 py-0.5 font-medium"
                  style={{
                    background: c.primary,
                    color: "white",
                    fontSize: 13,
                  }}
                >
                  category 5
                </span>
                . Targeted biopsy recommended.
                <br />
                <span style={{ color: c.body }}>3.</span> No definite ECE / SVI.
                Volume 38 mL.
              </div>

              {/* tabular numerals strip */}
              <div className="mt-5 grid grid-cols-3 gap-3 text-[12px]">
                {[
                  ["TTFT", "0.91s"],
                  ["PSA density", "0.21"],
                  ["agreement", "96.4%"],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="rounded-md px-3 py-2"
                    style={{
                      border: `1px solid ${c.border}`,
                      color: c.label,
                      fontFamily: monoStack,
                      fontFeatureSettings: '"tnum" 1',
                    }}
                  >
                    <div style={{ color: c.body }}>{k}</div>
                    <div style={{ fontSize: 16, color: c.heading, marginTop: 2 }}>
                      {v}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Logos */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div
          className="text-center text-[13px]"
          style={{ color: c.body, fontWeight: 300 }}
        >
          Trusted at every scale, from solo radiologists to enterprise hospitals.
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-[20px]" style={{ color: c.label, fontWeight: 300, letterSpacing: "-0.5px" }}>
          {["Asan", "Severance", "SNUH", "Samsung", "Korea Univ", "Inha"].map((logo) => (
            <span key={logo}>{logo}</span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 pb-24">
        <div className="max-w-3xl">
          <div
            className="text-[12px] uppercase"
            style={{
              color: c.primary,
              fontFamily: monoStack,
              letterSpacing: "0.06em",
            }}
          >
            Why Radia
          </div>
          <h2
            className="mt-3"
            style={{
              fontSize: 48,
              fontWeight: 300,
              lineHeight: 1.1,
              letterSpacing: "-0.96px",
              color: c.heading,
            }}
          >
            A modern radiology stack — engineered, not assembled.
          </h2>
          <p
            className="mt-4"
            style={{ fontSize: 18, color: c.body, fontWeight: 300, lineHeight: 1.5 }}
          >
            Radia is the only platform that combines local inference, structured
            standards, and a full audit trail in a single product. Every layer
            is built in-house.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {[
            {
              tag: "Inference",
              accent: c.primary,
              title: "Sub-second TTFT, on your hardware.",
              body: "Runs locally on a single 4090 or shared across a workstation cluster. Median 0.91s p50.",
            },
            {
              tag: "Standards",
              accent: c.magenta,
              title: "Standards as types, not free text.",
              body: "PI-RADS v2.1, BI-RADS 5e, Lung-RADS 2022 — every category is a typed field with validation.",
            },
            {
              tag: "Audit",
              accent: c.ruby,
              title: "Every token is provenanced.",
              body: "Findings, structured fields, and conclusions are linked to dictation spans for full traceability.",
            },
          ].map((f) => (
            <article
              key={f.title}
              className="rounded-lg p-7"
              style={{
                background: "white",
                boxShadow: cardShadow,
                border: `1px solid ${c.border}`,
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: f.accent }}
                />
                <span
                  className="text-[12px] uppercase"
                  style={{
                    color: f.accent,
                    fontFamily: monoStack,
                    letterSpacing: "0.06em",
                  }}
                >
                  {f.tag}
                </span>
              </div>
              <h3
                className="mt-3"
                style={{
                  fontSize: 26,
                  fontWeight: 300,
                  lineHeight: 1.12,
                  letterSpacing: "-0.26px",
                  color: c.heading,
                }}
              >
                {f.title}
              </h3>
              <p
                className="mt-3"
                style={{
                  fontSize: 16,
                  lineHeight: 1.5,
                  color: c.body,
                  fontWeight: 300,
                }}
              >
                {f.body}
              </p>
              <a
                href="#"
                className="mt-5 inline-block text-[14px] font-medium"
                style={{ color: c.primary }}
              >
                Learn more →
              </a>
            </article>
          ))}
        </div>
      </section>

      {/* Metrics */}
      <section id="metrics" className="mx-auto max-w-6xl px-6 pb-24">
        <div
          className="grid grid-cols-2 gap-6 md:grid-cols-4"
          style={{ fontFeatureSettings: '"tnum" 1' }}
        >
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
                  fontWeight: 300,
                  lineHeight: 1.1,
                  letterSpacing: "-0.96px",
                  color: c.heading,
                }}
              >
                {n}
              </div>
              <div
                className="mt-1 text-[14px]"
                style={{ color: c.body, fontWeight: 300 }}
              >
                {t}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA banner */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div
          className="overflow-hidden rounded-2xl p-12 md:p-14"
          style={{
            background: `linear-gradient(135deg, ${c.brandDark} 0%, ${c.primary} 60%, ${c.magenta} 110%)`,
            color: "white",
            boxShadow: "rgba(50,50,93,0.25) 0 30px 60px -12px",
          }}
        >
          <h3
            style={{
              fontSize: 40,
              fontWeight: 300,
              lineHeight: 1.1,
              letterSpacing: "-0.96px",
              color: "white",
              maxWidth: "32ch",
            }}
          >
            Get the standardised radiology infrastructure your team needs.
          </h3>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a
              href="#"
              className="rounded px-5 py-3 text-[15px]"
              style={{
                background: "white",
                color: c.primary,
                fontWeight: 500,
              }}
            >
              Start now →
            </a>
            <a
              href="#"
              className="rounded px-5 py-3 text-[15px]"
              style={{
                background: "transparent",
                color: "white",
                border: "1px solid rgba(255,255,255,0.35)",
              }}
            >
              Contact sales
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="mx-auto max-w-6xl px-6 py-10 text-[13px]"
        style={{
          color: c.body,
          borderTop: `1px solid ${c.border}`,
          fontWeight: 300,
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>© 2026 Radia · Stripe-inspired DESIGN.md demo</div>
          <div className="flex gap-5">
            <Link href="/design-demo" style={{ color: c.heading }}>
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
