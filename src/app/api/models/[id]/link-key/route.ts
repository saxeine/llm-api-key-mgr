import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { apiKeys, keyModelLinks, llmModels } from "@/db/schema";
import { ensureSeeded } from "@/lib/seed";
import { getSingleKeyDTO } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const linkSchema = z.object({
  apiKeyId: z.number().int().positive(),
  linked: z.boolean(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSeeded();
    const { id: modelId } = await context.params;
    const body = await request.json();
    const parsed = linkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid link payload." }, { status: 400 });
    }

    const { apiKeyId, linked } = parsed.data;

    const [[model], [key]] = await Promise.all([
      db.select().from(llmModels).where(eq(llmModels.id, modelId)).limit(1),
      db.select().from(apiKeys).where(eq(apiKeys.id, apiKeyId)).limit(1),
    ]);

    if (!model || !key) {
      return NextResponse.json({ error: "Model or API key not found." }, { status: 404 });
    }

    if (linked) {
      await db
        .insert(keyModelLinks)
        .values({ apiKeyId, modelId })
        .onConflictDoNothing();
    } else {
      await db
        .delete(keyModelLinks)
        .where(
          and(
            eq(keyModelLinks.apiKeyId, apiKeyId),
            eq(keyModelLinks.modelId, modelId)
          )
        );
    }

    await db
      .update(apiKeys)
      .set({ updatedAt: new Date() })
      .where(eq(apiKeys.id, apiKeyId));

    const updatedKey = await getSingleKeyDTO(apiKeyId, false);
    return NextResponse.json({ ok: true, key: updatedKey });
  } catch (error) {
    console.error("POST /api/models/[id]/link-key failed:", error);
    return NextResponse.json({ error: "Failed to link key to model." }, { status: 500 });
  }
}
