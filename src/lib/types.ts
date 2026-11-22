export type KeyEnvironment = "test" | "dev" | "staging" | "sandbox";
export type KeyScopeMode = "all_provider" | "selected_models";
export type KeyStatus = "untested" | "valid" | "invalid" | "format_ok" | "network_error";
export type ModelCategory =
  | "flagship"
  | "reasoning"
  | "fast"
  | "coding"
  | "open-weights"
  | "search"
  | "router";

export interface ProviderDTO {
  id: string;
  name: string;
  envVar: string;
  envAliases: string[];
  baseUrl: string;
  keyPrefix: string;
  docsUrl: string;
  authStyle: string;
  accentColor: string;
  isGateway: boolean;
  sortOrder: number;
}

export interface LlmModelDTO {
  id: string;
  providerId: string;
  name: string;
  apiModelId: string;
  category: string;
  contextWindow: string;
  maxOutput: string;
  modalities: string;
  inputPrice: string;
  outputPrice: string;
  description: string;
  isPopular: boolean;
  isCustom: boolean;
  sortOrder: number;
}

export interface ApiKeyDTO {
  id: number;
  providerId: string;
  label: string;
  maskedKey: string;
  rawKey?: string;
  effectiveEnvVar: string;
  envVarOverride: string | null;
  effectiveBaseUrl: string;
  baseUrlOverride: string | null;
  environment: KeyEnvironment;
  scopeMode: KeyScopeMode;
  linkedModelIds: string[];
  isFavorite: boolean;
  isDefault: boolean;
  notes: string | null;
  lastStatus: KeyStatus;
  lastStatusMessage: string | null;
  lastVerifiedAt: string | null;
  copyCount: number;
  lastAccessedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspacePayload {
  providers: ProviderDTO[];
  models: LlmModelDTO[];
  keys: ApiKeyDTO[];
  stats: {
    totalKeys: number;
    totalProviders: number;
    coveredProviders: number;
    totalModels: number;
    coveredModels: number;
    totalCopies: number;
  };
}
