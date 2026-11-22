"use client";

import {
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Link2,
  Loader2,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { ENVIRONMENT_OPTIONS } from "@/lib/catalog";
import type {
  ApiKeyDTO,
  KeyEnvironment,
  KeyScopeMode,
  LlmModelDTO,
  ProviderDTO,
} from "@/lib/types";
import { ProviderIcon } from "./ProviderIcon";

interface KeyModalProps {
  open: boolean;
  onClose: () => void;
  providers: ProviderDTO[];
  models: LlmModelDTO[];
  existingKeys: ApiKeyDTO[];
  editingKey: ApiKeyDTO | null;
  initialProviderId?: string | null;
  targetModel?: LlmModelDTO | null;
  onSaved: (message: string) => Promise<void>;
}

function detectClientProvider(rawKey: string): string | null {
  const k = rawKey.trim();
  if (!k) return null;
  if (k.startsWith("sk-ant-")) return "anthropic";
  if (k.startsWith("sk-or-")) return "openrouter";
  if (k.startsWith("sk-proj-") || k.startsWith("sk-svcacct-")) return "openai";
  if (k.startsWith("AIza")) return "google";
  if (k.startsWith("xai-")) return "xai";
  if (k.startsWith("gsk_")) return "groq";
  if (k.startsWith("pplx-")) return "perplexity";
  if (k.startsWith("fw_")) return "fireworks";
  if (k.startsWith("tgp_v1_")) return "together";
  return null;
}

export function KeyModal({
  open,
  onClose,
  providers,
  models,
  existingKeys,
  editingKey,
  initialProviderId,
  targetModel,
  onSaved,
}: KeyModalProps) {
  const [mode, setMode] = useState<"create" | "attach">("create");
  const [providerId, setProviderId] = useState<string>("openai");
  const [label, setLabel] = useState("");
  const [labelTouched, setLabelTouched] = useState(false);
  const [rawKey, setRawKey] = useState("");
  const [showKey, setShowKey] = useState(true);
  const [loadingRawKey, setLoadingRawKey] = useState(false);
  const [environment, setEnvironment] = useState<KeyEnvironment>("test");
  const [scopeMode, setScopeMode] = useState<KeyScopeMode>("all_provider");
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isDefault, setIsDefault] = useState(true);
  const [notes, setNotes] = useState("");
  const [envVarOverride, setEnvVarOverride] = useState("");
  const [baseUrlOverride, setBaseUrlOverride] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [detectedHint, setDetectedHint] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [linkingKeyId, setLinkingKeyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedProvider = useMemo(
    () => providers.find((p) => p.id === providerId) ?? providers[0],
    [providers, providerId]
  );

  const providerModels = useMemo(
    () => models.filter((m) => m.providerId === providerId),
    [models, providerId]
  );

  // Keys eligible for 1-click attachment when opened from a specific model card
  const attachableKeys = useMemo(() => {
    if (!targetModel || editingKey) return [];
    return existingKeys.filter(
      (k) =>
        k.providerId === targetModel.providerId || k.providerId === "openrouter"
    );
  }, [targetModel, editingKey, existingKeys]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setDetectedHint(null);
    setMode("create");

    if (editingKey) {
      setProviderId(editingKey.providerId);
      setLabel(editingKey.label);
      setLabelTouched(true);
      setRawKey(editingKey.rawKey ?? "");
      setShowKey(false);
      setEnvironment(editingKey.environment);
      setScopeMode(editingKey.scopeMode);
      setSelectedModelIds(editingKey.linkedModelIds);
      setIsFavorite(editingKey.isFavorite);
      setIsDefault(editingKey.isDefault);
      setNotes(editingKey.notes ?? "");
      setEnvVarOverride(editingKey.envVarOverride ?? "");
      setBaseUrlOverride(editingKey.baseUrlOverride ?? "");
      setShowAdvanced(Boolean(editingKey.envVarOverride || editingKey.baseUrlOverride));

      if (!editingKey.rawKey) {
        setLoadingRawKey(true);
        fetch(`/api/keys/${editingKey.id}`)
          .then((r) => r.json())
          .then((data) => {
            if (data?.key?.rawKey) {
              setRawKey(data.key.rawKey);
            }
          })
          .catch(() => {})
          .finally(() => setLoadingRawKey(false));
      }
    } else {
      const startProvider =
        targetModel?.providerId ||
        initialProviderId ||
        providers[0]?.id ||
        "openai";
      const prov = providers.find((p) => p.id === startProvider);
      setProviderId(startProvider);
      setLabel(
        targetModel
          ? `${targetModel.name} Test Key`
          : `${prov?.name ?? "LLM"} Test Key`
      );
      setLabelTouched(false);
      setRawKey("");
      setShowKey(true);
      setLoadingRawKey(false);
      setEnvironment("test");
      setScopeMode("all_provider");
      setSelectedModelIds(targetModel ? [targetModel.id] : []);
      setIsFavorite(false);
      setIsDefault(true);
      setNotes("");
      setEnvVarOverride("");
      setBaseUrlOverride("");
      setShowAdvanced(false);
    }
  }, [open, editingKey, initialProviderId, targetModel, providers]);

  if (!open || !selectedProvider) return null;

  const handleProviderChange = (nextId: string) => {
    setProviderId(nextId);
    setDetectedHint(null);
    const nextProv = providers.find((p) => p.id === nextId);
    if (!labelTouched && !editingKey && nextProv) {
      setLabel(`${nextProv.name} Test Key`);
    }
    // Keep only models belonging to the new provider
    const allowed = new Set(
      models.filter((m) => m.providerId === nextId).map((m) => m.id)
    );
    setSelectedModelIds((prev) => prev.filter((id) => allowed.has(id)));
  };

  const handleRawKeyChange = (val: string) => {
    setRawKey(val);
    const detected = detectClientProvider(val);
    if (detected && detected !== providerId && !targetModel && !editingKey) {
      const matched = providers.find((p) => p.id === detected);
      if (matched) {
        setProviderId(detected);
        if (!labelTouched) {
          setLabel(`${matched.name} Test Key`);
        }
        setDetectedHint(`Auto-matched ${matched.name} from key prefix`);
      }
    } else if (detected && detected !== providerId) {
      const matched = providers.find((p) => p.id === detected);
      if (matched) {
        setDetectedHint(`Looks like a ${matched.name} key`);
      }
    } else {
      setDetectedHint(null);
    }
  };

  const toggleModelSelection = (modelId: string) => {
    setSelectedModelIds((prev) =>
      prev.includes(modelId)
        ? prev.filter((id) => id !== modelId)
        : [...prev, modelId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedKey = rawKey.trim();
    const trimmedLabel =
      label.trim() || `${selectedProvider.name} Test Key`;

    if (!trimmedKey) {
      setError("Paste an API key to store.");
      return;
    }

    if (scopeMode === "selected_models" && selectedModelIds.length === 0) {
      setError("Select at least one model, or choose All Provider Models.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        providerId,
        label: trimmedLabel,
        rawKey: trimmedKey,
        environment,
        scopeMode,
        modelIds: selectedModelIds,
        envVarOverride: envVarOverride.trim().toUpperCase() || null,
        baseUrlOverride: baseUrlOverride.trim() || null,
        notes: notes.trim() || null,
        isFavorite,
        isDefault,
      };

      const res = await fetch(
        editingKey ? `/api/keys/${editingKey.id}` : "/api/keys",
        {
          method: editingKey ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Failed to save key.");
        setSubmitting(false);
        return;
      }

      await onSaved(
        editingKey
          ? `Updated "${trimmedLabel}"`
          : targetModel
            ? `Saved key and connected to ${targetModel.name}`
            : `Stored "${trimmedLabel}" in vault`
      );
      onClose();
    } catch {
      setError("Network error while saving key.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleAttachExisting = async (key: ApiKeyDTO, currentlyCovered: boolean) => {
    if (!targetModel) return;
    setLinkingKeyId(key.id);
    setError(null);
    try {
      const res = await fetch(`/api/models/${targetModel.id}/link-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKeyId: key.id,
          linked: !currentlyCovered,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Failed to update model link.");
        return;
      }
      await onSaved(
        !currentlyCovered
          ? `Linked "${key.label}" to ${targetModel.name}`
          : `Unlinked "${key.label}" from ${targetModel.name}`
      );
    } catch {
      setError("Failed to update model link.");
    } finally {
      setLinkingKeyId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/35 p-4 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="key-modal-title"
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <ProviderIcon providerId={selectedProvider.id} size="md" />
            <div>
              <h2 id="key-modal-title" className="text-base font-semibold text-zinc-950">
                {editingKey
                  ? "Edit Stored API Key"
                  : targetModel
                    ? `Add Key for ${targetModel.name}`
                    : "Store LLM API Key"}
              </h2>
              <p className="text-xs text-zinc-500">
                {editingKey
                  ? `Update key value, environment, or linked ${selectedProvider.name} models`
                  : "Instant 1-click retrieval & .env export for your test platforms"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Target Model Context Bar */}
        {targetModel && !editingKey && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 bg-zinc-50/80 px-6 py-2.5">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium text-zinc-700">Model ID:</span>
              <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-indigo-700 ring-1 ring-zinc-200">
                {targetModel.apiModelId}
              </code>
            </div>
            <a
              href={selectedProvider.docsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
            >
              Get {selectedProvider.name} key
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        {/* Switch between Store New Key & Attach Existing Key */}
        {targetModel && !editingKey && attachableKeys.length > 0 && (
          <div className="border-b border-zinc-100 px-6 py-2.5">
            <div className="grid grid-cols-2 rounded-lg bg-zinc-100 p-1 text-xs font-medium">
              <button
                type="button"
                onClick={() => setMode("create")}
                className={`inline-flex items-center justify-center gap-1.5 rounded-md py-1.5 transition ${
                  mode === "create"
                    ? "bg-white text-zinc-950 shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                <KeyRound className="h-3.5 w-3.5" />
                Store New Key
              </button>
              <button
                type="button"
                onClick={() => setMode("attach")}
                className={`inline-flex items-center justify-center gap-1.5 rounded-md py-1.5 transition ${
                  mode === "attach"
                    ? "bg-white text-zinc-950 shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                <Link2 className="h-3.5 w-3.5" />
                Use Existing Key ({attachableKeys.length})
              </button>
            </div>
          </div>
        )}

        {/* Body */}
        {mode === "attach" && targetModel ? (
          <div className="flex-1 space-y-3 overflow-y-auto px-6 py-5">
            <p className="text-xs text-zinc-500">
              Attach an already-stored key to{" "}
              <span className="font-medium text-zinc-800">{targetModel.name}</span> so you can copy
              it directly from the model card.
            </p>
            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {error}
              </div>
            )}
            <div className="space-y-2.5">
              {attachableKeys.map((k) => {
                const autoAll =
                  k.providerId === targetModel.providerId && k.scopeMode === "all_provider";
                const explicitlyLinked = k.linkedModelIds.includes(targetModel.id);
                const active = autoAll || explicitlyLinked;
                return (
                  <div
                    key={k.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-3.5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <ProviderIcon providerId={k.providerId} size="sm" />
                        <span className="truncate text-sm font-medium text-zinc-900">
                          {k.label}
                        </span>
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                          {k.environment}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-xs text-zinc-500">{k.maskedKey}</p>
                    </div>
                    {autoAll ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700">
                        <Check className="h-3.5 w-3.5" />
                        Covers all models
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={linkingKeyId === k.id}
                        onClick={() => handleToggleAttachExisting(k, explicitlyLinked)}
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                          active
                            ? "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : "bg-indigo-600 text-white hover:bg-indigo-700"
                        }`}
                      >
                        {linkingKeyId === k.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : active ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            Linked
                          </>
                        ) : (
                          "Attach Key"
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              {error && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
                  {error}
                </div>
              )}

              {/* Provider Selector */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="key-provider" className="text-xs font-medium text-zinc-700">
                    LLM Provider
                  </label>
                  {!targetModel && (
                    <a
                      href={selectedProvider.docsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700"
                    >
                      Open {selectedProvider.name} Console
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <select
                  id="key-provider"
                  value={providerId}
                  onChange={(e) => handleProviderChange(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm font-medium text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
                >
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.envVar})
                    </option>
                  ))}
                </select>
              </div>

              {/* API Key Input */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="key-raw-input" className="text-xs font-medium text-zinc-700">
                    API Key
                  </label>
                  <span className="font-mono text-[11px] text-zinc-400">
                    {envVarOverride.trim() || selectedProvider.envVar}
                  </span>
                </div>
                <div className="relative">
                  <input
                    id="key-raw-input"
                    type={showKey ? "text" : "password"}
                    value={rawKey}
                    onChange={(e) => handleRawKeyChange(e.target.value)}
                    placeholder={
                      loadingRawKey
                        ? "Loading stored key..."
                        : `${selectedProvider.keyPrefix}paste-your-test-key-here`
                    }
                    autoFocus={!editingKey}
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50/70 py-2.5 pr-10 pl-3.5 font-mono text-xs text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((s) => !s)}
                    aria-label={showKey ? "Hide key" : "Show key"}
                    className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {detectedHint && (
                  <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-indigo-600">
                    <Sparkles className="h-3 w-3" />
                    {detectedHint}
                  </p>
                )}
              </div>

              {/* Label + Environment */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="key-label-input" className="mb-1.5 block text-xs font-medium text-zinc-700">
                    Friendly Label
                  </label>
                  <input
                    id="key-label-input"
                    type="text"
                    value={label}
                    onChange={(e) => {
                      setLabel(e.target.value);
                      setLabelTouched(true);
                    }}
                    placeholder={`${selectedProvider.name} Test Key`}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
                  />
                </div>

                <div>
                  <span className="mb-1.5 block text-xs font-medium text-zinc-700">
                    Test Environment
                  </span>
                  <div className="grid grid-cols-4 gap-1 rounded-xl border border-zinc-200 bg-zinc-50 p-1">
                    {ENVIRONMENT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setEnvironment(opt.value)}
                        className={`rounded-lg py-1 text-xs font-medium transition ${
                          environment === opt.value
                            ? "bg-white text-indigo-700 shadow-xs ring-1 ring-zinc-200/80"
                            : "text-zinc-500 hover:text-zinc-800"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Model Assignment */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-700">
                    Assigned {selectedProvider.name} Models
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    {providerModels.length} available
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setScopeMode("all_provider")}
                    className={`rounded-xl border px-3 py-2 text-left text-xs transition ${
                      scopeMode === "all_provider"
                        ? "border-indigo-300 bg-indigo-50/60 text-indigo-900"
                        : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                    }`}
                  >
                    <div className="font-semibold">All {selectedProvider.name} models</div>
                    <div className="mt-0.5 text-[11px] opacity-75">
                      Ready on every {selectedProvider.name} card
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setScopeMode("selected_models");
                      if (selectedModelIds.length === 0 && providerModels[0]) {
                        setSelectedModelIds([targetModel?.id ?? providerModels[0].id]);
                      }
                    }}
                    className={`rounded-xl border px-3 py-2 text-left text-xs transition ${
                      scopeMode === "selected_models"
                        ? "border-indigo-300 bg-indigo-50/60 text-indigo-900"
                        : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                    }`}
                  >
                    <div className="font-semibold">Specific models only</div>
                    <div className="mt-0.5 text-[11px] opacity-75">
                      Scope key to chosen test models
                    </div>
                  </button>
                </div>

                {scopeMode === "selected_models" && providerModels.length > 0 && (
                  <div className="mt-2.5 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50/60 p-2">
                    {providerModels.map((m) => {
                      const checked = selectedModelIds.includes(m.id);
                      return (
                        <label
                          key={m.id}
                          className={`flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition ${
                            checked
                              ? "bg-white text-zinc-950 shadow-2xs ring-1 ring-indigo-200"
                              : "text-zinc-600 hover:bg-white/70"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleModelSelection(m.id)}
                              className="h-3.5 w-3.5 rounded accent-indigo-600"
                            />
                            <span className="font-medium">{m.name}</span>
                          </span>
                          <code className="font-mono text-[11px] text-zinc-400">
                            {m.apiModelId}
                          </code>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="key-notes-input" className="mb-1.5 block text-xs font-medium text-zinc-700">
                  Test Notes <span className="font-normal text-zinc-400">(optional)</span>
                </label>
                <input
                  id="key-notes-input"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. $5 cap, shared QA project, free-tier rate limit"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
                />
              </div>

              {/* Favorite + Default + Advanced Toggle */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsFavorite((f) => !f)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                      isFavorite
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    <Star className={`h-3.5 w-3.5 ${isFavorite ? "fill-amber-500 text-amber-500" : ""}`} />
                    Pin to top
                  </button>

                  <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-zinc-600">
                    <input
                      type="checkbox"
                      checked={isDefault}
                      onChange={(e) => setIsDefault(e.target.checked)}
                      className="h-3.5 w-3.5 rounded accent-indigo-600"
                    />
                    Default for {selectedProvider.name}
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAdvanced((s) => !s)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-800"
                >
                  Custom env / proxy
                  {showAdvanced ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>

              {showAdvanced && (
                <div className="grid grid-cols-1 gap-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3.5 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-zinc-600">
                      Custom Env Variable
                    </label>
                    <input
                      type="text"
                      value={envVarOverride}
                      onChange={(e) =>
                        setEnvVarOverride(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))
                      }
                      placeholder={selectedProvider.envVar}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 font-mono text-xs text-zinc-900 outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-zinc-600">
                      Custom Proxy / Base URL
                    </label>
                    <input
                      type="text"
                      value={baseUrlOverride}
                      onChange={(e) => setBaseUrlOverride(e.target.value)}
                      placeholder={selectedProvider.baseUrl}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 font-mono text-xs text-zinc-900 outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2.5 border-t border-zinc-100 bg-zinc-50/50 px-6 py-3.5">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700 disabled:opacity-60"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {editingKey ? "Save Changes" : "Save API Key"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
