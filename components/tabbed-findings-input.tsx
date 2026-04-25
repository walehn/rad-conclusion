"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { FindingsInput } from "@/components/findings-input";
import { RccStructuredForm } from "@/components/rcc-structured-form";
import type { RccStructuredInput } from "@/lib/prompts/disease-templates/rcc-serializer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActiveTab = "free-text" | "rcc-structured";

interface TabbedFindingsInputProps {
  freeTextValue: string;
  onFreeTextChange: (value: string) => void;
  freeTextError?: string;
  structuredValue: RccStructuredInput;
  onStructuredChange: (value: RccStructuredInput) => void;
  activeTab: ActiveTab;
  onActiveTabChange: (tab: ActiveTab) => void;
}

// ---------------------------------------------------------------------------
// Tab order for keyboard navigation
// ---------------------------------------------------------------------------

const TAB_ORDER: ActiveTab[] = ["free-text", "rcc-structured"];

function getAdjacentTab(current: ActiveTab, direction: "left" | "right"): ActiveTab {
  const idx = TAB_ORDER.indexOf(current);
  if (direction === "right") {
    return TAB_ORDER[(idx + 1) % TAB_ORDER.length];
  }
  return TAB_ORDER[(idx - 1 + TAB_ORDER.length) % TAB_ORDER.length];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function TabbedFindingsInput({
  freeTextValue,
  onFreeTextChange,
  freeTextError,
  structuredValue,
  onStructuredChange,
  activeTab,
  onActiveTabChange,
}: TabbedFindingsInputProps) {
  const tabRefs = React.useRef<Record<ActiveTab, HTMLButtonElement | null>>({
    "free-text": null,
    "rcc-structured": null,
  });

  // Focus the newly active tab button whenever activeTab changes via keyboard
  const pendingFocusRef = React.useRef<ActiveTab | null>(null);

  React.useEffect(() => {
    if (pendingFocusRef.current !== null) {
      tabRefs.current[pendingFocusRef.current]?.focus();
      pendingFocusRef.current = null;
    }
  }, [activeTab]);

  function handleTabKeyDown(
    e: React.KeyboardEvent<HTMLButtonElement>,
    currentTab: ActiveTab
  ) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = getAdjacentTab(currentTab, "right");
      pendingFocusRef.current = next;
      onActiveTabChange(next);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const next = getAdjacentTab(currentTab, "left");
      pendingFocusRef.current = next;
      onActiveTabChange(next);
    }
    // Enter / Space are handled natively by the button click handler
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Findings 입력 모드"
        className="flex w-full rounded-lg bg-muted/50 p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "free-text"}
          aria-controls="tabpanel-free-text"
          id="tab-free-text"
          ref={(el) => {
            tabRefs.current["free-text"] = el;
          }}
          onClick={() => onActiveTabChange("free-text")}
          onKeyDown={(e) => handleTabKeyDown(e, "free-text")}
          className={cn(
            "flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
            activeTab === "free-text"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Free Text
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "rcc-structured"}
          aria-controls="tabpanel-rcc-structured"
          id="tab-rcc-structured"
          ref={(el) => {
            tabRefs.current["rcc-structured"] = el;
          }}
          onClick={() => onActiveTabChange("rcc-structured")}
          onKeyDown={(e) => handleTabKeyDown(e, "rcc-structured")}
          className={cn(
            "flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
            activeTab === "rcc-structured"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          RCC Structured
        </button>
      </div>

      {/* Free Text panel — hidden but never unmounted to preserve state */}
      <div
        role="tabpanel"
        id="tabpanel-free-text"
        aria-labelledby="tab-free-text"
        hidden={activeTab !== "free-text"}
      >
        <FindingsInput
          value={freeTextValue}
          onChange={onFreeTextChange}
          error={freeTextError}
        />
      </div>

      {/* RCC Structured panel — hidden but never unmounted to preserve state */}
      <div
        role="tabpanel"
        id="tabpanel-rcc-structured"
        aria-labelledby="tab-rcc-structured"
        hidden={activeTab !== "rcc-structured"}
      >
        <RccStructuredForm
          value={structuredValue}
          onChange={onStructuredChange}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export type { ActiveTab };
export { TabbedFindingsInput };
