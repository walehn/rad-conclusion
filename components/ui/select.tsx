import * as React from "react";
import { cn } from "@/lib/utils";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  /** Dense toolbar variant: small label, 32px control. */
  compact?: boolean;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, children, id, compact = false, ...props }, ref) => {
    return (
      <div className={cn("flex flex-col", compact ? "gap-1" : "gap-1.5")}>
        {label && (
          <label
            htmlFor={id}
            className={cn(
              "font-medium text-foreground",
              compact ? "text-xs text-foreground/75" : "text-sm"
            )}
          >
            {label}
          </label>
        )}
        <select
          id={id}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            compact && "h-8 px-2 py-0 text-[13px]",
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </select>
      </div>
    );
  }
);
Select.displayName = "Select";

export { Select };
