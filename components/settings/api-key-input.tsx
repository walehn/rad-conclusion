"use client";

import * as React from "react";
import { Eye, EyeOff, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ValidationStatus } from "@/lib/providers/types";

interface ApiKeyInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidate: () => void;
  validationStatus: ValidationStatus;
  validationError?: string;
  placeholder?: string;
  disabled?: boolean;
  hasStoredKey?: boolean;
}

export function ApiKeyInput({
  value,
  onChange,
  onValidate,
  validationStatus,
  validationError,
  placeholder = "Enter API key...",
  disabled = false,
  hasStoredKey = false,
}: ApiKeyInputProps) {
  const [visible, setVisible] = React.useState(false);

  const effectivePlaceholder =
    hasStoredKey && !value
      ? "저장된 키가 있습니다. 변경하려면 새 키를 입력하세요."
      : placeholder;

  return (
    <div className="flex flex-col gap-2">
      {hasStoredKey && (
        <span className="inline-flex w-fit items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
          키 저장됨
        </span>
      )}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type={visible ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={effectivePlaceholder}
            disabled={disabled}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => setVisible(!visible)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
            aria-label={visible ? "Hide API key" : "Show API key"}
          >
            {visible ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onValidate}
          disabled={disabled || !value || validationStatus === "validating"}
          className="shrink-0"
        >
          {validationStatus === "validating" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Validate"
          )}
        </Button>

        {validationStatus === "valid" && (
          <CheckCircle className="h-5 w-5 shrink-0 text-green-500" />
        )}
        {validationStatus === "invalid" && (
          <XCircle className="h-5 w-5 shrink-0 text-red-500" />
        )}
      </div>

      {validationStatus === "invalid" && validationError && (
        <p className="text-sm text-red-500">{validationError}</p>
      )}
    </div>
  );
}
