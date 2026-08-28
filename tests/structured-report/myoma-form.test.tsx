// @vitest-environment happy-dom

import * as React from "react";
import {
  cleanup,
  render,
  screen,
  fireEvent,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MyomaLesionCard } from "@/components/myoma-lesion-card";
import { MyomaStructuredForm } from "@/components/myoma-structured-form";
import type {
  MyomaLesion,
  MyomaStructuredInput,
} from "@/lib/prompts/disease-templates/myoma-serializer";
import type { MyomaPurpose } from "@/lib/prompts/disease-templates/myoma-fields";

// ---------------------------------------------------------------------------
// Harnesses — controlled-state wrappers, because the cards are controlled
// components and a static `value` prop would swallow every interaction.
// ---------------------------------------------------------------------------

function LesionHarness({
  initial = {},
  allTypical = false,
  purpose,
  studyDate,
}: {
  initial?: MyomaLesion;
  allTypical?: boolean;
  purpose?: MyomaPurpose;
  studyDate?: string;
}) {
  const [value, setValue] = React.useState<MyomaLesion>(initial);
  return (
    <MyomaLesionCard
      value={value}
      onChange={setValue}
      index={0}
      removable={false}
      isIndex={false}
      allTypical={allTypical}
      purpose={purpose}
      studyDate={studyDate}
    />
  );
}

function FormHarness({ initial }: { initial: MyomaStructuredInput }) {
  const [value, setValue] = React.useState(initial);
  return <MyomaStructuredForm value={value} onChange={setValue} />;
}

const figoBadge = () => screen.getByTestId("myoma-lesion-0-figo-value");

const selectWall = (wall: string) =>
  fireEvent.change(screen.getByRole("combobox", { name: /Myoma #1 location/ }), {
    target: { value: wall },
  });

const clickLayer = (layer: string) =>
  fireEvent.click(screen.getByRole("radio", { name: layer }));

afterEach(cleanup);

// ---------------------------------------------------------------------------
// FIGO derivation through the UI
// ---------------------------------------------------------------------------

describe("MyomaLesionCard — FIGO derivation", () => {
  it("starts unresolved and derives FIGO 7 from subserosal + pedunculated", () => {
    render(<LesionHarness />);
    expect(figoBadge().textContent).toContain("미정");

    selectWall("Anterior");
    clickLayer("Subserosal");
    // Subserosal without an answer is still ambiguous (5 vs 6).
    expect(figoBadge().textContent).toContain("미정");

    fireEvent.click(screen.getByRole("checkbox", { name: /Pedunculated/ }));
    expect(figoBadge().textContent).toBe("7");
  });

  it("derives FIGO 1 vs 2 from the submucosal intramural fraction", () => {
    render(<LesionHarness />);
    selectWall("Fundal");
    clickLayer("Submucosal");
    fireEvent.click(screen.getByRole("radio", { name: "<50% intramural" }));
    expect(figoBadge().textContent).toBe("1");

    fireEvent.click(screen.getByRole("radio", { name: ">=50% intramural" }));
    expect(figoBadge().textContent).toBe("2");
  });

  it("derives FIGO 3 vs 4 from the endometrial-contact answer", () => {
    render(<LesionHarness />);
    selectWall("Posterior");
    clickLayer("Intramural");
    expect(figoBadge().textContent).toContain("미정");

    fireEvent.click(screen.getByRole("radio", { name: "Yes" }));
    expect(figoBadge().textContent).toBe("3");
    fireEvent.click(screen.getByRole("radio", { name: "No" }));
    expect(figoBadge().textContent).toBe("4");
  });

  it("builds the hybrid code when transmural is ticked", () => {
    render(<LesionHarness />);
    selectWall("Posterior");
    clickLayer("Submucosal");
    fireEvent.click(screen.getByRole("radio", { name: ">=50% intramural" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Transmural/ }));
    // Serosal component defaults to >=50% intramural (FIGO 5).
    expect(figoBadge().textContent).toBe("2-5");
  });

  it("forces FIGO 8 for a cervical lesion regardless of layer", () => {
    render(<LesionHarness />);
    selectWall("Cervical");
    expect(figoBadge().textContent).toBe("8");
    expect(screen.getByText(/FIGO 8 regardless of layer/)).toBeTruthy();
  });

  it("marks cavity involvement for FIGO 0-3 only", () => {
    render(<LesionHarness />);
    selectWall("Fundal");
    clickLayer("Intracavitary");
    expect(figoBadge().textContent).toBe("0");
    expect(screen.getByText("Cavity involvement")).toBeTruthy();

    clickLayer("Subserosal");
    fireEvent.click(screen.getByRole("checkbox", { name: /Pedunculated/ }));
    expect(figoBadge().textContent).toBe("7");
    expect(screen.queryByText("Cavity involvement")).toBeNull();
  });

  // Reusing a fraction that belonged to another layer would silently produce
  // the wrong code, so a layer switch must reset the geometry answers.
  it("clears layer-specific answers when the layer changes", () => {
    render(<LesionHarness />);
    selectWall("Anterior");
    clickLayer("Submucosal");
    fireEvent.click(screen.getByRole("radio", { name: "<50% intramural" }));
    expect(figoBadge().textContent).toBe("1");

    clickLayer("Subserosal");
    expect(figoBadge().textContent).toContain("미정");
  });

  it("lets a manual override win over the derived code", () => {
    render(<LesionHarness />);
    selectWall("Anterior");
    clickLayer("Subserosal");
    fireEvent.click(screen.getByRole("checkbox", { name: /Pedunculated/ }));
    expect(figoBadge().textContent).toBe("7");

    fireEvent.change(
      screen.getByRole("combobox", { name: /FIGO override/ }),
      { target: { value: "5" } }
    );
    expect(figoBadge().textContent).toBe("5");

    // Back to Auto restores the derivation.
    fireEvent.change(
      screen.getByRole("combobox", { name: /FIGO override/ }),
      { target: { value: "" } }
    );
    expect(figoBadge().textContent).toBe("7");
  });
});

// ---------------------------------------------------------------------------
// Signal block behaviour
// ---------------------------------------------------------------------------

describe("MyomaLesionCard — signal block", () => {
  it("collapses signal fields under allTypical until the exception button", () => {
    render(<LesionHarness allTypical />);
    expect(screen.queryByRole("radio", { name: "Hypointense" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "예외 소견 입력" }));
    expect(screen.getByRole("radio", { name: "Hypointense" })).toBeTruthy();
  });

  it("keeps signal fields open when the lesion already has an exception", () => {
    render(
      <LesionHarness allTypical initial={{ t2Signal: "Heterogeneous" }} />
    );
    // "Heterogeneous" exists in both the T2 and Enhancement groups, so scope
    // the query to the T2 radiogroup.
    const t2Group = screen.getByRole("radiogroup", {
      name: /Myoma #1 T2 signal/,
    });
    expect(
      within(t2Group)
        .getByRole("radio", { name: "Heterogeneous" })
        .getAttribute("aria-checked")
    ).toBe("true");
    expect(screen.queryByRole("button", { name: "예외 소견 입력" })).toBeNull();
  });

  it("always shows signal fields for a mass-characterization referral", () => {
    render(<LesionHarness allTypical purpose="Mass characterization" />);
    expect(screen.getByRole("radio", { name: "Hypointense" })).toBeTruthy();
  });

  it("asks for the ADC value only after a restriction call, and clears it on reversal", () => {
    render(<LesionHarness />);
    expect(screen.queryByRole("spinbutton", { name: /ADC value/ })).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: "Restricted" }));
    const adc = screen.getByRole("spinbutton", { name: /ADC value/ });
    fireEvent.change(adc, { target: { value: "0.8" } });

    fireEvent.click(screen.getByRole("radio", { name: "No restriction" }));
    expect(screen.queryByRole("spinbutton", { name: /ADC value/ })).toBeNull();

    // Re-restricting starts from a clean slate rather than the stale 0.8.
    fireEvent.click(screen.getByRole("radio", { name: "Restricted" }));
    expect(
      (screen.getByRole("spinbutton", { name: /ADC value/ }) as HTMLInputElement)
        .value
    ).toBe("");
  });
});

