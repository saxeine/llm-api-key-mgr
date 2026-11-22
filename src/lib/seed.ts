import { db } from "@/db";
import { apiKeys, appMeta, keyModelLinks, llmModels, providers } from "@/db/schema";
import { SEED_MODELS, SEED_PROVIDERS } from "./catalog";
import { encryptApiKey, maskApiKey } from "./crypto";

let seededInProcess = false;

const CATALOG_VERSION = "catalog_v1_51";
const SAMPLE_KEYS_FLAG = "sample_keys_v1";

export async function ensureSeeded(): Promise<void> {
  if (seededInProcess) return;

  await db.insert(providers).values(SEED_PROVIDERS).onConflictDoNothing();
  await db.insert(llmModels).values(SEED_MODELS).onConflictDoNothing();

  await db
    .insert(appMeta)
    .values({ key: "catalog_version", value: CATALOG_VERSION })
    .onConflictDoUpdate({
      target: appMeta.key,
      set: { value: CATALOG_VERSION, updatedAt: new Date() },
    });

  // Insert clearly labeled placeholder sandbox keys only once on first bootstrap
  await db.transaction(async (tx) => {
    const flagInsert = await tx
      .insert(appMeta)
      .values({ key: SAMPLE_KEYS_FLAG, value: "seeded" })
      .onConflictDoNothing()
      .returning({ key: appMeta.key });

    if (flagInsert.length === 0) {
      return;
    }

    const existing = await tx.select({ id: apiKeys.id }).from(apiKeys).limit(1);
    if (existing.length > 0) {
      return;
    }

    const demoEntries = [
      {
        providerId: "openai",
        label: "OpenAI Staging Sandbox (Sample)",
        raw: "sk-proj-demo-testbench-48291037-sample9xQ2",
        environment: "staging",
        scopeMode: "all_provider",
        isFavorite: true,
        isDefault: true,
        notes: "Sample test key placeholder — edit with your real test key or delete anytime.",
        lastStatus: "format_ok",
        lastStatusMessage: "Matches OpenAI sk-proj- prefix format",
        pinnedModels: ["openai-gpt-5", "openai-gpt-5-mini", "openai-o3"],
      },
      {
        providerId: "anthropic",
        label: "Claude CI Test Runner (Sample)",
        raw: "sk-ant-demo-testbench-91048273-sample4kLm",
        environment: "test",
        scopeMode: "all_provider",
        isFavorite: true,
        isDefault: true,
        notes: "Sample key wired to Claude Sonnet 4.6, Opus 4.6, and Haiku 4.5 for local testing.",
        lastStatus: "format_ok",
        lastStatusMessage: "Matches Anthropic sk-ant- prefix format",
        pinnedModels: ["anthropic-claude-sonnet-4-6", "anthropic-claude-haiku-4-5"],
      },
      {
        providerId: "google",
        label: "AI Studio Free Tier (Sample)",
        raw: "AIzaSyDemoTestBench73918204sample2pWz",
        environment: "dev",
        scopeMode: "selected_models",
        isFavorite: false,
        isDefault: true,
        notes: "Scoped to Gemini 2.5 Flash & Gemini 3 Flash for rapid low-cost dev runs.",
        lastStatus: "format_ok",
        lastStatusMessage: "Matches Google AI Studio AIzaSy prefix format",
        pinnedModels: ["google-gemini-2-5-flash", "google-gemini-3-flash"],
      },
    ];

    for (const entry of demoEntries) {
      const [inserted] = await tx
        .insert(apiKeys)
        .values({
          providerId: entry.providerId,
          label: entry.label,
          encryptedKey: encryptApiKey(entry.raw),
          maskedKey: maskApiKey(entry.raw),
          environment: entry.environment,
          scopeMode: entry.scopeMode,
          isFavorite: entry.isFavorite,
          isDefault: entry.isDefault,
          notes: entry.notes,
          lastStatus: entry.lastStatus,
          lastStatusMessage: entry.lastStatusMessage,
        })
        .returning({ id: apiKeys.id });

      if (inserted && entry.pinnedModels.length > 0) {
        await tx
          .insert(keyModelLinks)
          .values(
            entry.pinnedModels.map((modelId) => ({
              apiKeyId: inserted.id,
              modelId,
            }))
          )
          .onConflictDoNothing();
      }
    }
  });

  seededInProcess = true;
}
