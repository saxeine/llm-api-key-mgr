import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const providers = pgTable("providers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  envVar: text("env_var").notNull(),
  envAliases: text("env_aliases").notNull().default(""),
  baseUrl: text("base_url").notNull(),
  keyPrefix: text("key_prefix").notNull(),
  docsUrl: text("docs_url").notNull(),
  authStyle: text("auth_style").notNull().default("bearer"),
  accentColor: text("accent_color").notNull().default("#4F46E5"),
  isGateway: boolean("is_gateway").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(100),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const llmModels = pgTable(
  "llm_models",
  {
    id: text("id").primaryKey(),
    providerId: text("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    apiModelId: text("api_model_id").notNull(),
    category: text("category").notNull().default("flagship"),
    contextWindow: text("context_window").notNull().default("128K"),
    maxOutput: text("max_output").notNull().default("16K"),
    modalities: text("modalities").notNull().default("Text, Tools"),
    inputPrice: text("input_price").notNull().default("—"),
    outputPrice: text("output_price").notNull().default("—"),
    description: text("description").notNull(),
    isPopular: boolean("is_popular").notNull().default(false),
    isCustom: boolean("is_custom").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(100),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("llm_models_provider_idx").on(table.providerId),
    index("llm_models_category_idx").on(table.category),
  ]
);

export const apiKeys = pgTable(
  "api_keys",
  {
    id: serial("id").primaryKey(),
    providerId: text("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    encryptedKey: text("encrypted_key").notNull(),
    maskedKey: text("masked_key").notNull(),
    envVarOverride: text("env_var_override"),
    baseUrlOverride: text("base_url_override"),
    environment: text("environment").notNull().default("test"),
    scopeMode: text("scope_mode").notNull().default("all_provider"),
    isFavorite: boolean("is_favorite").notNull().default(false),
    isDefault: boolean("is_default").notNull().default(false),
    notes: text("notes"),
    lastStatus: text("last_status").notNull().default("untested"),
    lastStatusMessage: text("last_status_message"),
    lastVerifiedAt: timestamp("last_verified_at"),
    copyCount: integer("copy_count").notNull().default(0),
    lastAccessedAt: timestamp("last_accessed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("api_keys_provider_idx").on(table.providerId),
    index("api_keys_env_idx").on(table.environment),
  ]
);

export const keyModelLinks = pgTable(
  "key_model_links",
  {
    id: serial("id").primaryKey(),
    apiKeyId: integer("api_key_id")
      .notNull()
      .references(() => apiKeys.id, { onDelete: "cascade" }),
    modelId: text("model_id")
      .notNull()
      .references(() => llmModels.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("key_model_links_unique_idx").on(table.apiKeyId, table.modelId),
    index("key_model_links_model_idx").on(table.modelId),
  ]
);

export const appMeta = pgTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type ProviderRow = typeof providers.$inferSelect;
export type NewProviderRow = typeof providers.$inferInsert;
export type LlmModelRow = typeof llmModels.$inferSelect;
export type NewLlmModelRow = typeof llmModels.$inferInsert;
export type ApiKeyRow = typeof apiKeys.$inferSelect;
export type NewApiKeyRow = typeof apiKeys.$inferInsert;
export type KeyModelLinkRow = typeof keyModelLinks.$inferSelect;
