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
        <span className="text-xs text-muted-foreground">
          {charCount.toLocaleString()} characters
        </span>
      </div>
      <Textarea
        id="findings"
        placeholder="Paste the Findings section of the radiology report here..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`min-h-[300px] resize-y font-mono text-sm ${
          error ? "border-destructive" : ""
        }`}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
