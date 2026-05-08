import Link from "next/link";

const demos = [
  {
    slug: "linear",
    name: "Linear",
    tagline: "near-black canvas · lavender accent · technical luxury",
    swatch: ["#010102", "#0f1011", "#5e6ad2", "#f7f8f8"],
    note: "Product-focused dark surface with hairline borders. Reads like software-craft documentation.",
  },
  {
    slug: "vercel",
    name: "Vercel",
    tagline: "Geist · shadow-as-border · minimalism as engineering",
    swatch: ["#ffffff", "#171717", "#0070f3", "#fafafa"],
    note: "Pure white canvas, aggressive negative tracking on Geist, multi-layer shadows replace borders.",
  },
  {
    slug: "stripe",
    name: "Stripe",
    tagline: "weight-300 elegance · saturated purple · navy ink",
    swatch: ["#ffffff", "#061b31", "#533afd", "#f96bee"],
    note: "Light-weight headlines, blue-tinted shadows, deep navy text. Premium financial-grade.",
  },
  {
    slug: "notion",
    name: "Notion",
    tagline: "warm minimalism · pastel cards · charcoal ink",
    swatch: ["#fafaf9", "#37352f", "#5645d4", "#ffe8d4"],
    note: "Off-white canvas, charcoal text, colorful database-style pastel feature cards.",
  },
] as const;

export default function DesignDemoIndex() {
  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <section className="mx-auto max-w-5xl px-6 pb-20 pt-16">
        <div className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">
          DESIGN.md showcase
        </div>
        <h1 className="text-balance text-4xl font-semibold tracking-tight text-neutral-900 md:text-5xl">
          네 가지 디자인 시스템으로 본 같은 페이지
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-neutral-600">
          VoltAgent의 awesome-design-md에서 가져온 Linear, Vercel, Stripe, Notion의
          DESIGN.md를 적용해, 동일한 영상의학 결론 도구 랜딩 페이지를 각 브랜드
          톤으로 렌더링했습니다. 카드를 눌러 비교해 보세요.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {demos.map((d) => (
            <Link
              key={d.slug}
              href={`/design-demo/${d.slug}`}
              className="group block rounded-xl border border-neutral-200 bg-white p-5 transition hover:border-neutral-400 hover:shadow-[0_2px_24px_-12px_rgba(0,0,0,0.18)]"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xl font-semibold tracking-tight">
                    {d.name}
                  </div>
                  <div className="mt-1 text-sm text-neutral-500">
                    {d.tagline}
                  </div>
                </div>
                <span className="text-neutral-400 transition group-hover:translate-x-0.5 group-hover:text-neutral-700">
                  →
                </span>
              </div>

              <div className="mt-5 flex gap-1.5">
                {d.swatch.map((c) => (
                  <span
                    key={c}
                    className="h-7 flex-1 rounded-md ring-1 ring-inset ring-black/5"
                    style={{ background: c }}
                    title={c}
                  />
                ))}
              </div>

              <p className="mt-4 text-sm leading-relaxed text-neutral-600">
                {d.note}
              </p>
            </Link>
          ))}
        </div>

        <div className="mt-12 rounded-lg border border-neutral-200 bg-neutral-50 p-5 text-sm text-neutral-600">
          <div className="font-medium text-neutral-900">
            동일 콘텐츠 / 다른 톤
          </div>
          <p className="mt-1.5 leading-relaxed">
            네 페이지 모두{" "}
            <span className="font-medium">
              헤더 → 히어로 → 기능 카드 → 통계 → CTA → 푸터
            </span>{" "}
            의 같은 정보 구조를 따릅니다. 차이는 색·타이포·간격·그림자 같은
            디자인 토큰에서만 옵니다.
          </p>
        </div>
      </section>
    </main>
  );
}
