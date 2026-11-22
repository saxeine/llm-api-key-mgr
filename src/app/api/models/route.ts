import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { llmModels, providers } from "@/db/schema";
import { ensureSeeded } from "@/lib/seed";
import { getWorkspaceData } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const createModelSchema = z.object({
  providerId: z.string().trim().min(1, "Provider is required"),
  name: z.string().trim().min(1, "Model display name is required").max(100),
  apiModelId: z.string().trim().min(1, "API model ID is required").max(160),
  category: z
    .enum(["flagship", "reasoning", "fast", "coding", "open-weights", "search", "router"])
    .default("flagship"),
  contextWindow: z.string().trim().max(32).default("128K"),
  maxOutput: z.string().trim().max(32).default("16K"),
  modalities: z.string().trim().max(80).default("Text, Tools"),
  inputPrice: z.string().trim().max(40).default("Custom"),
  outputPrice: z.string().trim().max(40).default("Custom"),
  description: z
    .string()
    .trim()
    .max(300)
    .default("Custom LLM endpoint added to KeyBench workspace."),
});

export async function GET() {
  try {
    const data = await getWorkspaceData();
    return NextResponse.json({ providers: data.providers, models: data.models });
  } catch (error) {
    console.error("GET /api/models failed:", error);
    return NextResponse.json({ error: "Failed to load models." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureSeeded();
    const body = await request.json();
    const parsed = createModelSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid model payload." },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const [prov] = await db
      .select()
      .from(providers)
      .where(eq(providers.id, input.providerId))
      .limit(1);

    if (!prov) {
      return NextResponse.json({ error: "Provider not found." }, { status: 404 });
    }

    const slugBase = `${input.providerId}-${input.apiModelId}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 64);
    const id = `custom-${slugBase}-${Date.now().toString(36)}`;

    const [created] = await db
      .insert(llmModels)
      .values({
        id,
        providerId: input.providerId,
        name: input.name,
        apiModelId: input.apiModelId,
        category: input.category,
        contextWindow: input.contextWindow || "128K",
        maxOutput: input.maxOutput || "16K",
        modalities: input.modalities || "Text, Tools",
        inputPrice: input.inputPrice || "Custom",
        outputPrice: input.outputPrice || "Custom",
        description:
          input.description || "Custom LLM endpoint added to KeyBench workspace.",
        isPopular: false,
        isCustom: true,
        sortOrder: 5,
      })
      .returning();

    return NextResponse.json({ model: created }, { status: 201 });
  } catch (error) {
    console.error("POST /api/models failed:", error);
    return NextResponse.json({ error: "Failed to create custom model." }, { status: 500 });
  }
}
