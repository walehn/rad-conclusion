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

describe("StructuredReportClient — tab integration", () => {
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

  it("Free Text 탭의 텍스트가 그대로 findings 필드로 전송된다 (AC-1)", async () => {
    render(<StructuredReportClient />);

    // Free Text tab is active by default — find the textarea inside the tabpanel
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Right kidney 4cm mass" } });

    fireEvent.click(
      screen.getByRole("button", { name: /Generate structured report/i })
    );

    await waitFor(() => {
      const generateCall = fetchCalls.find((c) =>
        c.url === "/api/structured-report/generate"
      );
      expect(generateCall).toBeDefined();
      const body = JSON.parse(generateCall!.options.body as string);
      expect(body.findings).toBe("Right kidney 4cm mass");
      expect(body.diseaseCategory).toBe("RCC");
    });
  });

  it("RCC Structured 탭의 직렬화 결과가 findings 필드로 전송된다 (AC-2)", async () => {
    render(<StructuredReportClient />);

    // Switch to RCC Structured tab — use getAllByRole to handle multiple tab elements
    // and target the one controlling the rcc-structured panel.
    const rccTab = screen
      .getAllByRole("tab", { name: /RCC Structured/i })
      .find((el) => el.getAttribute("aria-controls") === "tabpanel-rcc-structured");
    expect(rccTab).toBeDefined();
    fireEvent.click(rccTab!);

    // Select Side = "Right" via the radio input inside the Side radiogroup
    const rightRadio = screen.getByRole("radio", { name: "Right" });
    fireEvent.click(rightRadio);

    // Enter mass size
    const massSizeInput = screen.getByRole("spinbutton", {
      name: /Mass size/i,
    });
    fireEvent.change(massSizeInput, { target: { value: "3.5" } });

    // Generate button should be enabled for rcc-structured tab — pick the non-disabled one
    const generateButtons = screen.getAllByRole("button", {
      name: /Generate structured report/i,
    });
    const enabledButton = generateButtons.find(
      (el) => !(el as HTMLButtonElement).disabled
    );
    expect(enabledButton).toBeDefined();
    fireEvent.click(enabledButton!);

    await waitFor(() => {
      const generateCall = fetchCalls.find((c) =>
        c.url === "/api/structured-report/generate"
      );
      expect(generateCall).toBeDefined();
      const body = JSON.parse(generateCall!.options.body as string);
      // serializeRccStructuredInput always emits these two lines
      expect(body.findings).toContain("- Side:");
      expect(body.findings).toContain("- Mass size:");
      expect(body.diseaseCategory).toBe("RCC");
    });
  });
});
