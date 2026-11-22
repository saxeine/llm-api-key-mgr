"use client";

import {
  Check,
  Code2,
  Copy,
  ExternalLink,
  LayoutGrid,
  Layers,
  Plus,
  Trash2,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import { CATEGORY_LABELS } from "@/lib/catalog";
import type { ApiKeyDTO, LlmModelDTO, ProviderDTO } from "@/lib/types";
import { CATEGORY_BADGE_STYLES, copyTextToClipboard } from "@/lib/ui";
import { ProviderIcon } from "./ProviderIcon";

interface ModelsViewProps {
  providers: ProviderDTO[];
  models: LlmModelDTO[];
  keys: ApiKeyDTO[];
  selectedProviderId: string;
  searchQuery: string;
  copiedSignal: string | null;
  onCopyKey: (key: ApiKeyDTO, asEnvLine?: boolean) => Promise<void>;
  onAddKeyForModel: (model: LlmModelDTO) => void;
  onAddKeyForProvider: (providerId: string) => void;
  onOpenSnippet: (opts: { model?: LlmModelDTO | null; key?: ApiKeyDTO | null }) => void;
  onOpenCustomModel: () => void;
  onDeleteCustomModel: (model: LlmModelDTO) => Promise<void>;
}

const CATEGORY_FILTERS = [
  { id: "all", label: "All Models" },
  { id: "flagship", label: "Flagship" },
  { id: "reasoning", label: "Reasoning" },
  { id: "fast", label: "Fast & Budget" },
  { id: "coding", label: "Coding" },
  { id: "open-weights", label: "Open Weights" },
  { id: "search", label: "Web Search" },
  { id: "router", label: "Router" },
] as const;

export function ModelsView({
  providers,
  models,
  keys,
  selectedProviderId,
  searchQuery,
  copiedSignal,
  onCopyKey,
  onAddKeyForModel,
  onAddKeyForProvider,
  onOpenSnippet,
  onOpenCustomModel,
  onDeleteCustomModel,
}: ModelsViewProps) {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [coverageFilter, setCoverageFilter] = useState<"all" | "ready" | "missing">("all");
  const [layoutMode, setLayoutMode] = useState<"grouped" | "grid">("grouped");
  const [copiedModelId, setCopiedModelId] = useState<string | null>(null);

  const providerMap = useMemo(
    () => new Map(providers.map((p) => [p.id, p])),
    [providers]
  );

  // Map every model ID to the list of API keys attached to it
  const keysByModel = useMemo(() => {
    const map = new Map<string, ApiKeyDTO[]>();
    for (const model of models) {
      const matched = keys.filter(
        (k) =>
          (k.providerId === model.providerId && k.scopeMode === "all_provider") ||
          k.linkedModelIds.includes(model.id)
      );
      matched.sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
      map.set(model.id, matched);
    }
    return map;
  }, [models, keys]);

  const filteredModels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return models.filter((m) => {
      if (selectedProviderId !== "all" && m.providerId !== selectedProviderId) {
        return false;
      }
      if (categoryFilter !== "all" && m.category !== categoryFilter) {
        return false;
      }
      const attached = keysByModel.get(m.id) ?? [];
      if (coverageFilter === "ready" && attached.length === 0) return false;
      if (coverageFilter === "missing" && attached.length > 0) return false;

      if (!q) return true;
      const prov = providerMap.get(m.providerId);
      return (
        m.name.toLowerCase().includes(q) ||
        m.apiModelId.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.modalities.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        (prov?.name.toLowerCase().includes(q) ?? false) ||
        (prov?.envVar.toLowerCase().includes(q) ?? false)
      );
    });
  }, [
    models,
    selectedProviderId,
    categoryFilter,
    coverageFilter,
    searchQuery,
    keysByModel,
    providerMap,
  ]);

  const groupedSections = useMemo(() => {
    const map = new Map<string, LlmModelDTO[]>();
    for (const m of filteredModels) {
      const arr = map.get(m.providerId) ?? [];
      arr.push(m);
      map.set(m.providerId, arr);
    }
    return providers
      .filter((p) => map.has(p.id))
      .map((p) => ({
        provider: p,
        models: map.get(p.id) ?? [],
        providerKeyCount: keys.filter((k) => k.providerId === p.id).length,
      }));
  }, [filteredModels, providers, keys]);

  const handleCopyModelId = async (model: LlmModelDTO) => {
    await copyTextToClipboard(model.apiModelId);
    setCopiedModelId(model.id);
    setTimeout(() => {
      setCopiedModelId((prev) => (prev === model.id ? null : prev));
    }, 1600);
  };

  const renderModelCard = (model: LlmModelDTO, showProviderName: boolean) => {
    const prov = providerMap.get(model.providerId);
    const attachedKeys = keysByModel.get(model.id) ?? [];
    const primaryKey = attachedKeys[0] ?? null;
    const isIdCopied = copiedModelId === model.id;
    const isKeyCopied = primaryKey ? copiedSignal === `key-${primaryKey.id}` : false;

    return (
      <article
        key={model.id}
        className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.025)] transition hover:border-zinc-300"
      >
        <div>
          {/* Card Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              {showProviderName && (
                <ProviderIcon providerId={model.providerId} size="sm" />
              )}
              <div className="min-w-0">
                <h4 className="truncate text-sm font-semibold text-zinc-950">
                  {model.name}
                </h4>
                {showProviderName && prov && (
                  <p className="text-[11px] text-zinc-500">{prov.name}</p>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <span
                className={`rounded-md border px-2 py-0.5 text-[10px] font-medium ${
                  CATEGORY_BADGE_STYLES[model.category] ?? CATEGORY_BADGE_STYLES.flagship
                }`}
              >
                {CATEGORY_LABELS[model.category] ?? model.category}
              </span>
              {model.isCustom && (
                <button
                  type="button"
                  onClick={() => onDeleteCustomModel(model)}
                  aria-label={`Remove ${model.name}`}
                  title="Delete custom model"
                  className="rounded p-1 text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Click-to-copy API Model ID */}
          <div className="mt-2.5">
            <button
              type="button"
              onClick={() => handleCopyModelId(model)}
              title="Click to copy API model string"
              className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-zinc-200/90 bg-zinc-50 px-2.5 py-1 font-mono text-[11px] text-zinc-700 transition hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-700"
            >
              <span className="truncate">{model.apiModelId}</span>
              {isIdCopied ? (
                <Check className="h-3 w-3 shrink-0 text-emerald-600" />
              ) : (
                <Copy className="h-3 w-3 shrink-0 opacity-55" />
              )}
            </button>
          </div>

          {/* Description */}
          <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-zinc-500">
            {model.description}
          </p>

          {/* Compact Specs Row */}
          <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-zinc-500 tabular-nums">
            <span>
              <strong className="font-medium text-zinc-700">{model.contextWindow}</strong> ctx
            </span>
            <span className="text-zinc-300">·</span>
            <span>
              <strong className="font-medium text-zinc-700">{model.maxOutput}</strong> out
            </span>
            {model.inputPrice !== "—" && model.inputPrice !== "Custom" && (
              <>
                <span className="text-zinc-300">·</span>
                <span>{model.inputPrice} in</span>
              </>
            )}
          </div>
        </div>

        {/* Key Attachment & Instant Re-access Footer */}
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-zinc-100 pt-3">
          {primaryKey ? (
            <>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                  <span className="truncate text-xs font-medium text-zinc-800">
                    {primaryKey.label}
                  </span>
                  {attachedKeys.length > 1 && (
                    <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                      +{attachedKeys.length - 1}
                    </span>
                  )}
                </div>
                <p className="truncate pl-3 font-mono text-[11px] text-zinc-400">
                  {primaryKey.maskedKey}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => onCopyKey(primaryKey, false)}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                    isKeyCopied
                      ? "bg-emerald-600 text-white"
                      : "bg-zinc-900 text-white hover:bg-zinc-800"
                  }`}
                >
                  {isKeyCopied ? (
                    <>
                      <Check className="h-3 w-3" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      Key
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenSnippet({ model, key: primaryKey })}
                  title="View ready-to-run snippet"
                  className="rounded-lg border border-zinc-200 bg-white p-1.5 text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-950"
                >
                  <Code2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onAddKeyForModel(model)}
                  title={`Add another key for ${model.name}`}
                  className="rounded-lg border border-zinc-200 bg-white p-1.5 text-zinc-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
                No key yet
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onOpenSnippet({ model, key: null })}
                  title="Preview API template"
                  className="rounded-lg border border-zinc-200 bg-white p-1.5 text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-800"
                >
                  <Code2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onAddKeyForModel(model)}
                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-indigo-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Key
                </button>
              </div>
            </>
          )}
        </div>
      </article>
    );
  };

  return (
    <div className="space-y-5">
      {/* Filter Controls */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {CATEGORY_FILTERS.map((cat) => {
            const active = categoryFilter === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(cat.id)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                  active
                    ? "bg-zinc-900 text-white shadow-2xs"
                    : "border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-950"
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Coverage Filter */}
          <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5 text-xs">
            {(
              [
                { id: "all", label: "All" },
                { id: "ready", label: "Has Key" },
                { id: "missing", label: "Needs Key" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setCoverageFilter(opt.id)}
                className={`rounded-md px-2.5 py-1 font-medium transition ${
                  coverageFilter === opt.id
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Layout Mode */}
          <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5">
            <button
              type="button"
              onClick={() => setLayoutMode("grouped")}
              title="Group by provider"
              className={`rounded-md p-1.5 transition ${
                layoutMode === "grouped"
                  ? "bg-zinc-100 text-zinc-950"
                  : "text-zinc-400 hover:text-zinc-700"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode("grid")}
              title="Flat model grid"
              className={`rounded-md p-1.5 transition ${
                layoutMode === "grid"
                  ? "bg-zinc-100 text-zinc-950"
                  : "text-zinc-400 hover:text-zinc-700"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Add Custom Model */}
          <button
            type="button"
            onClick={onOpenCustomModel}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Custom Model
          </button>
        </div>
      </div>

      {/* Directory Content */}
      {filteredModels.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center">
          <p className="text-sm font-semibold text-zinc-900">
            No models match your filters
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Clear your search or add a custom model ID to track any endpoint.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCategoryFilter("all");
                setCoverageFilter("all");
              }}
              className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Reset Filters
            </button>
            <button
              type="button"
              onClick={onOpenCustomModel}
              className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Custom Model
            </button>
          </div>
        </div>
      ) : layoutMode === "grid" ? (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
          {filteredModels.map((m) => renderModelCard(m, true))}
        </div>
      ) : (
        <div className="space-y-8">
          {groupedSections.map(({ provider, models: sectionModels, providerKeyCount }) => (
            <section key={provider.id} className="space-y-3">
              {/* Provider Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200/80 pb-2.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <ProviderIcon providerId={provider.id} size="md" />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-zinc-950">
                        {provider.name}
                      </h3>
                      <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-600">
                        {provider.envVar}
                      </code>
                      {providerKeyCount > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          {providerKeyCount} key{providerKeyCount === 1 ? "" : "s"} stored
                        </span>
                      ) : (
                        <span className="text-[11px] text-zinc-400">
                          {sectionModels.length} model{sectionModels.length === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={provider.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
                  >
                    Console
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => onAddKeyForProvider(provider.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-800 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add {provider.name} Key
                  </button>
                </div>
              </div>

              {/* Models Grid */}
              <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
                {sectionModels.map((m) => renderModelCard(m, false))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
