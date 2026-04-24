"use client";

import Link from "next/link";
import { ArrowRight, FileText, LayoutList } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Shared card styling per SPEC-DASHBOARD-001 ui-spec.md §1.5
const cardClassName = cn(
  "group relative flex min-h-[240px] flex-col gap-4 rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm",
  "transition-all duration-200 ease-out",
  "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  "active:translate-y-0 active:shadow-sm",
  "md:min-h-[260px] md:p-8",
);

type DashboardCardProps = {
  href: string;
  ariaLabel: string;
  icon: React.ReactNode;
  title: string;
  description: string;
};

function DashboardCard({ href, ariaLabel, icon, title, description }: DashboardCardProps) {
  return (
    <Link href={href} prefetch aria-label={ariaLabel} className={cardClassName}>
      {icon}
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      {/* Visual-only CTA (not a real button) because the entire card is a single interactive Link */}
      <span className={cn(buttonVariants({ variant: "default", size: "default" }), "mt-auto w-fit")}
      >
        시작하기
        <ArrowRight
          className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </span>
    </Link>
  );
}

export function DashboardCards() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:gap-8">
      <DashboardCard
        href="/conclusion"
        ariaLabel="결론 생성기 시작 — Findings로부터 Impression 생성"
        icon={<FileText className="h-12 w-12 text-primary" aria-hidden="true" />}
        title="결론 생성기"
        description="Findings 텍스트로부터 정제된 결론(Impression)을 생성합니다. V1/V2 비교, 스타일/언어 선택을 지원합니다."
      />
      <DashboardCard
        href="/structured-report"
        ariaLabel="구조화 리포트 생성기 시작 — 섹션 구조화된 리포트 생성"
        icon={<LayoutList className="h-12 w-12 text-primary" aria-hidden="true" />}
        title="구조화 리포트 생성기"
        description="Findings와 Modality로부터 TECHNIQUE / FINDINGS / STAGING / IMPRESSION 구조의 완성된 리포트를 생성합니다. 현재 Renal Cell Carcinoma(신세포암)를 지원합니다."
      />
    </div>
  );
}
