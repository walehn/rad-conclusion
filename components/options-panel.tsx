"use client";

import * as React from "react";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import type { ConclusionStyle, ConclusionLang } from "@/lib/prompts/system-prompt";

interface OptionsPanelProps {
  style: ConclusionStyle;
  lang: ConclusionLang;
  title: string;
  onStyleChange: (style: ConclusionStyle) => void;
  onLangChange: (lang: ConclusionLang) => void;
  onTitleChange: (title: string) => void;
}

export function OptionsPanel({
  style,
  lang,
  title,
  onStyleChange,
  onLangChange,
  onTitleChange,
}: OptionsPanelProps) {
  return (
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
          label="Language"
          value={lang}
          onChange={(e) => onLangChange(e.target.value as ConclusionLang)}
        >
          <option value="en">English</option>
          <option value="ko">Korean</option>
          <option value="mixed">Mixed</option>
        </Select>
      </div>
      <div className="min-w-[140px] flex-1">
        <Input
          id="title"
          label="Title"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Conclusion"
        />
      </div>
    </div>
  );
}
