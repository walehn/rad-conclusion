"use client";

import * as React from "react";
import type { ModelConfig } from "@/lib/providers/types";

interface ModelListProps {
  models: ModelConfig[];
  onDefaultChange: (modelId: string) => void;
  disabled?: boolean;
}

export function ModelList({ models, onDefaultChange, disabled = false }: ModelListProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-foreground">Models</label>
      <div className="rounded-md border border-input bg-background">
        {models.map((model) => (
          <label
            key={model.id}
            className="flex cursor-pointer items-center gap-3 border-b border-input px-3 py-2 last:border-b-0 hover:bg-accent/50"
          >
            <input
              type="radio"
              name="default-model"
              checked={model.isDefault}
              onChange={() => onDefaultChange(model.id)}
              disabled={disabled}
              className="h-4 w-4 accent-primary"
            />
            <span className="text-sm">{model.name}</span>
            <span className="text-xs text-muted-foreground">({model.id})</span>
            {model.isDefault && (
              <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                Default
              </span>
            )}
          </label>
        ))}
      </div>
    </div>
  );
}
