import { eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { decryptApiKey } from "@/lib/crypto";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSeeded();
    const { id } = await context.params;
    const keyId = Number(id);
    if (!Number.isInteger(keyId) || keyId <= 0) {
      return NextResponse.json({ error: "Invalid key ID." }, { status: 400 });
    }

    let recordCopy = false;
    try {
      const body = await request.json();
      recordCopy = Boolean(body?.recordCopy);
    } catch {
      recordCopy = false;
    }

    const [row] = await db.select().from(apiKeys).where(eq(apiKeys.id, keyId)).limit(1);
    if (!row) {
      return NextResponse.json({ error: "API key not found." }, { status: 404 });
    }

    const rawKey = decryptApiKey(row.encryptedKey);
    const now = new Date();
    let copyCount = row.copyCount;

    if (recordCopy) {
      const [updated] = await db
        .update(apiKeys)
        .set({
          copyCount: sql`${apiKeys.copyCount} + 1`,
          lastAccessedAt: now,
        })
        .where(eq(apiKeys.id, keyId))
        .returning({ copyCount: apiKeys.copyCount });
      copyCount = updated?.copyCount ?? row.copyCount + 1;
    } else {
      await db
        .update(apiKeys)
        .set({ lastAccessedAt: now })
        .where(eq(apiKeys.id, keyId));
    }

    return NextResponse.json({
      id: row.id,
      rawKey,
      copyCount,
      lastAccessedAt: now.toISOString(),
    });
  } catch (error) {
    console.error("POST /api/keys/[id]/reveal failed:", error);
    return NextResponse.json({ error: "Failed to retrieve API key." }, { status: 500 });
  }
}
