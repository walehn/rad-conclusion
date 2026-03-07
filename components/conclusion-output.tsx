"use client";

import * as React from "react";
import { Copy, Check, Loader2, FileText } from "lucide-react";
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
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">
          Output
        </label>
        <div className="flex items-center gap-2">
          {elapsedTime !== null && (
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary ring-1 ring-primary/20">
              {elapsedTime.toFixed(2)}s
            </span>
          )}
          {content && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className={`h-8 gap-1.5 px-2.5 text-xs transition-colors ${
                copied
                  ? "text-green-600 dark:text-green-400"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy</span>
                </>
              )}
            </Button>
          )}
        </div>
      </div>
      <div className="relative min-h-[300px] rounded-lg border border-border/70 bg-card p-5 shadow-inner">
        {isLoading && !content && (
          <div className="flex flex-col items-center justify-center gap-3 pt-16 text-muted-foreground">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
            <span className="text-sm">Generating conclusion...</span>
          </div>
        )}
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 ring-1 ring-destructive/20">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
        {content && (
          <pre className="whitespace-pre-wrap font-[Georgia,_'Times_New_Roman',_serif] text-sm leading-relaxed tracking-wide text-card-foreground">
            {content}
          </pre>
        )}
        {isLoading && content && (
          <div className="mt-3 flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Still generating...</span>
          </div>
        )}
        {!isLoading && !content && !error && (
          <div className="flex flex-col items-center justify-center gap-3 pt-16 text-muted-foreground">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <FileText className="h-5 w-5" />
            </div>
            <p className="text-sm">
              Generated conclusion will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
