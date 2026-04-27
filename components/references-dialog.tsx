"use client";

import { Info, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Citation } from "@/lib/prompts/disease-registry";

interface ReferencesDialogProps {
  citations: readonly Citation[];
  triggerLabel?: string;
  /**
   * Visual size of the trigger button.
   * - `sm` (default): `text-xs`/12px icon — used for compact in-form placement.
   * - `lg`           : `text-sm`/16px icon — used inside the page hero card so
   *                    the Sources link reads at body-text scale instead of
   *                    feeling like a footnote.
   */
  size?: "sm" | "lg";
}

/**
 * Inline trigger that opens a modal listing the authoritative standards
 * the structured report is paraphrased from.
 */
export function ReferencesDialog({
  citations,
  triggerLabel = "근거 표준 (Sources)",
  size = "sm",
}: ReferencesDialogProps) {
  const triggerClasses =
    size === "lg"
      ? "inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:underline transition-colors"
      : "inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors";
  const iconClasses = size === "lg" ? "h-4 w-4" : "h-3 w-3";
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className={triggerClasses}
          aria-label="View report generation sources"
        >
          <Info className={iconClasses} aria-hidden="true" />
          {triggerLabel}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>리포트 작성 기준</DialogTitle>
          <DialogDescription>
            본 구조화 리포트는 다음 표준을 paraphrase하여 작성됩니다.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-4 my-2">
          {citations.map((c) => (
            <li key={c.id} className="border-l-2 border-primary/30 pl-3">
              <div className="font-medium leading-snug">
                <span className="inline-block rounded bg-muted px-1.5 py-0.5 text-xs font-mono mr-2">
                  {c.shortLabel}
                </span>
                {c.fullTitle}
              </div>
              {(c.authors || c.venue) && (
                <div className="text-sm text-muted-foreground mt-1">
                  {[c.authors, c.venue, String(c.year)].filter(Boolean).join(" · ")}
                </div>
              )}
              <div className="text-sm mt-1">
                <span className="text-muted-foreground">적용 범위: </span>
                {c.scope}
              </div>
              {c.url && (
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-1"
                >
                  {c.url}
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              )}
              {c.notice && (
                <div className="text-xs text-muted-foreground italic mt-1">
                  {c.notice}
                </div>
              )}
            </li>
          ))}
        </ul>
        <DialogFooter>
          <p className="text-xs text-muted-foreground">
            본 리포트는 위 표준을 paraphrase한 것이며, 영상의학 전문의의 검토를
            대체하지 않습니다.
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
