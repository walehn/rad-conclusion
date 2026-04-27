import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/guard";
import {
  parseDiseaseCategorySlug,
  getDiseaseCategoryMetadata,
} from "@/lib/prompts/disease-registry";
import { StructuredReportClient } from "../structured-report-client";

// Session-aware pages must not be cached at the route level.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ disease: string }>;
}): Promise<Metadata> {
  const { disease } = await params;
  const category = parseDiseaseCategorySlug(disease);
  if (!category) return { title: "질병을 찾을 수 없음" };
  const meta = getDiseaseCategoryMetadata(category);
  return { title: `${meta.displayNameKo} 구조화 리포트` };
}

export default async function StructuredReportDiseasePage({
  params,
}: {
  params: Promise<{ disease: string }>;
}) {
  const { disease } = await params;
  const category = parseDiseaseCategorySlug(disease);
  if (!category) notFound();
  // Redirects to /login?next=/structured-report/<slug> when no valid session is present.
  await requireSession(`/structured-report/${disease}`);
  return <StructuredReportClient disease={category} />;
}
