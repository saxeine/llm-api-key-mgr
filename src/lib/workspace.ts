import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, keyModelLinks, llmModels, providers } from "@/db/schema";
import { decryptApiKey } from "./crypto";
import { ensureSeeded } from "./seed";
import type {
  ApiKeyDTO,
  KeyEnvironment,
  KeyScopeMode,
  KeyStatus,
  LlmModelDTO,
  ProviderDTO,
  WorkspacePayload,
} from "./types";

export async function getWorkspaceData(options?: {
  includeRawKeys?: boolean;
}): Promise<WorkspacePayload> {
  await ensureSeeded();

  const [providerRows, modelRows, keyRows, linkRows] = await Promise.all([
    db.select().from(providers).orderBy(asc(providers.sortOrder), asc(providers.name)),
    db.select().from(llmModels).orderBy(asc(llmModels.sortOrder), asc(llmModels.name)),
    db
      .select()
      .from(apiKeys)
      .orderBy(
        desc(apiKeys.isFavorite),
        desc(apiKeys.isDefault),
        desc(apiKeys.updatedAt),
        desc(apiKeys.id)
      ),
    db.select().from(keyModelLinks),
  ]);

  const providerMap = new Map(providerRows.map((p) => [p.id, p]));
  const linksByKey = new Map<number, string[]>();
  for (const link of linkRows) {
    const existing = linksByKey.get(link.apiKeyId) ?? [];
    existing.push(link.modelId);
    linksByKey.set(link.apiKeyId, existing);
  }

  const providerDTOs: ProviderDTO[] = providerRows.map((p) => ({
    id: p.id,
    name: p.name,
    envVar: p.envVar,
    envAliases: p.envAliases ? p.envAliases.split(",").filter(Boolean) : [],
    baseUrl: p.baseUrl,
    keyPrefix: p.keyPrefix,
    docsUrl: p.docsUrl,
    authStyle: p.authStyle,
    accentColor: p.accentColor,
    isGateway: p.isGateway,
    sortOrder: p.sortOrder,
  }));

  const modelDTOs: LlmModelDTO[] = modelRows.map((m) => ({
    id: m.id,
    providerId: m.providerId,
    name: m.name,
    apiModelId: m.apiModelId,
    category: m.category,
    contextWindow: m.contextWindow,
    maxOutput: m.maxOutput,
    modalities: m.modalities,
    inputPrice: m.inputPrice,
    outputPrice: m.outputPrice,
    description: m.description,
    isPopular: m.isPopular,
    isCustom: m.isCustom,
    sortOrder: m.sortOrder,
  }));

  const keyDTOs: ApiKeyDTO[] = keyRows.map((k) => {
    const prov = providerMap.get(k.providerId);
    const dto: ApiKeyDTO = {
      id: k.id,
      providerId: k.providerId,
      label: k.label,
      maskedKey: k.maskedKey,
      effectiveEnvVar: k.envVarOverride?.trim() || prov?.envVar || "LLM_API_KEY",
      envVarOverride: k.envVarOverride,
      effectiveBaseUrl: k.baseUrlOverride?.trim() || prov?.baseUrl || "",
      baseUrlOverride: k.baseUrlOverride,
      environment: (k.environment as KeyEnvironment) || "test",
      scopeMode: (k.scopeMode as KeyScopeMode) || "all_provider",
      linkedModelIds: linksByKey.get(k.id) ?? [],
      isFavorite: k.isFavorite,
      isDefault: k.isDefault,
      notes: k.notes,
      lastStatus: (k.lastStatus as KeyStatus) || "untested",
      lastStatusMessage: k.lastStatusMessage,
      lastVerifiedAt: k.lastVerifiedAt ? k.lastVerifiedAt.toISOString() : null,
      copyCount: k.copyCount,
      lastAccessedAt: k.lastAccessedAt ? k.lastAccessedAt.toISOString() : null,
      createdAt: k.createdAt.toISOString(),
      updatedAt: k.updatedAt.toISOString(),
    };

    if (options?.includeRawKeys) {
      dto.rawKey = decryptApiKey(k.encryptedKey);
    }

    return dto;
  });

  const coveredProviderSet = new Set(keyDTOs.map((k) => k.providerId));
  const coveredModelCount = modelDTOs.filter((model) =>
    keyDTOs.some(
      (k) =>
        (k.providerId === model.providerId && k.scopeMode === "all_provider") ||
        k.linkedModelIds.includes(model.id)
    )
  ).length;

  const totalCopies = keyDTOs.reduce((sum, k) => sum + k.copyCount, 0);

  return {
    providers: providerDTOs,
    models: modelDTOs,
    keys: keyDTOs,
    stats: {
      totalKeys: keyDTOs.length,
      totalProviders: providerDTOs.length,
      coveredProviders: coveredProviderSet.size,
      totalModels: modelDTOs.length,
      coveredModels: coveredModelCount,
      totalCopies,
    },
  };
}

export async function getSingleKeyDTO(
  keyId: number,
  includeRaw = false
): Promise<ApiKeyDTO | null> {
  await ensureSeeded();

  const [row] = await db.select().from(apiKeys).where(eq(apiKeys.id, keyId)).limit(1);
  if (!row) return null;

  const [[prov], links] = await Promise.all([
    db.select().from(providers).where(eq(providers.id, row.providerId)).limit(1),
    db
      .select({ modelId: keyModelLinks.modelId })
      .from(keyModelLinks)
      .where(eq(keyModelLinks.apiKeyId, keyId)),
  ]);

  const dto: ApiKeyDTO = {
    id: row.id,
    providerId: row.providerId,
    label: row.label,
    maskedKey: row.maskedKey,
    effectiveEnvVar: row.envVarOverride?.trim() || prov?.envVar || "LLM_API_KEY",
    envVarOverride: row.envVarOverride,
    effectiveBaseUrl: row.baseUrlOverride?.trim() || prov?.baseUrl || "",
    baseUrlOverride: row.baseUrlOverride,
    environment: (row.environment as KeyEnvironment) || "test",
    scopeMode: (row.scopeMode as KeyScopeMode) || "all_provider",
    linkedModelIds: links.map((l) => l.modelId),
    isFavorite: row.isFavorite,
    isDefault: row.isDefault,
    notes: row.notes,
    lastStatus: (row.lastStatus as KeyStatus) || "untested",
    lastStatusMessage: row.lastStatusMessage,
    lastVerifiedAt: row.lastVerifiedAt ? row.lastVerifiedAt.toISOString() : null,
    copyCount: row.copyCount,
    lastAccessedAt: row.lastAccessedAt ? row.lastAccessedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };

  if (includeRaw) {
    dto.rawKey = decryptApiKey(row.encryptedKey);
  }

  return dto;
}
