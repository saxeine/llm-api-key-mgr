"use client";

import {
  Activity,
  ArrowRight,
  Check,
  Code2,
  Copy,
  Eye,
  EyeOff,
  FileCode,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import type { ApiKeyDTO, LlmModelDTO, ProviderDTO } from "@/lib/types";
import { ENV_BADGE_STYLES, formatRelativeTime } from "@/lib/ui";
import { ProviderIcon } from "./ProviderIcon";

interface KeysVaultViewProps {
  providers: ProviderDTO[];
  models: LlmModelDTO[];
  keys: ApiKeyDTO[];
  selectedProviderId: string;
  searchQuery: string;
  revealedMap: Record<number, string>;
  revealAll: boolean;
  loadingRevealAll: boolean;
  onToggleRevealAll: () => void;
  onToggleRevealOne: (keyId: number) => Promise<void>;
  onCopyKey: (key: ApiKeyDTO, asEnvLine?: boolean) => Promise<void>;
  copiedSignal: string | null;
  onToggleFavorite: (key: ApiKeyDTO) => Promise<void>;
  onEditKey: (key: ApiKeyDTO) => void;
  onDeleteKey: (key: ApiKeyDTO) => Promise<void>;
  onVerifyKey: (keyId: number) => Promise<void>;
  verifyingId: number | null;
  onOpenSnippet: (opts: { model?: LlmModelDTO | null; key?: ApiKeyDTO | null }) => void;
  onAddKeyForProvider: (providerId?: string) => void;
  onAddKeyForModel: (model: LlmModelDTO) => void;
  onSwitchToModels: () => void;
}

const ENV_FILTERS = [
  { id: "all", label: "All Keys" },
  { id: "favorites", label: "Pinned" },
  { id: "test", label: "Test" },
  { id: "dev", label: "Dev" },
  { id: "staging", label: "Staging" },
  { id: "sandbox", label: "Sandbox" },
] as const;

export function KeysVaultView({
  providers,
  models,
  keys,
  selectedProviderId,
  searchQuery,
  revealedMap,
  revealAll,
  loadingRevealAll,
  onToggleRevealAll,
  onToggleRevealOne,
  onCopyKey,
  copiedSignal,
  onToggleFavorite,
  onEditKey,
  onDeleteKey,
  onVerifyKey,
  verifyingId,
  onOpenSnippet,
  onAddKeyForProvider,
  onAddKeyForModel,
  onSwitchToModels,
}: KeysVaultViewProps) {
  const [envFilter, setEnvFilter] = useState<string>("all");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [revealingOneId, setRevealingOneId] = useState<number | null>(null);

  const providerMap = useMemo(
    () => new Map(providers.map((p) => [p.id, p])),
    [providers]
  );

  const modelsByProvider = useMemo(() => {
    const map = new Map<string, LlmModelDTO[]>();
    for (const m of models) {
      const list = map.get(m.providerId) ?? [];
      list.push(m);
      map.set(m.providerId, list);
    }
    return map;
  }, [models]);

  const modelMap = useMemo(
    () => new Map(models.map((m) => [m.id, m])),
    [models]
  );

  const filteredKeys = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return keys.filter((k) => {
      if (selectedProviderId !== "all" && k.providerId !== selectedProviderId) {
        return false;
      }
      if (envFilter === "favorites" && !k.isFavorite) return false;
      if (
        envFilter !== "all" &&
        envFilter !== "favorites" &&
        k.environment !== envFilter
      ) {
        return false;
      }
      if (!q) return true;

      const prov = providerMap.get(k.providerId);
      const applicableModels =
        k.scopeMode === "all_provider"
          ? modelsByProvider.get(k.providerId) ?? []
          : k.linkedModelIds
              .map((id) => modelMap.get(id))
              .filter((m): m is LlmModelDTO => Boolean(m));

      return (
        k.label.toLowerCase().includes(q) ||
        k.effectiveEnvVar.toLowerCase().includes(q) ||
        k.environment.toLowerCase().includes(q) ||
        (k.notes?.toLowerCase().includes(q) ?? false) ||
        (prov?.name.toLowerCase().includes(q) ?? false) ||
        applicableModels.some(
          (m) =>
            m.name.toLowerCase().includes(q) ||
            m.apiModelId.toLowerCase().includes(q)
        )
      );
    });
  }, [
    keys,
    selectedProviderId,
    envFilter,
    searchQuery,
    providerMap,
    modelsByProvider,
    modelMap,
  ]);

  // Popular or search-matching models without a key yet for instant 1-click onboarding
  const uncoveredPopularModels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = models.filter((m) => {
      if (selectedProviderId !== "all" && m.providerId !== selectedProviderId) {
        return false;
      }
      const hasKey = keys.some(
        (k) =>
          (k.providerId === m.providerId && k.scopeMode === "all_provider") ||
          k.linkedModelIds.includes(m.id)
      );
      if (hasKey) return false;
      if (q) {
        const prov = providerMap.get(m.providerId);
        return (
          m.name.toLowerCase().includes(q) ||
          m.apiModelId.toLowerCase().includes(q) ||
          (prov?.name.toLowerCase().includes(q) ?? false) ||
          (prov?.envVar.toLowerCase().includes(q) ?? false)
        );
      }
      return m.isPopular || selectedProviderId !== "all";
    });
    return filtered.slice(0, 9);
  }, [models, keys, selectedProviderId, searchQuery, providerMap]);

  const statusIndicator = (status: ApiKeyDTO["lastStatus"]) => {
    switch (status) {
      case "valid":
        return {
          dot: "bg-emerald-500",
          label: "Verified live",
          text: "text-emerald-700",
        };
      case "invalid":
        return {
          dot: "bg-rose-500",
          label: "Auth failed",
          text: "text-rose-600",
        };
      case "format_ok":
        return {
          dot: "bg-emerald-500",
          label: "Ready",
          text: "text-zinc-600",
        };
      default:
        return {
          dot: "bg-zinc-400",
          label: "Stored",
          text: "text-zinc-500",
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter & Reveal Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {ENV_FILTERS.map((f) => {
            const active = envFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setEnvFilter(f.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? "bg-zinc-900 text-white shadow-2xs"
                    : "border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {keys.length > 0 && (
          <button
            type="button"
            onClick={onToggleRevealAll}
            disabled={loadingRevealAll}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              revealAll
                ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
            }`}
          >
            {loadingRevealAll ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : revealAll ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
            {revealAll ? "Mask All Keys" : "Reveal All Keys"}
          </button>
        )}
      </div>

      {/* Stored Keys Cards */}
      {filteredKeys.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <KeyRound className="h-5 w-5" />
          </div>
          <h3 className="mt-3.5 text-sm font-semibold text-zinc-950">
            {selectedProviderId !== "all"
              ? `No ${providerMap.get(selectedProviderId)?.name ?? ""} keys stored yet`
              : searchQuery || envFilter !== "all"
                ? "No keys match your current filter"
                : "Your test key vault is empty"}
          </h3>
          <p className="mx-auto mt-1 max-w-md text-xs text-zinc-500">
            Store an LLM API key once to copy it in one click, wire it to specific models,
            or export ready-to-use <code className="font-mono">.env</code> files for your test platforms.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() =>
                onAddKeyForProvider(
                  selectedProviderId !== "all" ? selectedProviderId : undefined
                )
              }
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Add{" "}
              {selectedProviderId !== "all"
                ? providerMap.get(selectedProviderId)?.name
                : "API"}{" "}
              Key
            </button>
            <button
              type="button"
              onClick={onSwitchToModels}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Browse {models.length} Major Models
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredKeys.map((key) => {
            const prov = providerMap.get(key.providerId);
            const provModels = modelsByProvider.get(key.providerId) ?? [];
            const linkedModels =
              key.scopeMode === "selected_models"
                ? key.linkedModelIds
                    .map((id) => modelMap.get(id))
                    .filter((m): m is LlmModelDTO => Boolean(m))
                : provModels;

            const previewModels = linkedModels.slice(0, 4);
            const extraCount = Math.max(0, linkedModels.length - previewModels.length);

            const plainKey =
              revealAll
                ? key.rawKey || revealedMap[key.id]
                : revealedMap[key.id];
            const isRevealed = Boolean(plainKey);
            const status = statusIndicator(key.lastStatus);

            const keyCopied = copiedSignal === `key-${key.id}`;
            const envCopied = copiedSignal === `env-${key.id}`;

            return (
              <article
                key={key.id}
                className="group rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition hover:border-zinc-300 sm:p-5"
              >
                {/* Top Header Row */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <ProviderIcon providerId={key.providerId} size="md" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-semibold text-zinc-950">
                          {key.label}
                        </h3>
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                            ENV_BADGE_STYLES[key.environment] ?? ENV_BADGE_STYLES.test
                          }`}
                        >
                          {key.environment}
                        </span>
                        {key.isDefault && (
                          <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">
                            default
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-zinc-500">
                        <span className="font-medium text-zinc-700">
                          {prov?.name ?? key.providerId}
                        </span>
                        <span className="text-zinc-300">·</span>
                        <span className={`inline-flex items-center gap-1.5 ${status.text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                          {status.label}
                        </span>
                        {key.copyCount > 0 && (
                          <>
                            <span className="text-zinc-300">·</span>
                            <span className="tabular-nums text-zinc-400">
                              Copied {key.copyCount}× ({formatRelativeTime(key.lastAccessedAt)})
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Utility Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onToggleFavorite(key)}
                      aria-label={key.isFavorite ? "Unpin key" : "Pin key"}
                      title={key.isFavorite ? "Pinned" : "Pin to top"}
                      className={`rounded-lg p-1.5 transition ${
                        key.isFavorite
                          ? "text-amber-500 hover:bg-amber-50"
                          : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                      }`}
                    >
                      <Star
                        className={`h-4 w-4 ${key.isFavorite ? "fill-amber-400" : ""}`}
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenSnippet({ key })}
                      title="Code snippets (cURL, TypeScript, Python)"
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950"
                    >
                      <Code2 className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Snippet</span>
                    </button>

                    <button
                      type="button"
                      disabled={verifyingId === key.id}
                      onClick={() => onVerifyKey(key.id)}
                      title="Verify key against provider endpoint"
                      className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-indigo-600 disabled:opacity-50"
                    >
                      {verifyingId === key.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                      ) : (
                        <Activity className="h-4 w-4" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => onEditKey(key)}
                      aria-label={`Edit ${key.label}`}
                      title="Edit key & models"
                      className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-800"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>

                    {confirmDeleteId === key.id ? (
                      <div className="ml-1 inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1">
                        <button
                          type="button"
                          disabled={deletingId === key.id}
                          onClick={async () => {
                            setDeletingId(key.id);
                            await onDeleteKey(key);
                            setDeletingId(null);
                            setConfirmDeleteId(null);
                          }}
                          className="text-xs font-semibold text-rose-700 hover:text-rose-800"
                        >
                          {deletingId === key.id ? "..." : "Delete"}
                        </button>
                        <span className="text-rose-300">|</span>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-xs text-zinc-600 hover:text-zinc-900"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(key.id)}
                        aria-label={`Delete ${key.label}`}
                        title="Delete key"
                        className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Monospace Key Re-access Bar */}
                <div className="mt-3.5 flex flex-col gap-2 rounded-xl border border-zinc-200/90 bg-zinc-50/90 p-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden px-1">
                    <span className="shrink-0 rounded bg-white px-2 py-0.5 font-mono text-[11px] font-medium text-zinc-600 ring-1 ring-zinc-200/90">
                      {key.effectiveEnvVar}
                    </span>
                    <code
                      className={`truncate font-mono text-xs select-all ${
                        isRevealed ? "font-medium text-zinc-950" : "text-zinc-600"
                      }`}
                    >
                      {isRevealed ? plainKey : key.maskedKey}
                    </code>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {!revealAll && (
                      <button
                        type="button"
                        disabled={revealingOneId === key.id}
                        onClick={async () => {
                          setRevealingOneId(key.id);
                          await onToggleRevealOne(key.id);
                          setRevealingOneId(null);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100"
                      >
                        {revealingOneId === key.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : isRevealed ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                        {isRevealed ? "Hide" : "Reveal"}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onCopyKey(key, true)}
                      title={`Copy ${key.effectiveEnvVar}="..."`}
                      className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100"
                    >
                      {envCopied ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="text-emerald-700">.env Copied</span>
                        </>
                      ) : (
                        <>
                          <FileCode className="h-3.5 w-3.5 text-zinc-500" />
                          .env
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => onCopyKey(key, false)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-2xs transition ${
                        keyCopied
                          ? "bg-emerald-600 text-white"
                          : "bg-zinc-950 text-white hover:bg-zinc-800"
                      }`}
                    >
                      {keyCopied ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Copy Key
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Linked Models & Notes Footer */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-medium text-zinc-400">
                      {key.scopeMode === "all_provider" ? "Models:" : "Scoped to:"}
                    </span>
                    {previewModels.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => onOpenSnippet({ model: m, key })}
                        title={`Open snippet for ${m.name} (${m.apiModelId})`}
                        className="inline-flex items-center rounded-md border border-zinc-200/80 bg-zinc-50 px-2 py-0.5 font-mono text-[11px] text-zinc-700 transition hover:border-indigo-200 hover:bg-indigo-50/70 hover:text-indigo-700"
                      >
                        {m.apiModelId}
                      </button>
                    ))}
                    {extraCount > 0 && (
                      <button
                        type="button"
                        onClick={() => onOpenSnippet({ key })}
                        className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500 hover:text-zinc-800"
                      >
                        +{extraCount} more
                      </button>
                    )}
                  </div>

                  {key.notes && (
                    <p className="max-w-sm truncate text-xs text-zinc-400" title={key.notes}>
                      {key.notes}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Quick-Add Major Models Without Keys Yet */}
      {uncoveredPopularModels.length > 0 && (
        <section className="pt-3">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">
                Quick-Add Keys to Major Models
              </h2>
              <p className="text-xs text-zinc-500">
                Click any popular model below to attach a test API key right away
              </p>
            </div>
            <button
              type="button"
              onClick={onSwitchToModels}
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
            >
              See all {models.length} models
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {uncoveredPopularModels.map((model) => {
              const prov = providerMap.get(model.providerId);
              return (
                <div
                  key={model.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-3.5 transition hover:border-indigo-200 hover:shadow-2xs"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <ProviderIcon providerId={model.providerId} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-zinc-900">
                        {model.name}
                      </p>
                      <p className="truncate font-mono text-[11px] text-zinc-500">
                        {prov?.name} · {model.contextWindow}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onAddKeyForModel(model)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50/70 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-600 hover:text-white"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Key
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
