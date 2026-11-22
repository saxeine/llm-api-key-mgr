import { and, eq, inArray, ne } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { apiKeys, keyModelLinks, llmModels, providers } from "@/db/schema";
import { encryptApiKey, maskApiKey } from "@/lib/crypto";
import { ensureSeeded } from "@/lib/seed";
import { getSingleKeyDTO } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const updateKeySchema = z.object({
  providerId: z.string().trim().min(1).optional(),
  label: z.string().trim().min(1).max(120).optional(),
  rawKey: z.string().trim().min(3).max(2048).optional(),
  environment: z.enum(["test", "dev", "staging", "sandbox"]).optional(),
  scopeMode: z.enum(["all_provider", "selected_models"]).optional(),
  modelIds: z.array(z.string().trim().min(1)).max(100).optional(),
  envVarOverride: z
    .string()
    .trim()
    .max(100)
    .regex(/^[A-Z0-9_]*$/, "Environment variable must be uppercase letters, numbers, or underscores")
    .optional()
    .nullable(),
  baseUrlOverride: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  isFavorite: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

function parseId(raw: string): number | null {
  const num = Number(raw);
  if (!Number.isInteger(num) || num <= 0) return null;
  return num;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const keyId = parseId(id);
    if (!keyId) {
      return NextResponse.json({ error: "Invalid key ID." }, { status: 400 });
    }

    const dto = await getSingleKeyDTO(keyId, true);
    if (!dto) {
      return NextResponse.json({ error: "API key not found." }, { status: 404 });
    }

    return NextResponse.json({ key: dto });
  } catch (error) {
    console.error("GET /api/keys/[id] failed:", error);
    return NextResponse.json({ error: "Failed to fetch API key." }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSeeded();
    const { id } = await context.params;
    const keyId = parseId(id);
    if (!keyId) {
      return NextResponse.json({ error: "Invalid key ID." }, { status: 400 });
    }

    const [existing] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, keyId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "API key not found." }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateKeySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid update payload." },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const targetProviderId = input.providerId ?? existing.providerId;

    const [provider] = await db
      .select()
      .from(providers)
      .where(eq(providers.id, targetProviderId))
      .limit(1);

    if (!provider) {
      return NextResponse.json({ error: "Provider not found." }, { status: 404 });
    }

    if (input.baseUrlOverride) {
      try {
        const u = new URL(input.baseUrlOverride);
        if (u.protocol !== "https:" && u.protocol !== "http:") {
          return NextResponse.json(
            { error: "Base URL must start with https:// or http://" },
            { status: 400 }
          );
        }
      } catch {
        return NextResponse.json({ error: "Invalid custom Base URL." }, { status: 400 });
      }
    }

    let validModelIds: string[] | undefined;
    if (input.modelIds !== undefined) {
      const uniqueIds = Array.from(new Set(input.modelIds));
      if (uniqueIds.length > 0) {
        const rows = await db
          .select({ id: llmModels.id })
          .from(llmModels)
          .where(inArray(llmModels.id, uniqueIds));
        validModelIds = rows.map((r) => r.id);
      } else {
        validModelIds = [];
      }
    }

    const effectiveScope = input.scopeMode ?? existing.scopeMode;
    if (
      effectiveScope === "selected_models" &&
      validModelIds !== undefined &&
      validModelIds.length === 0
    ) {
      return NextResponse.json(
        { error: "Select at least one model when using selected-models scope." },
        { status: 400 }
      );
    }

    await db.transaction(async (tx) => {
      const updateValues: Partial<typeof apiKeys.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (input.providerId !== undefined) updateValues.providerId = input.providerId;
      if (input.label !== undefined) updateValues.label = input.label;
      if (input.environment !== undefined) updateValues.environment = input.environment;
      if (input.scopeMode !== undefined) updateValues.scopeMode = input.scopeMode;
      if (input.envVarOverride !== undefined) {
        updateValues.envVarOverride = input.envVarOverride?.trim() || null;
      }
      if (input.baseUrlOverride !== undefined) {
        updateValues.baseUrlOverride = input.baseUrlOverride?.trim() || null;
      }
      if (input.notes !== undefined) {
        updateValues.notes = input.notes?.trim() || null;
      }
      if (input.isFavorite !== undefined) updateValues.isFavorite = input.isFavorite;
      if (input.isDefault !== undefined) updateValues.isDefault = input.isDefault;

      if (input.rawKey !== undefined) {
        updateValues.encryptedKey = encryptApiKey(input.rawKey);
        updateValues.maskedKey = maskApiKey(input.rawKey);
        const matches =
          provider.keyPrefix && input.rawKey.startsWith(provider.keyPrefix.slice(0, 3));
        updateValues.lastStatus = matches ? "format_ok" : "untested";
        updateValues.lastStatusMessage = matches
          ? `Matches ${provider.name} key format`
          : "Key updated";
        updateValues.lastVerifiedAt = null;
      }

      await tx.update(apiKeys).set(updateValues).where(eq(apiKeys.id, keyId));

      if (input.isDefault === true) {
        await tx
          .update(apiKeys)
          .set({ isDefault: false })
          .where(and(eq(apiKeys.providerId, targetProviderId), ne(apiKeys.id, keyId)));
      }

      if (validModelIds !== undefined) {
        await tx.delete(keyModelLinks).where(eq(keyModelLinks.apiKeyId, keyId));
        if (validModelIds.length > 0) {
          await tx
            .insert(keyModelLinks)
            .values(validModelIds.map((modelId) => ({ apiKeyId: keyId, modelId })))
            .onConflictDoNothing();
        }
      }
    });

    const updated = await getSingleKeyDTO(keyId, false);
    return NextResponse.json({ key: updated });
  } catch (error) {
    console.error("PATCH /api/keys/[id] failed:", error);
    return NextResponse.json({ error: "Failed to update API key." }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSeeded();
    const { id } = await context.params;
    const keyId = parseId(id);
    if (!keyId) {
      return NextResponse.json({ error: "Invalid key ID." }, { status: 400 });
    }

    const [deleted] = await db
      .delete(apiKeys)
      .where(eq(apiKeys.id, keyId))
      .returning({
        id: apiKeys.id,
        providerId: apiKeys.providerId,
        wasDefault: apiKeys.isDefault,
      });

    if (!deleted) {
      return NextResponse.json({ error: "API key not found." }, { status: 404 });
    }

    // If deleted key was default, promote another key for that provider if one exists
    if (deleted.wasDefault) {
      const [fallback] = await db
        .select({ id: apiKeys.id })
        .from(apiKeys)
        .where(eq(apiKeys.providerId, deleted.providerId))
        .limit(1);
      if (fallback) {
        await db
          .update(apiKeys)
          .set({ isDefault: true })
          .where(eq(apiKeys.id, fallback.id));
      }
    }

    return NextResponse.json({ deletedId: deleted.id, ok: true });
  } catch (error) {
    console.error("DELETE /api/keys/[id] failed:", error);
    return NextResponse.json({ error: "Failed to delete API key." }, { status: 500 });
  }
}
