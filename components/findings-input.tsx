"use client";

import * as React from "react";
import { Textarea } from "@/components/ui/textarea";

interface FindingsInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function FindingsInput({ value, onChange, error }: FindingsInputProps) {
  const charCount = value.length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label
          htmlFor="findings"
          className="text-sm font-medium text-foreground"
        >
          Findings
        </label>
        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-border/50">
          {charCount.toLocaleString()} chars
        </span>
      </div>
      <Textarea
        id="findings"
        placeholder="Paste the Findings section of the radiology report here..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`min-h-[300px] resize-y bg-card font-mono text-sm shadow-inner transition-colors focus:bg-background ${
          error ? "border-destructive ring-1 ring-destructive/30" : ""
        }`}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
