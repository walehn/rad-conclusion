"use client";

import * as React from "react";
import type { MyomaStructuredInput } from "@/lib/prompts/disease-templates/myoma-serializer";
import {
  MYOMA_COUNTS,
  MYOMA_UTERINE_POSITIONS,
} from "@/lib/prompts/disease-templates/myoma-fields";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import {
  SegmentedControl,
  toSegmentedOptions,
} from "@/components/ui/segmented-control";
import { FieldRow, NumberField } from "@/components/myoma-form-fields";

interface MyomaUterusCardProps {
  value: MyomaStructuredInput;
  onChange: (next: MyomaStructuredInput) => void;
}

/**
 * Section 2 — Uterus (study level).
 *
 * Holds the "All myomas typical" toggle, the single input that makes a
 * five-lesion study fast: while it is on, untouched signal fields on every
 * lesion card are collapsed and serialized as covered by the blanket
 * statement, so only exceptions need clicks.
 */
export function MyomaUterusCard({ value, onChange }: MyomaUterusCardProps) {
  const id = (suffix: string) => `myoma-uterus-${suffix}`;

  return (
    <Card className="shadow-sm ring-1 ring-border/50">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3 text-lg font-bold tracking-tight text-foreground">
          <span
            aria-hidden="true"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-sm"
          >
            2
          </span>
          Uterus
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
          <FieldRow label="Position" hint="자궁 위치">
            <SegmentedControl
              name={id("position")}
              ariaLabel="Uterine position"
              value={value.uterinePosition}
              options={toSegmentedOptions(MYOMA_UTERINE_POSITIONS)}
              onChange={(opt) => onChange({ ...value, uterinePosition: opt })}
            />
          </FieldRow>

          <FieldRow label="Total myoma count" hint="근종 총 개수">
            <Select
              id={id("count")}
              aria-label="Total myoma count"
              value={value.totalMyomaCount ?? ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  totalMyomaCount:
                    e.target.value === ""
                      ? undefined
                      : (e.target.value as MyomaStructuredInput["totalMyomaCount"]),
                })
              }
            >
              <option value="">Not specified</option>
              {MYOMA_COUNTS.map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </Select>
          </FieldRow>

          {/* Uterine size: three axes, all optional. */}
          <div className="md:col-span-2 grid gap-x-6 gap-y-5 md:grid-cols-3">
            <NumberField
              id={id("length")}
              label="Uterine length"
              value={value.uterineLengthCm}
              onChange={(v) => onChange({ ...value, uterineLengthCm: v })}
              unit="cm"
              optional
            />
            <NumberField
              id={id("ap")}
              label="AP diameter"
              value={value.uterineApCm}
              onChange={(v) => onChange({ ...value, uterineApCm: v })}
              unit="cm"
              optional
            />
            <NumberField
              id={id("transverse")}
              label="Transverse diameter"
              value={value.uterineTransverseCm}
              onChange={(v) => onChange({ ...value, uterineTransverseCm: v })}
              unit="cm"
              optional
            />
          </div>

          <fieldset className="md:col-span-2 rounded-lg border border-border p-3 flex flex-col gap-2">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                id={id("all-typical")}
                type="checkbox"
                checked={value.allTypical === true}
                onChange={(e) =>
                  onChange({ ...value, allTypical: e.target.checked })
                }
                className="mt-0.5 h-4 w-4 text-primary"
              />
              <span className="text-[0.9375rem] font-bold tracking-tight text-foreground">
                All myomas typical
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  모든 근종이 typical signal/enhancement, diffusion restriction
                  및 degeneration 없음 — 켜면 병변별 신호 입력은 예외만 하면
                  됩니다
                </span>
              </span>
            </label>
          </fieldset>
        </div>
      </CardContent>
    </Card>
  );
}
