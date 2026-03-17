"use client";

import * as React from "react";
import { Select } from "@/components/ui/select";
import type { ConclusionStyle, ConclusionLang } from "@/lib/prompts/system-prompt";

interface OptionsPanelProps {
  style: ConclusionStyle;
  lang: ConclusionLang;
  compareMode: boolean;
  onStyleChange: (style: ConclusionStyle) => void;
  onLangChange: (lang: ConclusionLang) => void;
  onCompareModeChange: (enabled: boolean) => void;
}

export function OptionsPanel({
  style,
  lang,
  compareMode,
  onStyleChange,
  onLangChange,
  onCompareModeChange,
}: OptionsPanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-4">
        <div className="min-w-[140px] flex-1">
          <Select
            id="style"
            label="Style"
            value={style}
            onChange={(e) => onStyleChange(e.target.value as ConclusionStyle)}
          >
            <option value="numbered">Numbered</option>
            <option value="short">Short</option>
            <option value="urgent-first">Urgent First</option>
          </Select>
        </div>
        <div className="min-w-[140px] flex-1">
          <Select
            id="lang"
            label="Output Language"
            value={lang}
            onChange={(e) => onLangChange(e.target.value as ConclusionLang)}
          >
            <option value="en">English</option>
            <option value="ko">Korean</option>
            <option value="mixed">Mixed</option>
          </Select>
        </div>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={compareMode}
          onChange={(e) => onCompareModeChange(e.target.checked)}
          className="h-4 w-4 rounded border-border text-primary focus:ring-primary/50"
        />
        <span className="text-sm font-medium text-foreground">A/B Compare</span>
        <span className="text-xs text-muted-foreground">(V1 Basic vs V2 Advanced)</span>
      </label>
    </div>
  );
}
