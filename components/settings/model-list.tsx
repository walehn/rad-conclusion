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
            <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${model.isDefault ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
              {model.isDefault && (
                <svg className="h-3 w-3 text-primary-foreground" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <input
              type="radio"
              name="default-model"
              checked={model.isDefault}
              onChange={() => onDefaultChange(model.id)}
              disabled={disabled}
              className="sr-only"
            />
            <span className={`text-sm ${model.isDefault ? "font-medium text-foreground" : "text-muted-foreground"}`}>{model.name}</span>
            <span className="text-xs text-muted-foreground">({model.id})</span>
            {model.isDefault && (
              <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                Selected
              </span>
            )}
          </label>
        ))}
      </div>
    </div>
  );
}
