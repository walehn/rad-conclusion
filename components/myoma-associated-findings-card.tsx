"use client";

import * as React from "react";
import type { MyomaStructuredInput } from "@/lib/prompts/disease-templates/myoma-serializer";
import {
  MYOMA_ADHESION_SITES,
  MYOMA_ENDOMETRIUM,
  MYOMA_HYDRONEPHROSIS,
  MYOMA_OVARY_STATUS,
  MYOMA_PELVIC_FLUID,
} from "@/lib/prompts/disease-templates/myoma-fields";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  SegmentedControl,
  toSegmentedOptions,
} from "@/components/ui/segmented-control";
import {
  CheckboxGroup,
  FieldRow,
  NumberField,
} from "@/components/myoma-form-fields";

interface MyomaAssociatedFindingsCardProps {
  value: MyomaStructuredInput;
  onChange: (next: MyomaStructuredInput) => void;
}

/**
 * Section 5 — Associated findings.
 *
 * Every field is optional and unanswered fields are omitted from the prompt
 * (not serialized as negatives), so this card never forces a claim the
 * radiologist did not make. Endometrial thickness is asked only for
 * "Thickened", where it both quantifies the finding and feeds the sarcoma
 * red-flag context.
 */
export function MyomaAssociatedFindingsCard({
  value,
  onChange,
}: MyomaAssociatedFindingsCardProps) {
  const id = (suffix: string) => `myoma-assoc-${suffix}`;

  return (
    <Card className="shadow-sm ring-1 ring-border/50">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3 text-lg font-bold tracking-tight text-foreground">
          <span
            aria-hidden="true"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-sm"
          >
            5
          </span>
          Associated findings
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
          <FieldRow label="Endometrium" hint="자궁내막">
            <SegmentedControl
              name={id("endometrium")}
              ariaLabel="Endometrium"
              value={value.endometrium}
              options={toSegmentedOptions(MYOMA_ENDOMETRIUM)}
              onChange={(opt) =>
                onChange({
                  ...value,
                  endometrium: opt,
                  // Thickness substantiates a "Thickened" call only.
                  endometrialThicknessMm:
                    opt === "Thickened"
                      ? value.endometrialThicknessMm
                      : undefined,
                })
              }
            />
          </FieldRow>

          {value.endometrium === "Thickened" && (
            <NumberField
              id={id("endo-thickness")}
              label="Endometrial thickness"
              value={value.endometrialThicknessMm}
              onChange={(v) =>
                onChange({ ...value, endometrialThicknessMm: v })
              }
              unit="mm"
              optional
            />
          )}

          <FieldRow label="Right ovary" hint="우측 난소">
            <SegmentedControl
              name={id("right-ovary")}
              ariaLabel="Right ovary"
              value={value.rightOvary}
              options={toSegmentedOptions(MYOMA_OVARY_STATUS)}
              onChange={(opt) => onChange({ ...value, rightOvary: opt })}
            />
          </FieldRow>

          <FieldRow label="Left ovary" hint="좌측 난소">
            <SegmentedControl
              name={id("left-ovary")}
              ariaLabel="Left ovary"
              value={value.leftOvary}
              options={toSegmentedOptions(MYOMA_OVARY_STATUS)}
              onChange={(opt) => onChange({ ...value, leftOvary: opt })}
            />
          </FieldRow>

          <FieldRow label="Pelvic fluid" hint="골반 내 액체">
            <SegmentedControl
              name={id("fluid")}
              ariaLabel="Pelvic fluid"
              value={value.pelvicFluid}
              options={toSegmentedOptions(MYOMA_PELVIC_FLUID)}
              onChange={(opt) => onChange({ ...value, pelvicFluid: opt })}
            />
          </FieldRow>

          <FieldRow label="Hydronephrosis" hint="수신증 — 요관 압박">
            <SegmentedControl
              name={id("hydro")}
              ariaLabel="Hydronephrosis"
              value={value.hydronephrosis}
              options={toSegmentedOptions(MYOMA_HYDRONEPHROSIS)}
              onChange={(opt) => onChange({ ...value, hydronephrosis: opt })}
            />
          </FieldRow>

          <CheckboxGroup
            id={id("adhesion")}
            legend="Adhesion"
            hint="유착 (복수 선택)"
            options={MYOMA_ADHESION_SITES}
            selected={value.adhesionSites}
            onChange={(next) =>
              onChange({
                ...value,
                adhesionSites: next.length > 0 ? next : undefined,
              })
            }
            className="md:col-span-2"
          />
        </div>
      </CardContent>
    </Card>
  );
}