// ---------------------------------------------------------------------------
// HIFU planning
// ---------------------------------------------------------------------------

describe("MyomaLesionCard — HIFU Funaki", () => {
  it("shows the T2 reference options only for a HIFU referral and derives Funaki", () => {
    render(<LesionHarness purpose="HIFU/MRgFUS" />);
    fireEvent.click(
      screen.getByRole("radio", { name: /Lower than skeletal muscle/ })
    );
    expect(screen.getByText("Funaki type: I")).toBeTruthy();
  });

  it("hides the T2 reference block for other referrals", () => {
    render(<LesionHarness purpose="Myomectomy" />);
    expect(
      screen.queryByRole("radio", { name: /Lower than skeletal muscle/ })
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Red-flag banner (form level)
// ---------------------------------------------------------------------------

describe("MyomaStructuredForm — sarcoma red-flag banner", () => {
  it("is absent for a typical study", () => {
    render(<FormHarness initial={{ lesions: [{}] }} />);
    expect(screen.queryByText(/육종 감별 필요/)).toBeNull();
    expect(screen.queryByText(/Red flag/)).toBeNull();
  });

  it("stays informational below the per-lesion threshold", () => {
    render(
      <FormHarness
        initial={{
          lesions: [{ margin: "Irregular" }, { diffusion: "Restricted" }],
        }}
      />
    );
    expect(screen.getByText(/임계값.*미달/)).toBeTruthy();
    expect(screen.queryByText(/육종 감별 필요/)).toBeNull();
  });

  it("escalates when one lesion carries two red flags", () => {
    render(
      <FormHarness
        initial={{
          lesions: [{ margin: "Irregular", diffusion: "Restricted" }],
        }}
      />
    );
    expect(screen.getByText(/육종 감별 필요/)).toBeTruthy();
    expect(
      screen.getByText("Myoma 1: Irregular or infiltrative margin")
    ).toBeTruthy();
    expect(screen.getByText("Myoma 1: Restricted diffusion")).toBeTruthy();
  });

  it("marks the largest lesion as index only when there are several", () => {
    render(
      <FormHarness
        initial={{ lesions: [{ sizeCm: 2 }, { sizeCm: 9 }] }}
      />
    );
    const badges = screen.getAllByText("index (largest)");
    expect(badges).toHaveLength(1);
    // The badge lives in Myoma #2's header (the 9 cm lesion).
    expect(
      badges[0].closest("div")?.textContent
    ).toContain("#2");
  });
});
