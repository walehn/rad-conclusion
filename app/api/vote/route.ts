import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth/guard";
import { validateCsrfOrFail } from "@/lib/auth/csrf";

const VOTES_DIR = path.join(process.cwd(), "data");
const VOTES_FILE = path.join(VOTES_DIR, "votes.jsonl");

const VoteSchema = z.object({
  vote: z.enum(["v1", "v2", "tie"]),
  style: z.string(),
  lang: z.string(),
  model: z.string(),
  findingsLength: z.number(),
});

function ensureDataDir() {
  fs.mkdirSync(VOTES_DIR, { recursive: true });
}

function countVotes(): { v1: number; v2: number; tie: number } {
  const totals = { v1: 0, v2: 0, tie: 0 };

  if (!fs.existsSync(VOTES_FILE)) {
    return totals;
  }

  const content = fs.readFileSync(VOTES_FILE, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim() !== "");

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.vote === "v1") totals.v1++;
      else if (entry.vote === "v2") totals.v2++;
      else if (entry.vote === "tie") totals.tie++;
    } catch {
      // skip malformed lines
    }
  }

  return totals;
}

export async function POST(request: NextRequest) {
  const { response } = await requireApiSession();
  if (response) return response;

  const csrfFailure = await validateCsrfOrFail(request);
  if (csrfFailure) return csrfFailure;

  try {
    const body = await request.json();
    const parsed = VoteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const entry = {
      timestamp: new Date().toISOString(),
      vote: parsed.data.vote,
      style: parsed.data.style,
      lang: parsed.data.lang,
      model: parsed.data.model,
      findingsLength: parsed.data.findingsLength,
    };

    ensureDataDir();
    fs.appendFileSync(VOTES_FILE, JSON.stringify(entry) + "\n", "utf-8");

    const total = countVotes();

    return NextResponse.json({ success: true, total });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const { response } = await requireApiSession();
  if (response) return response;

  try {
    const total = countVotes();
    return NextResponse.json({ total });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
