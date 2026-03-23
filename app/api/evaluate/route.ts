import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { z } from "zod";

const DATA_DIR = path.join(process.cwd(), "data");
const PENDING_FILE = path.join(DATA_DIR, "pending-evaluations.jsonl");
const EVALUATIONS_FILE = path.join(DATA_DIR, "evaluations.jsonl");

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const EvaluateRequestSchema = z.object({
  findings: z.string().min(1, "Findings text is required"),
  conclusion: z.string().min(1, "Conclusion text is required"),
  promptVersion: z.enum(["v1", "v2"]).default("v1"),
  style: z.string().default("numbered"),
  lang: z.string().default("en"),
  model: z.string().default("unknown"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = EvaluateRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID();
    const entry = {
      id,
      timestamp: new Date().toISOString(),
      status: "pending",
      findings: parsed.data.findings,
      conclusion: parsed.data.conclusion,
      promptVersion: parsed.data.promptVersion,
      style: parsed.data.style,
      lang: parsed.data.lang,
      model: parsed.data.model,
    };

    ensureDataDir();
    fs.appendFileSync(PENDING_FILE, JSON.stringify(entry) + "\n", "utf-8");

    return NextResponse.json({ success: true, id });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") || "20", 10), 1),
      100
    );
    const offset = Math.max(
      parseInt(searchParams.get("offset") || "0", 10),
      0
    );

    if (!fs.existsSync(EVALUATIONS_FILE)) {
      return NextResponse.json({ evaluations: [], total: 0 });
    }

    const content = fs.readFileSync(EVALUATIONS_FILE, "utf-8");
    const lines = content.split("\n").filter((line) => line.trim() !== "");

    const evaluations: unknown[] = [];
    for (const line of lines) {
      try {
        evaluations.push(JSON.parse(line));
      } catch {
        // skip malformed lines
      }
    }

    // Most recent first
    evaluations.reverse();

    const paginated = evaluations.slice(offset, offset + limit);

    return NextResponse.json({
      evaluations: paginated,
      total: evaluations.length,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
