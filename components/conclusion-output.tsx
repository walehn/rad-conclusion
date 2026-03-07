"use client";

import * as React from "react";
import { Copy, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConclusionOutputProps {
  content: string;
  isLoading: boolean;
  elapsedTime: number | null;
  error?: string;
}

export function ConclusionOutput({
  content,
  isLoading,
  elapsedTime,
  error,
}: ConclusionOutputProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-secure contexts
      const textarea = document.createElement("textarea");
      textarea.value = content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">
          Output
        </label>
        <div className="flex items-center gap-2">
          {elapsedTime !== null && (
            <span className="text-xs text-muted-foreground">
              {elapsedTime.toFixed(2)}s
            </span>
          )}
          {content && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-8 px-2"
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>
      <div className="relative min-h-[300px] rounded-md border border-border bg-muted/50 p-4">
        {isLoading && !content && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Generating conclusion...</span>
          </div>
        )}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        {content && (
          <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
            {content}
          </pre>
        )}
        {isLoading && content && (
          <Loader2 className="mt-2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {!isLoading && !content && !error && (
          <p className="text-sm text-muted-foreground">
            Generated conclusion will appear here.
          </p>
        )}
      </div>
    </div>
  );
}
