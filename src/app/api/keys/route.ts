import { and, eq, inArray, ne } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { apiKeys, keyModelLinks, llmModels, providers } from "@/db/schema";
import { encryptApiKey, maskApiKey } from "@/lib/crypto";
import { ensureSeeded } from "@/lib/seed";
import { getSingleKeyDTO, getWorkspaceData } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const createKeySchema = z.object({
  providerId: z.string().trim().min(1, "Provider is required"),
  label: z.string().trim().min(1, "Label is required").max(120),
  rawKey: z.string().trim().min(3, "API key is required").max(2048),
  environment: z.enum(["test", "dev", "staging", "sandbox"]).default("test"),
  scopeMode: z.enum(["all_provider", "selected_models"]).default("all_provider"),
  modelIds: z.array(z.string().trim().min(1)).max(100).default([]),
  envVarOverride: z
    .string()
    .trim()
    .max(100)
    .regex(/^[A-Z0-9_]*$/, "Environment variable must be uppercase letters, numbers, or underscores")
    .optional()
    .nullable(),
  baseUrlOverride: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  isFavorite: z.boolean().default(false),
  isDefault: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  try {
    const includeRawKeys = request.nextUrl.searchParams.get("reveal") === "true";
    const workspace = await getWorkspaceData({ includeRawKeys });
    return NextResponse.json({ keys: workspace.keys });
  } catch (error) {
    console.error("GET /api/keys failed:", error);
    return NextResponse.json({ error: "Failed to list API keys." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureSeeded();
    const body = await request.json();
    const parsed = createKeySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message || "Invalid key payload.",
          issues: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const input = parsed.data;

    const [provider] = await db
      .select()
      .from(providers)
      .where(eq(providers.id, input.providerId))
      .limit(1);

    if (!provider) {
      return NextResponse.json({ error: "Selected provider does not exist." }, { status: 404 });
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

    const prefixMatches =
      provider.keyPrefix && input.rawKey.startsWith(provider.keyPrefix.slice(0, 3));
    const initialStatus = prefixMatches ? "format_ok" : "untested";
    const initialStatusMessage = prefixMatches
      ? `Matches ${provider.name} key format`
      : "Stored in test vault";

    const uniqueModelIds = Array.from(new Set(input.modelIds));
    let validModelIds: string[] = [];
    if (uniqueModelIds.length > 0) {
      const existingModels = await db
        .select({ id: llmModels.id })
        .from(llmModels)
        .where(inArray(llmModels.id, uniqueModelIds));
      validModelIds = existingModels.map((m) => m.id);
    }

    if (input.scopeMode === "selected_models" && validModelIds.length === 0) {
      return NextResponse.json(
        { error: "Select at least one model when using selected-models scope." },
        { status: 400 }
      );
    }

    const createdId = await db.transaction(async (tx) => {
      const existingProviderKeys = await tx
        .select({ id: apiKeys.id })
        .from(apiKeys)
        .where(eq(apiKeys.providerId, input.providerId))
        .limit(1);

      const shouldBeDefault = input.isDefault || existingProviderKeys.length === 0;

      const [inserted] = await tx
        .insert(apiKeys)
        .values({
          providerId: input.providerId,
          label: input.label,
          encryptedKey: encryptApiKey(input.rawKey),
          maskedKey: maskApiKey(input.rawKey),
          envVarOverride: input.envVarOverride?.trim() || null,
          baseUrlOverride: input.baseUrlOverride?.trim() || null,
          environment: input.environment,
          scopeMode: input.scopeMode,
          isFavorite: input.isFavorite,
          isDefault: shouldBeDefault,
          notes: input.notes?.trim() || null,
          lastStatus: initialStatus,
          lastStatusMessage: initialStatusMessage,
        })
        .returning({ id: apiKeys.id });

      if (shouldBeDefault) {
        await tx
          .update(apiKeys)
          .set({ isDefault: false })
          .where(
            and(
              eq(apiKeys.providerId, input.providerId),
              ne(apiKeys.id, inserted.id)
            )
          );
      }

      if (validModelIds.length > 0) {
        await tx
          .insert(keyModelLinks)
          .values(validModelIds.map((modelId) => ({ apiKeyId: inserted.id, modelId })))
          .onConflictDoNothing();
      }

      return inserted.id;
    });

    const dto = await getSingleKeyDTO(createdId, false);
    return NextResponse.json({ key: dto }, { status: 201 });
  } catch (error) {
    console.error("POST /api/keys failed:", error);
    return NextResponse.json({ error: "Failed to save API key." }, { status: 500 });
  }
}
