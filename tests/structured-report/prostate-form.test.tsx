// @vitest-environment happy-dom

import * as React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ProstateStructuredForm } from "@/components/prostate-structured-form";
import {
  createEmptyProstateInput,
  createEmptyProstateLesion,
  serializeProstateStructuredInput,
  type ProstateStructuredInput,
} from "@/lib/prompts/disease-templates/prostate-serializer";

// Controlled-state harness: the form is controlled, so a static `value`
// would swallow every interaction. `latest` exposes the state for asserts.
let latest: ProstateStructuredInput;
function FormHarness({ initial }: { initial: ProstateStructuredInput }) {
  const [value, setValue] = React.useState(initial);
  latest = value;
  return <ProstateStructuredForm value={value} onChange={setValue} />;
}

const renderForm = (over: Partial<ProstateStructuredInput> = {}) =>
  render(<FormHarness initial={{ ...createEmptyProstateInput(), ...over }} />);

const withLesion = () => ({ lesions: [createEmptyProstateLesion(1)] });

afterEach(cleanup);

describe("lesion section", () => {
  it("adds a lesion card from the section header", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Add lesion" }));
    expect(latest.lesions).toHaveLength(1);
    expect(screen.getByText("병변 #1")).toBeTruthy();
  });

  it("negative-MRI toggle clears lesions and hides the cards", () => {
    renderForm(withLesion());
    fireEvent.click(screen.getByRole("checkbox", { name: /의심 병변 없음/ }));
    expect(latest.noSuspiciousLesion).toBe(true);
    expect(latest.lesions).toHaveLength(0);
    expect(screen.queryByText("병변 #1")).toBeNull();
    expect(screen.queryByRole("button", { name: "Add lesion" })).toBeNull();
  });

  it("collapses a lesion to its summary line", () => {
    renderForm(withLesion());
    const toggle = screen.getByRole("button", { name: /병변 #1/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("radiogroup", { name: /병변 #1 T2W/ })).toBeNull();
  });

  it("selects a detailed sector from the 38-sector grid", () => {
    renderForm(withLesion());
    fireEvent.click(screen.getByRole("button", { name: "38분획 상세" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "L-base-CZ" }));
    expect(latest.lesions[0].sectorMapLocation).toEqual(["L-base-CZ"]);
    // CZ exists at the base only.
    expect(screen.queryByRole("checkbox", { name: "L-mid-CZ" })).toBeNull();
  });

  it("re-derives overall PI-RADS from the scores", () => {
    renderForm(withLesion());
    const dwi = screen.getByRole("radiogroup", { name: "병변 #1 DWI score" });
    fireEvent.click(within(dwi).getByRole("radio", { name: "5" }));
    expect(latest.lesions[0].overallPiradsCategory).toBe("5");
  });
});

describe("usually-negative block", () => {
  it("stays closed with a summary when everything is at its default", () => {
    renderForm();
    const toggle = screen.getByRole("button", { name: /침범 · 림프절 · 전이/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.textContent).toContain("모두 없음");
    expect(screen.queryByRole("radiogroup", { name: /Bladder neck/ })).toBeNull();
  });

  it("opens by itself and lists a recorded finding", () => {
    renderForm({ seminalVesicleInvasionWholeGland: "left" });
    const toggle = screen.getByRole("button", { name: /침범 · 림프절 · 전이/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.textContent).toContain("정낭 좌측");
  });

  it("lymph-node features accept a typed comma", () => {
    renderForm({ regionalLymphNodes: [{ shortAxisMm: 9 }] });
    const box = screen.getByRole("textbox", { name: /Suspicious features/ }) as HTMLInputElement;
    fireEvent.change(box, { target: { value: "necrosis," } });
    expect(box.value).toBe("necrosis,");
    fireEvent.change(box, { target: { value: "necrosis, round" } });
    expect(box.value).toBe("necrosis, round");
    expect(latest.regionalLymphNodes?.[0].suspiciousFeatures).toEqual(["necrosis", "round"]);
  });
});

describe("PI-QUAL", () => {
  const dceGroup = () => screen.getByRole("radiogroup", { name: "PI-QUAL DCE subscore" });

  it("downgrades 4/4 to PI-QUAL 2 when DCE is rated −", () => {
    renderForm();
    expect(latest.piQualOverall).toBe("3_optimal");
    fireEvent.click(within(dceGroup()).getByRole("radio", { name: "− 부적절" }));
    expect(latest.piQualOverall).toBe("2_acceptable");
    fireEvent.click(within(dceGroup()).getByRole("radio", { name: "미시행" }));
    expect(latest.piQualOverall).toBe("3_optimal");
  });

  it("asks for a DCE rating when a lesion has a DCE result", () => {
    renderForm({ lesions: [{ ...createEmptyProstateLesion(1), dceResult: "positive" }] });
    expect(screen.getByText(/PI-QUAL DCE를 평가하세요/)).toBeTruthy();
    fireEvent.click(within(dceGroup()).getByRole("radio", { name: "+ 적절" }));
    expect(screen.queryByText(/PI-QUAL DCE를 평가하세요/)).toBeNull();
  });

  it("does not ask on a bpMRI study", () => {
    renderForm(withLesion());
    expect(screen.queryByText(/PI-QUAL DCE를 평가하세요/)).toBeNull();
  });
});

describe("clinical and other sections", () => {
  it("leaves an unset PSA box empty rather than showing 0", () => {
    renderForm();
    expect((screen.getByLabelText(/^PSA/) as HTMLInputElement).value).toBe("");
  });

  it("opens the extra-information row when a prior MRI date exists", () => {
    renderForm({ priorMRIDate: "2025-03-01" });
    expect(
      screen.getByRole("button", { name: /추가 정보/ }).getAttribute("aria-expanded")
    ).toBe("true");
  });

  it("reveals a free-text box on demand and keeps a filled one shown", () => {
    renderForm({ recommendations: "PSMA-PET" });
    expect(screen.getByLabelText("권고사항")).toBeTruthy();
    expect(screen.queryByLabelText("우연 소견")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "우연 소견" }));
    expect(screen.getByLabelText("우연 소견")).toBeTruthy();
  });
});

describe("serialized input is unchanged by the layout", () => {
  it("a form-built case serializes like the same state built directly", () => {
    renderForm(withLesion());
    fireEvent.change(screen.getByLabelText(/^검사일/), { target: { value: "2026-10-15" } });
    fireEvent.change(screen.getByLabelText(/^PSA/), { target: { value: "8.4" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "R-mid" }));
    const expected: ProstateStructuredInput = {
      ...createEmptyProstateInput(),
      studyDate: "2026-10-15",
      psaNgPerMl: 8.4,
      lesions: [
        {
          ...createEmptyProstateLesion(1),
          sectorMapLocation: ["R-mid"],
          laterality: "right",
          craniocaudalLevel: "mid_gland",
        },
      ],
    };
    expect(serializeProstateStructuredInput(latest)).toBe(
      serializeProstateStructuredInput(expected)
    );
  });
});
