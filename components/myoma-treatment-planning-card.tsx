"use client";

import * as React from "react";
import type { MyomaStructuredInput } from "@/lib/prompts/disease-templates/myoma-serializer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FieldRow,
  NumberField,
  YesNoControl,
} from "@/components/myoma-form-fields";

interface MyomaTreatmentPlanningCardProps {
  value: MyomaStructuredInput;
  onChange: (next: MyomaStructuredInput) => void;
}

/**
 * Section 6 — Treatment planning (purpose-conditional).
 *
 * Rendered only for the two referral purposes with study-level planning
 * fields: HIFU/MRgFUS (acoustic window) and UAE (ovarian artery supply).
 * Myomectomy and follow-up need nothing here — their planning lines are
 * derived by the serializer from data already entered elsewhere.
 */
export function MyomaTreatmentPlanningCard({
  value,
  onChange,
}: MyomaTreatmentPlanningCardProps) {
  const id = (suffix: string) => `myoma-planning-${suffix}`;
  const { purpose } = value;

  if (purpose !== "HIFU/MRgFUS" && purpose !== "Uterine artery embolization") {
    return null;
  }

  return (
    <Card className="shadow-sm ring-1 ring-border/50">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3 text-lg font-bold tracking-tight text-foreground">
          <span
            aria-hidden="true"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-sm"
          >
            6
          </span>
          Treatment planning
          <span className="text-sm font-semibold text-muted-foreground">
            {purpose}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
          {purpose === "HIFU/MRgFUS" && (
            <>
              <NumberField
                id={id("skin-distance")}
                label="Skin-to-lesion distance"
                hint="음향 경로"
                value={value.skinToLesionCm}
                onChange={(v) => onChange({ ...value, skinToLesionCm: v })}
                unit="cm"
                optional
              />
              <FieldRow
                label="Abdominal wall scar"
                hint="음향창 내 복벽 반흔"
              >
                <YesNoControl
                  name={id("scar")}
                  ariaLabel="Abdominal wall scar in acoustic window"
                  value={value.abdominalWallScar}
                  onChange={(next) =>
                    onChange({ ...value, abdominalWallScar: next })
                  }
                />
              </FieldRow>
              <FieldRow label="Interposed bowel" hint="음향창 내 장관 개재">
                <YesNoControl
                  name={id("bowel")}
                  ariaLabel="Interposed bowel in acoustic window"
                  value={value.bowelInterposition}
                  onChange={(next) =>
                    onChange({ ...value, bowelInterposition: next })
                  }
                />
              </FieldRow>
            </>
          )}

          {purpose === "Uterine artery embolization" && (
            <FieldRow
              label="Suspected ovarian artery supply"
              hint="난소동맥 공급 의심"
            >
              <YesNoControl
                name={id("ovarian")}
                ariaLabel="Suspected ovarian artery supply"
                value={value.ovarianArterySupply}
                onChange={(next) =>
                  onChange({ ...value, ovarianArterySupply: next })
                }
              />
            </FieldRow>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
