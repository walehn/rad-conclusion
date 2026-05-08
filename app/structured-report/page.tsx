import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/guard";
import {
  DISEASE_REGISTRY,
  diseaseCategoryToSlug,
  type DiseaseCategory,
} from "@/lib/prompts/disease-registry";
import {
  StructuredReportSelectorClient,
  type SelectorEntry,
} from "./structured-report-selector-client";

// Session-aware pages must not be cached at the route level.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "구조화 리포트 생성기",
};

export default async function StructuredReportSelectorPage() {
  // Redirects to /login?next=/structured-report when no valid session is present.
  await requireSession("/structured-report");

  const entries: SelectorEntry[] = (
    Object.entries(DISEASE_REGISTRY) as [
      DiseaseCategory,
      (typeof DISEASE_REGISTRY)[DiseaseCategory],
    ][]
  ).map(([category, meta]) => ({
    category,
    slug: diseaseCategoryToSlug(category),
    meta: {
      displayNameKo: meta.displayNameKo,
      description: meta.description,
      supportedModalities: meta.supportedModalities,
    },
  }));

  return <StructuredReportSelectorClient entries={entries} />;
}
