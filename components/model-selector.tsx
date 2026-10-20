"use client";

import * as React from "react";
import { Select } from "@/components/ui/select";
import type { ProviderInfo, ProviderName } from "@/lib/providers/types";

interface ModelSelectorProps {
  providers: ProviderInfo[];
  selectedProvider: ProviderName;
  selectedModel: string;
  onProviderChange: (provider: ProviderName) => void;
  onModelChange: (model: string) => void;
  /** Dense toolbar variant for the structured-report page. */
  compact?: boolean;
}

export function ModelSelector({
  providers,
  selectedProvider,
  selectedModel,
  onProviderChange,
  onModelChange,
  compact = false,
}: ModelSelectorProps) {
  const currentProvider = providers.find((p) => p.name === selectedProvider);
  const models = currentProvider?.models || [];

  return (
    <div className={compact ? "flex flex-wrap gap-3" : "flex flex-wrap gap-4"}>
      <div className={compact ? "w-28" : "min-w-[160px] flex-1"}>
        <Select
          id="provider"
          label="Provider"
          compact={compact}
          value={selectedProvider}
          onChange={(e) => {
            const newProvider = e.target.value as ProviderName;
            onProviderChange(newProvider);
            const p = providers.find((pr) => pr.name === newProvider);
            if (p) {
              onModelChange(p.defaultModel);
            }
          }}
        >
          {providers.map((p) => (
            <option key={p.name} value={p.name} disabled={!p.available}>
              {p.label}
              {!p.available ? " (no API key)" : ""}
            </option>
          ))}
        </Select>
      </div>
      <div className={compact ? "w-40" : "min-w-[200px] flex-1"}>
        <Select
          id="model"
          label="Model"
          compact={compact}
          value={selectedModel}
          onChange={(e) => onModelChange(e.target.value)}
        >
          {models.map((m) => (
            <option key={m} value={m}>
              {currentProvider?.modelLabels?.[m] ?? m}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
