import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { apiKeys, providers } from "@/db/schema";
import { detectProviderFromKey, encryptApiKey, maskApiKey } from "@/lib/crypto";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

const importSchema = z.object({
  envText: z.string().min(1, "Paste at least one KEY=value line").max(50000),
  environment: z.enum(["test", "dev", "staging", "sandbox"]).default("test"),
  labelSuffix: z.string().trim().max(60).optional(),
});

const KEYWORD_PROVIDER_MAP: Array<[string, string]> = [
  ["OPENAI", "openai"],
  ["ANTHROPIC", "anthropic"],
  ["CLAUDE", "anthropic"],
  ["GEMINI", "google"],
  ["GOOGLE", "google"],
  ["XAI", "xai"],
  ["GROK", "xai"],
  ["DEEPSEEK", "deepseek"],
  ["LLAMA", "meta"],
  ["META", "meta"],
  ["MISTRAL", "mistral"],
  ["CODESTRAL", "mistral"],
  ["DASHSCOPE", "qwen"],
  ["QWEN", "qwen"],
  ["COHERE", "cohere"],
  ["GROQ", "groq"],
  ["PERPLEXITY", "perplexity"],
  ["PPLX", "perplexity"],
  ["OPENROUTER", "openrouter"],
  ["TOGETHER", "together"],
  ["FIREWORKS", "fireworks"],
];

export async function POST(request: NextRequest) {
  try {
    await ensureSeeded();
    const body = await request.json();
    const parsed = importSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid import input." },
        { status: 400 }
      );
    }

    const { envText, environment, labelSuffix } = parsed.data;
    const providerRows = await db.select().from(providers);

    const envVarLookup = new Map<string, (typeof providerRows)[number]>();
    const byId = new Map<string, (typeof providerRows)[number]>();
    for (const p of providerRows) {
      byId.set(p.id, p);
      envVarLookup.set(p.envVar.toUpperCase(), p);
      for (const alias of p.envAliases.split(",").filter(Boolean)) {
        envVarLookup.set(alias.trim().toUpperCase(), p);
      }
    }

    const lines = envText.split(/\r?\n/);
    const imported: Array<{ id: number; label: string; providerName: string; envVar: string }> = [];
    const skipped: string[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;

      const cleaned = line.startsWith("export ") ? line.slice(7).trim() : line;
      const eqIdx = cleaned.indexOf("=");
      if (eqIdx === -1) {
        skipped.push(line.slice(0, 40));
        continue;
      }

      const rawVar = cleaned.slice(0, eqIdx).trim().toUpperCase();
      let rawVal = cleaned.slice(eqIdx + 1).trim();

      // Strip inline comments for unquoted values
      if (
        (rawVal.startsWith('"') && rawVal.endsWith('"')) ||
        (rawVal.startsWith("'") && rawVal.endsWith("'"))
      ) {
        rawVal = rawVal.slice(1, -1).trim();
      } else {
        const hashIdx = rawVal.indexOf(" #");
        if (hashIdx !== -1) {
          rawVal = rawVal.slice(0, hashIdx).trim();
        }
      }

      if (!rawVar || !/^[A-Z0-9_]+$/.test(rawVar) || rawVal.length < 3) {
        skipped.push(rawVar || line.slice(0, 32));
        continue;
      }

      // Match provider by exact envVar/alias, then keyword, then key prefix, then OpenRouter/OpenAI fallback
      let matchedProvider = envVarLookup.get(rawVar);
      if (!matchedProvider) {
        const kw = KEYWORD_PROVIDER_MAP.find(([token]) => rawVar.includes(token));
        if (kw) matchedProvider = byId.get(kw[1]);
      }
      if (!matchedProvider) {
        const prefixDetected = detectProviderFromKey(rawVal);
        if (prefixDetected) matchedProvider = byId.get(prefixDetected);
      }
      if (!matchedProvider) {
        // Ignore obviously non-LLM env vars like PORT or DATABASE_URL unless they contain KEY or TOKEN
        if (!rawVar.includes("KEY") && !rawVar.includes("TOKEN")) {
          skipped.push(rawVar);
          continue;
        }
        matchedProvider = byId.get("openai") ?? providerRows[0];
      }

      if (!matchedProvider) continue;

      const existingCount = await db
        .select({ id: apiKeys.id })
        .from(apiKeys)
        .where(eq(apiKeys.providerId, matchedProvider.id))
        .limit(1);

      const suffix = labelSuffix ? labelSuffix : `Imported (${environment})`;
      const label = `${matchedProvider.name} — ${suffix}`;
      const envOverride = rawVar !== matchedProvider.envVar ? rawVar : null;

      const [created] = await db
        .insert(apiKeys)
        .values({
          providerId: matchedProvider.id,
          label,
          encryptedKey: encryptApiKey(rawVal),
          maskedKey: maskApiKey(rawVal),
          envVarOverride: envOverride,
          environment,
          scopeMode: "all_provider",
          isDefault: existingCount.length === 0,
          notes: `Imported from ${rawVar}`,
          lastStatus:
            matchedProvider.keyPrefix &&
            rawVal.startsWith(matchedProvider.keyPrefix.slice(0, 3))
              ? "format_ok"
              : "untested",
          lastStatusMessage: `Imported via .env (${rawVar})`,
        })
        .returning({ id: apiKeys.id });

      imported.push({
        id: created.id,
        label,
        providerName: matchedProvider.name,
        envVar: rawVar,
      });
    }

    if (imported.length === 0) {
      return NextResponse.json(
        {
          error:
            "No valid LLM API key lines detected. Use format like OPENAI_API_KEY=sk-... or ANTHROPIC_API_KEY=sk-ant-...",
          skipped,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      importedCount: imported.length,
      imported,
      skipped,
    });
  } catch (error) {
    console.error("POST /api/keys/import failed:", error);
    return NextResponse.json({ error: "Failed to import .env keys." }, { status: 500 });
  }
}
