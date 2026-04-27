"use client";

import * as React from "react";
import type { RccStructuredInput } from "@/lib/prompts/disease-templates/rcc-serializer";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface RccClinicalContextCardProps {
  value: RccStructuredInput;
  onChange: (next: RccStructuredInput) => void;
}

export function RccClinicalContextCard({
  value,
  onChange,
}: RccClinicalContextCardProps) {
  const id = (suffix: string) => `clinical-context-${suffix}`;

  return (
    <Card className="shadow-sm ring-1 ring-border/50">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold">
          Clinical context
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* SPEC-UI-001 desktop layout revision: align gap rhythm with the
            mass / study-level cards (gap-x-6 / gap-y-5). Keep the existing
            md:grid-cols-3 split (textarea spans 2 + date input takes 1) since
            it is already optimal for clinical-context content. */}
        <div className="grid gap-x-6 gap-y-5 md:grid-cols-3">
          <div className="rounded-lg border border-border p-3 flex flex-col gap-2 md:col-span-2">
            <label
              htmlFor={id("info")}
              className="text-sm font-medium text-foreground"
            >
              Clinical information
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                (optional)
              </span>
            </label>
            <textarea
              id={id("info")}
              rows={3}
              value={value.clinicalInformation ?? ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  clinicalInformation: e.target.value || undefined,
                })
              }
              placeholder="Patient history, indication, prior surgery, symptoms..."
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
            />
          </div>

          <div className="rounded-lg border border-border p-3 flex flex-col gap-2">
            <label
              htmlFor={id("date")}
              className="text-sm font-medium text-foreground"
            >
              Study date
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                (optional)
              </span>
            </label>
            <input
              id={id("date")}
              type="date"
              value={value.studyDate ?? ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  studyDate: e.target.value || undefined,
                })
              }
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
