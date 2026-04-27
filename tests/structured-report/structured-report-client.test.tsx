// @vitest-environment happy-dom

import * as React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock loadProviderSettings — uses Web Crypto / localStorage which are not
// fully available in happy-dom without additional setup.
// ---------------------------------------------------------------------------

vi.mock("@/lib/storage/settings-store", () => ({
  loadProviderSettings: vi.fn(() => Promise.resolve([])),
}));

// ---------------------------------------------------------------------------
// Component under test
// ---------------------------------------------------------------------------

import { StructuredReportClient } from "@/app/structured-report/structured-report-client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal ReadableStream that closes immediately (empty stream). */
function emptyStream(): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.close();
    },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("StructuredReportClient — structured input integration", () => {
  let fetchCalls: Array<{ url: string; options: RequestInit }> = [];

  beforeEach(() => {
    fetchCalls = [];

    vi.stubGlobal("fetch", (url: string, options?: RequestInit) => {
      fetchCalls.push({ url, options: options ?? {} });

      if (url === "/api/providers") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }

      // /api/structured-report/generate — capture body, return empty stream
      return Promise.resolve({
        ok: true,
        body: emptyStream(),
      });
    });

    // Silence sessionStorage errors in happy-dom if any
    vi.stubGlobal("sessionStorage", {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("RCC Structured 입력의 직렬화 결과가 findings 필드로 전송된다", async () => {
    render(<StructuredReportClient disease="RCC" />);

    // The RCC structured form is now always visible (no tab toggle). Fill in
    // the two minimum-required fields so `hasMinimumStructuredFields` passes
    // and the Generate button becomes enabled.

    // Select Side = "Right" via the radio input inside the Side radiogroup
    const rightRadio = screen.getByRole("radio", { name: "Right" });
    fireEvent.click(rightRadio);

    // Enter mass size
    const massSizeInput = screen.getByRole("spinbutton", {
      name: /Mass size/i,
    });
    fireEvent.change(massSizeInput, { target: { value: "3.5" } });

    // With both required fields filled, exactly one Generate button should be
    // rendered and enabled (the previous tab UI rendered two — one per panel).
    const generateButton = screen.getByRole("button", {
      name: /Generate structured report/i,
    });
    expect((generateButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(generateButton);

    await waitFor(() => {
      const generateCall = fetchCalls.find((c) =>
        c.url === "/api/structured-report/generate"
      );
      expect(generateCall).toBeDefined();
      const body = JSON.parse(generateCall!.options.body as string);
      // serializeRccStructuredInput always emits these two lines, prefixed
      // with a `Mass 1:` header even for a single-mass payload.
      expect(body.findings).toContain("Mass 1:");
      expect(body.findings).toContain("- Side:");
      expect(body.findings).toContain("- Mass size:");
      // Bosniak v2019 alignment: Predominantly cystic line is emitted only
      // when massType === "Cystic"; in the default state massType is
      // undefined so the line is omitted entirely.
      expect(body.findings).not.toContain("- Predominantly cystic:");
      // Regression guard: study-level block must be omitted when no
      // lymphNodes / distantMetastases fields are set in the default state.
      expect(body.findings).not.toContain("Regional lymph nodes");
      expect(body.findings).not.toContain("Distant metastases");
      // Other findings block must also be omitted when no otherFindings text
      // has been entered.
      expect(body.findings).not.toContain("Other findings:");
      expect(body.diseaseCategory).toBe("RCC");
    });
  });
});
