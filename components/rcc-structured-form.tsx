"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import type {
  RccMass,
  RccStructuredInput,
} from "@/lib/prompts/disease-templates/rcc-serializer";
import { Button } from "@/components/ui/button";
import { RccMassCard } from "@/components/rcc-mass-card";
import { RccStudyLevelCard } from "@/components/rcc-study-level-card";
import { RccClinicalContextCard } from "@/components/rcc-clinical-context-card";
import { genClientId } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RccStructuredFormProps {
  value: RccStructuredInput;
  onChange: (next: RccStructuredInput) => void;
  error?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RccStructuredForm({
  value,
  onChange,
  error,
}: RccStructuredFormProps) {
  const removable = value.masses.length > 1;

  // Spread `value` first so that study-level fields (lymphNodes, distantMetastases, …)
  // are preserved across mass-list mutations.
  const handleMassChange = (idx: number, next: RccMass) => {
    onChange({
      ...value,
      masses: value.masses.map((m, i) => (i === idx ? next : m)),
    });
  };

  const handleMassRemove = (idx: number) => {
    onChange({
      ...value,
      masses: value.masses.filter((_, i) => i !== idx),
    });
  };

  const handleAddMass = () => {
    onChange({
      ...value,
      masses: [...value.masses, { id: genClientId() }],
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <RccClinicalContextCard value={value} onChange={onChange} />

      <div className="flex flex-col gap-6">
        {value.masses.map((mass, idx) => (
          <RccMassCard
            key={mass.id ?? idx}
            value={mass}
            onChange={(next) => handleMassChange(idx, next)}
            onRemove={() => handleMassRemove(idx)}
            index={idx}
            removable={removable}
          />
        ))}
      </div>

      <div>
        <Button
          type="button"
          variant="outline"
          onClick={handleAddMass}
          className="w-full sm:w-auto"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add another mass
        </Button>
      </div>

      <RccStudyLevelCard value={value} onChange={onChange} />
    </div>
  );
}
