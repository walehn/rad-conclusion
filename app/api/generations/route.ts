import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { generations } from "@/lib/db/schema";
import { requireApiSession } from "@/lib/auth/guard";

// Reads the live SQLite file; never serve a cached snapshot.
export const dynamic = "force-dynamic";

/**
 * GET /api/generations
 *
 * Returns generation history grouped into batches — one batch per user click,
 * holding the v1/v2 pair produced from the same findings in A/B mode.
 *
 * Query params:
 *   limit  1..100 batches per page (default 20)
 *   offset batch offset (default 0)
 *   q      substring match over findings and conclusion
 *   promptVersion  'v1' | 'v2' — keeps batches that contain that version
 *   promptRevision  prompt revision id ('r1', ...) — same batch-keeping rule
 *   provider, model  exact match
 *   mine   '1' to restrict to the caller's own generations
 */
export async function GET(request: NextRequest) {
  const { session, response } = await requireApiSession();
  if (response) return response;

  try {
    const { searchParams } = new URL(request.url);

    const limit = Math.min(
      Math.max(Number.parseInt(searchParams.get("limit") ?? "20", 10) || 20, 1),
      100
    );
    const offset = Math.max(
      Number.parseInt(searchParams.get("offset") ?? "0", 10) || 0,
      0
    );

    const q = searchParams.get("q")?.trim();
    const promptVersion = searchParams.get("promptVersion");
    const promptRevision = searchParams.get("promptRevision");
    const provider = searchParams.get("provider");
    const model = searchParams.get("model");
    const mine = searchParams.get("mine") === "1";

    const filters = [];
    if (q) {
      // LIKE wildcards in user input would silently widen the search.
      const escaped = q.replace(/[%_\\]/g, (ch) => `\\${ch}`);
      const pattern = `%${escaped}%`;
      filters.push(
        or(
          like(generations.findings, pattern),
          like(generations.conclusion, pattern)
        )
      );
    }
    if (promptVersion === "v1" || promptVersion === "v2") {
      filters.push(eq(generations.promptVersion, promptVersion));
    }
    if (promptRevision) {
      filters.push(eq(generations.promptRevision, promptRevision));
    }
    if (provider) filters.push(eq(generations.provider, provider));
    if (model) filters.push(eq(generations.model, model));
    if (mine) filters.push(eq(generations.userId, session.userId));

    const where = filters.length ? and(...filters) : undefined;

    // Page over batches, not rows, so a v1/v2 pair is never split across pages.
    const batchPage = db
      .select({
        batchId: generations.batchId,
        lastAt: sql<number>`max(${generations.createdAt})`.as("last_at"),
      })
      .from(generations)
      .where(where)
      .groupBy(generations.batchId)
      .orderBy(desc(sql`last_at`))
      .limit(limit)
      .offset(offset)
      .all();

    const totalRow = db
      .select({
        n: sql<number>`count(distinct ${generations.batchId})`,
      })
      .from(generations)
      .where(where)
      .get();

    const batchIds = batchPage.map((b) => b.batchId);

    // Fetch every row of the matched batches — including the sibling version
    // that the filter itself did not match, so comparisons stay intact.
    const rows = batchIds.length
      ? db
          .select()
          .from(generations)
          .where(inArray(generations.batchId, batchIds))
          .orderBy(generations.promptVersion, generations.id)
          .all()
      : [];

    const byBatch = new Map<
      string,
      {
        batchId: string;
        createdAt: string;
        findings: string;
        items: Array<Record<string, unknown>>;
      }
    >();

    for (const row of rows) {
      let batch = byBatch.get(row.batchId);
      if (!batch) {
        batch = {
          batchId: row.batchId,
          createdAt: row.createdAt.toISOString(),
          // Identical across a batch; hoisted so the client renders it once.
          findings: row.findings,
          items: [],
        };
        byBatch.set(row.batchId, batch);
      }
      batch.items.push({
        id: row.id,
        promptVersion: row.promptVersion,
        promptRevision: row.promptRevision,
        promptHash: row.promptHash,
        conclusion: row.conclusion,
        style: row.style,
        lang: row.lang,
        provider: row.provider,
        model: row.model,
        finishReason: row.finishReason,
        promptTokens: row.promptTokens,
        completionTokens: row.completionTokens,
        ttftMs: row.ttftMs,
        totalMs: row.totalMs,
        createdAt: row.createdAt.toISOString(),
        isMine: row.userId === session.userId,
      });
    }

    // Preserve the newest-first order established by the batch page.
    const batches = batchIds
      .map((id) => byBatch.get(id))
      .filter((b): b is NonNullable<typeof b> => Boolean(b));

    return NextResponse.json({
      batches,
      total: totalRow?.n ?? 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error("[generations] list failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
