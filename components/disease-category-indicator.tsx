"use client";

import * as React from "react";
import { Stethoscope } from "lucide-react";
import type { DiseaseCategory } from "@/lib/prompts/disease-registry";
import { getDiseaseCategoryMetadata } from "@/lib/prompts/disease-registry";
import { cn } from "@/lib/utils";

interface DiseaseCategoryIndicatorProps {
  /** Currently active disease category. v0.1.0 is always 'RCC'. */
  category: DiseaseCategory;
  /** Optional extra class names for layout composition. */
  className?: string;
}

/**
 * Visual indicator for the currently active DiseaseCategory.
 *
 * v0.1.0 behavior: display-only (no selection UI). The component is structured
 * so it can later be upgraded to a dropdown or tab switcher without changes to
 * consumers.
 *
 * Accessibility: uses role="status" + aria-label so screen readers announce
 * the active category when this region is reached. The Korean display name is
 * prominent; the English scientific name is paired as a secondary label.
 */
export function DiseaseCategoryIndicator({
  category,
  className,
}: DiseaseCategoryIndicatorProps) {
  const meta = getDiseaseCategoryMetadata(category);

  return (
    <div
      role="status"
      aria-label={`현재 선택된 질병 카테고리: ${meta.displayNameKo} (${meta.displayName})`}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-sm font-medium text-foreground",
        className
      )}
    >
      <Stethoscope
        aria-hidden="true"
        className="h-4 w-4 text-primary"
      />
      <span>{meta.displayNameKo}</span>
      <span className="text-xs font-normal text-muted-foreground">
        {meta.displayName}
      </span>
    </div>
  );
}
