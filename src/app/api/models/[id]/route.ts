import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { llmModels } from "@/db/schema";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSeeded();
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "Model ID is required." }, { status: 400 });
    }

    const [deleted] = await db
      .delete(llmModels)
      .where(and(eq(llmModels.id, id), eq(llmModels.isCustom, true)))
      .returning({ id: llmModels.id });

    if (!deleted) {
      return NextResponse.json(
        { error: "Custom model not found (built-in catalog models cannot be deleted)." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, deletedId: deleted.id });
  } catch (error) {
    console.error("DELETE /api/models/[id] failed:", error);
    return NextResponse.json({ error: "Failed to delete model." }, { status: 500 });
  }
}
