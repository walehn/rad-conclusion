import Link from "next/link";
import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/guard";
import {
  DISEASE_REGISTRY,
  diseaseCategoryToSlug,
  type DiseaseCategory,
} from "@/lib/prompts/disease-registry";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DiseaseCategoryIndicator } from "@/components/disease-category-indicator";

// Session-aware pages must not be cached at the route level.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "구조화 리포트 생성기",
};

export default async function StructuredReportSelectorPage() {
  // Redirects to /login?next=/structured-report when no valid session is present.
  await requireSession("/structured-report");

  const entries = Object.entries(DISEASE_REGISTRY) as [
    DiseaseCategory,
    (typeof DISEASE_REGISTRY)[DiseaseCategory],
  ][];

  if (entries.length === 0) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          구조화 리포트 생성기
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          등록된 질병이 없습니다 — No diseases registered.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          구조화 리포트 생성기
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          질병을 선택하면 해당 리포트 작성 화면으로 이동합니다.
        </p>
      </header>

      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 list-none p-0">
        {entries.map(([category, meta], idx) => {
          const slug = diseaseCategoryToSlug(category);
          const index = idx + 1;
          return (
            <li key={category}>
              <Link
                href={`/structured-report/${slug}`}
                aria-label={`질병 선택: ${meta.displayNameKo} (#${index})`}
                className="group block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Card className="h-full shadow-sm ring-1 ring-border/50 transition-all duration-200 ease-out group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-md">
                  <CardHeader className="pb-3">
                    <DiseaseCategoryIndicator
                      category={category}
                      variant="hero"
                      index={index}
                    />
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {meta.description}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {meta.supportedModalities.map((m) => (
                        <span
                          key={m}
                          className="inline-flex items-center rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-foreground"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                    <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary">
                      리포트 생성 시작
                      <span aria-hidden="true">→</span>
                    </span>
                  </CardContent>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
