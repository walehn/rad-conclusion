"use client";

import * as React from "react";
import { Stethoscope } from "lucide-react";
import type { DiseaseCategory } from "@/lib/prompts/disease-registry";
import { getDiseaseCategoryMetadata } from "@/lib/prompts/disease-registry";
import { cn } from "@/lib/utils";

interface DiseaseCategoryIndicatorProps {
  category: DiseaseCategory;
  className?: string;
  variant?: "pill" | "overline";
  index?: number;
}

export function DiseaseCategoryIndicator({
  category,
  className,
  variant = "pill",
  index,
}: DiseaseCategoryIndicatorProps) {
  const meta = getDiseaseCategoryMetadata(category);

  if (variant === "overline") {
    return (
      <div
        role="status"
        aria-label={`현재 질병 카테고리: ${index !== undefined ? `#${index} ` : ""}${meta.displayNameKo} (${meta.displayName})`}
        className={cn("inline-flex items-center gap-1.5", className)}
      >
        {index !== undefined && (
          <span className="font-mono text-xs font-semibold text-primary">
            #{index}
          </span>
        )}
        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {meta.displayNameKo}
        </span>
        <span className="text-xs font-normal text-muted-foreground/70">
          {meta.displayName}
        </span>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-label={`현재 선택된 질병 카테고리: ${meta.displayNameKo} (${meta.displayName})`}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-sm font-medium text-foreground",
        className
      )}
    >
      <Stethoscope aria-hidden="true" className="h-4 w-4 text-primary" />
      <span>
        {index !== undefined ? `#${index} ` : ""}
        {meta.displayNameKo}
      </span>
      <span className="text-xs font-normal text-muted-foreground">
        {meta.displayName}
      </span>
    </div>
  );
}
