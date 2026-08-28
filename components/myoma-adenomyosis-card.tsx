"use client";

import * as React from "react";
import type { MyomaStructuredInput } from "@/lib/prompts/disease-templates/myoma-serializer";
import {
  MYOMA_ADENOMYOSIS_KINDS,
  MYOMA_ADHESION_SITES,
  MYOMA_WALLS,
} from "@/lib/prompts/disease-templates/myoma-fields";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import {
  SegmentedControl,
  toSegmentedOptions,
} from "@/components/ui/segmented-control";
import {
  CheckboxGroup,
  FieldRow,
  NumberField,
  YesNoControl,
} from "@/components/myoma-form-fields";

interface MyomaAdenomyosisCardProps {
  value: MyomaStructuredInput;
  onChange: (next: MyomaStructuredInput) => void;
}

/**
 * Section 4 — Adenomyosis / adenomyoma.
 *
 * Three-state entry: unanswered (block omitted from the prompt), "None"
 * (explicit negative), or Diffuse / Focal with detail fields. Switching back
 * to "None" clears the detail fields so no stale focal measurements ship.
 */
export function MyomaAdenomyosisCard({
  value,
  onChange,
}: MyomaAdenomyosisCardProps) {
  const id = (suffix: string) => `myoma-adeno-${suffix}`;
  const adeno = value.adenomyosis;
  const detailed = adeno?.kind === "Diffuse" || adeno?.kind === "Focal (adenomyoma)";

  return (
    <Card className="shadow-sm ring-1 ring-border/50">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3 text-lg font-bold tracking-tight text-foreground">
          <span
            aria-hidden="true"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-sm"
          >
            4
          </span>
          Adenomyosis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
          <FieldRow label="Adenomyosis" hint="선근증" className="md:col-span-2">
            <SegmentedControl
              name={id("kind")}
              ariaLabel="Adenomyosis"
              value={adeno?.kind}
              options={toSegmentedOptions(MYOMA_ADENOMYOSIS_KINDS)}
              onChange={(opt) => {
                if (opt === "None") {
                  // Explicit negative: keep only the kind so stale focal
                  // details cannot leak into the serialized block.
                  onChange({ ...value, adenomyosis: { kind: "None" } });
                } else {
                  onChange({
                    ...value,
                    adenomyosis: { ...adeno, kind: opt },
                  });
                }
              }}
            />
          </FieldRow>

          {detailed && (
            <>
              <FieldRow label="Location" hint="위치">
                <Select
                  id={id("wall")}
                  aria-label="Adenomyosis location"
                  value={adeno?.wall ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      adenomyosis: {
                        ...adeno,
                        wall:
                          e.target.value === ""
                            ? undefined
                            : (e.target.value as (typeof MYOMA_WALLS)[number]),
                      },
                    })
                  }
                >
                  <option value="">Select location...</option>
                  {MYOMA_WALLS.map((wall) => (
                    <option key={wall} value={wall}>
                      {wall}
                    </option>
                  ))}
                </Select>
              </FieldRow>

              {adeno?.kind === "Focal (adenomyoma)" && (
                <NumberField
                  id={id("size")}
                  label="Size"
                  value={adeno?.sizeCm}
                  onChange={(v) =>
                    onChange({
                      ...value,
                      adenomyosis: { ...adeno, sizeCm: v },
                    })
                  }
                  unit="cm"
                  optional
                />
              )}

              <NumberField
                id={id("jz")}
                label="Junctional zone thickness"
                hint="≥12 mm 지지 소견"
                value={adeno?.junctionalZoneMm}
                onChange={(v) =>
                  onChange({
                    ...value,
                    adenomyosis: { ...adeno, junctionalZoneMm: v },
                  })
                }
                unit="mm"
                optional
              />

              <FieldRow
                label="T2 hyperintense foci"
                hint="내부 미세 낭성 고신호"
              >
                <YesNoControl
                  name={id("foci")}
                  ariaLabel="T2 hyperintense foci"
                  value={adeno?.t2CysticFoci}
                  onChange={(next) =>
                    onChange({
                      ...value,
                      adenomyosis: { ...adeno, t2CysticFoci: next },
                    })
                  }
                />
              </FieldRow>

              <CheckboxGroup
                id={id("adhesion")}
                legend="Adhesion to adjacent organs"
                hint="인접 장기 유착 (복수 선택)"
                options={MYOMA_ADHESION_SITES}
                selected={adeno?.adhesionSites}
                onChange={(next) =>
                  onChange({
                    ...value,
                    adenomyosis: {
                      ...adeno,
                      adhesionSites: next.length > 0 ? next : undefined,
                    },
                  })
                }
                className="md:col-span-2"
              />
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
