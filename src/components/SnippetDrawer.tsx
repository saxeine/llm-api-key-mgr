"use client";

import {
  Activity,
  Check,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Terminal,
  X,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { buildSnippet, type SnippetTab } from "@/lib/snippets";
import type { ApiKeyDTO, LlmModelDTO, ProviderDTO } from "@/lib/types";
import { copyTextToClipboard } from "@/lib/ui";
import { ProviderIcon } from "./ProviderIcon";

interface SnippetDrawerProps {
  open: boolean;
  onClose: () => void;
  providers: ProviderDTO[];
  models: LlmModelDTO[];
  keys: ApiKeyDTO[];
  initialModel: LlmModelDTO | null;
  initialKey: ApiKeyDTO | null;
  revealedMap: Record<number, string>;
  onRevealKey: (keyId: number, recordCopy?: boolean) => Promise<string | null>;
  onVerifyKey: (keyId: number) => Promise<void>;
  verifyingId: number | null;
  onAddKeyForModel: (model: LlmModelDTO) => void;
}

const SNIPPET_TABS: Array<{ id: SnippetTab; label: string }> = [
  { id: "env", label: ".env" },
  { id: "curl", label: "cURL" },
  { id: "typescript", label: "TypeScript" },
  { id: "python", label: "Python" },
];

export function SnippetDrawer({
  open,
  onClose,
  providers,
  models,
  keys,
  initialModel,
  initialKey,
  revealedMap,
  onRevealKey,
  onVerifyKey,
  verifyingId,
  onAddKeyForModel,
}: SnippetDrawerProps) {
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [selectedKeyId, setSelectedKeyId] = useState<number | null>(null);
  const [tab, setTab] = useState<SnippetTab>("curl");
  const [injectRealKey, setInjectRealKey] = useState(false);
  const [loadingReveal, setLoadingReveal] = useState(false);
  const [copiedTarget, setCopiedTarget] = useState<string | null>(null);

  const activeProviderId =
    initialModel?.providerId || initialKey?.providerId || providers[0]?.id || "openai";

  const provider = useMemo(
    () => providers.find((p) => p.id === activeProviderId) ?? providers[0],
    [providers, activeProviderId]
  );

  const providerModels = useMemo(
    () => models.filter((m) => m.providerId === activeProviderId),
    [models, activeProviderId]
  );

  const activeModel = useMemo(
    () =>
      providerModels.find((m) => m.id === selectedModelId) ??
      initialModel ??
      providerModels[0],
    [providerModels, selectedModelId, initialModel]
  );

  const matchingKeys = useMemo(() => {
    if (!activeModel) return [];
    return keys.filter(
      (k) =>
        (k.providerId === activeModel.providerId && k.scopeMode === "all_provider") ||
        k.linkedModelIds.includes(activeModel.id)
    );
  }, [keys, activeModel]);

  const activeKey = useMemo(() => {
    if (selectedKeyId) {
      const exact = matchingKeys.find((k) => k.id === selectedKeyId);
      if (exact) return exact;
      const anyProv = keys.find(
        (k) => k.id === selectedKeyId && k.providerId === activeProviderId
      );
      if (anyProv) return anyProv;
    }
    return (
      matchingKeys.find((k) => k.isDefault) ?? matchingKeys[0] ?? initialKey ?? null
    );
  }, [selectedKeyId, matchingKeys, keys, activeProviderId, initialKey]);

  useEffect(() => {
    if (!open) return;
    setInjectRealKey(false);
    setCopiedTarget(null);

    if (initialModel) {
      setSelectedModelId(initialModel.id);
    } else if (initialKey) {
      const firstLinked =
        models.find((m) => initialKey.linkedModelIds.includes(m.id)) ??
        models.find((m) => m.providerId === initialKey.providerId);
      if (firstLinked) setSelectedModelId(firstLinked.id);
    }

    if (initialKey) {
      setSelectedKeyId(initialKey.id);
    } else if (initialModel) {
      const eligible = keys.filter(
        (k) =>
          k.providerId === initialModel.providerId &&
          (k.scopeMode === "all_provider" ||
            k.linkedModelIds.includes(initialModel.id))
      );
      const preferred = eligible.find((k) => k.isDefault) ?? eligible[0] ?? null;
      setSelectedKeyId(preferred?.id ?? null);
    }
  }, [open, initialModel, initialKey, models, keys]);

  if (!open || !provider || !activeModel) return null;

  const currentRawKey = activeKey
    ? activeKey.rawKey || revealedMap[activeKey.id] || null
    : null;

  const displayKeyValue = activeKey
    ? injectRealKey && currentRawKey
      ? currentRawKey
      : activeKey.maskedKey
    : `YOUR_${provider.envVar}`;

  const snippetText = buildSnippet({
    tab,
    provider,
    model: activeModel,
    apiKey: activeKey,
    keyValue: displayKeyValue,
  });

  const flashCopied = (target: string) => {
    setCopiedTarget(target);
    setTimeout(() => {
      setCopiedTarget((prev) => (prev === target ? null : prev));
    }, 1800);
  };

  const handleToggleRealKey = async () => {
    if (!activeKey) return;
    if (injectRealKey) {
      setInjectRealKey(false);
      return;
    }
    if (!currentRawKey) {
      setLoadingReveal(true);
      await onRevealKey(activeKey.id, false);
      setLoadingReveal(false);
    }
    setInjectRealKey(true);
  };

  const handleCopySnippetWithRealKey = async () => {
    if (!activeKey) {
      await copyTextToClipboard(snippetText);
      flashCopied("snippet");
      return;
    }
    let real = currentRawKey;
    if (!real) {
      setLoadingReveal(true);
      real = await onRevealKey(activeKey.id, true);
      setLoadingReveal(false);
    }
    const textToCopy = buildSnippet({
      tab,
      provider,
      model: activeModel,
      apiKey: activeKey,
      keyValue: real || activeKey.maskedKey,
    });
    await copyTextToClipboard(textToCopy);
    flashCopied("snippet");
  };

  const handleCopyRawKey = async () => {
    if (!activeKey) return;
    const real = currentRawKey || (await onRevealKey(activeKey.id, true));
    if (real) {
      await copyTextToClipboard(real);
      flashCopied("rawkey");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-zinc-950/30 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quick integration snippet drawer"
        className="flex h-full w-full max-w-xl flex-col border-l border-zinc-200 bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <ProviderIcon providerId={provider.id} size="md" />
            <div>
              <h2 className="text-base font-semibold text-zinc-950">
                Quick Use — {provider.name}
              </h2>
              <p className="text-xs text-zinc-500">
                Copy credentials or drop-in test code with your stored API key
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* Model + Key Selectors */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-700">
                Target Model
              </label>
              <select
                value={activeModel.id}
                onChange={(e) => setSelectedModelId(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
              >
                {providerModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.apiModelId})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-700">
                Stored API Key
              </label>
              {matchingKeys.length > 0 ? (
                <select
                  value={activeKey?.id ?? ""}
                  onChange={(e) => {
                    setSelectedKeyId(Number(e.target.value));
                    setInjectRealKey(false);
                  }}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
                >
                  {matchingKeys.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.label} [{k.environment}]
                    </option>
                  ))}
                </select>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onAddKeyForModel(activeModel);
                  }}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-indigo-300 bg-indigo-50/60 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add key for {activeModel.name}
                </button>
              )}
            </div>
          </div>

          {/* Fast Copy Fields */}
          <div className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[11px] font-medium text-zinc-500">API Model ID</span>
                <p className="truncate font-mono text-xs font-medium text-zinc-900">
                  {activeModel.apiModelId}
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await copyTextToClipboard(activeModel.apiModelId);
                  flashCopied("model");
                }}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                {copiedTarget === "model" ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy ID
                  </>
                )}
              </button>
            </div>

            <div className="border-t border-zinc-200/70 pt-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[11px] font-medium text-zinc-500">Base Endpoint</span>
                  <p className="truncate font-mono text-xs text-zinc-700">
                    {activeKey?.effectiveBaseUrl || provider.baseUrl}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await copyTextToClipboard(
                      activeKey?.effectiveBaseUrl || provider.baseUrl
                    );
                    flashCopied("url");
                  }}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  {copiedTarget === "url" ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy URL
                    </>
                  )}
                </button>
              </div>
            </div>

            {activeKey && (
              <div className="border-t border-zinc-200/70 pt-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-medium text-zinc-500">
                      {activeKey.effectiveEnvVar}
                    </span>
                    <p className="truncate font-mono text-xs font-medium text-zinc-900">
                      {injectRealKey && currentRawKey
                        ? currentRawKey
                        : activeKey.maskedKey}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      disabled={verifyingId === activeKey.id}
                      onClick={() => onVerifyKey(activeKey.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                      title="Test key format and endpoint authentication"
                    >
                      {verifyingId === activeKey.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Activity className="h-3.5 w-3.5 text-indigo-600" />
                      )}
                      Test Key
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyRawKey}
                      className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-800"
                    >
                      {copiedTarget === "rawkey" ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
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
                {activeKey.lastStatusMessage && (
                  <p
                    className={`mt-1.5 text-[11px] ${
                      activeKey.lastStatus === "valid"
                        ? "text-emerald-700"
                        : activeKey.lastStatus === "invalid"
                          ? "text-rose-600"
                          : "text-zinc-500"
                    }`}
                  >
                    Status: {activeKey.lastStatusMessage}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Code Snippet Box */}
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-100 p-0.5">
                {SNIPPET_TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                      tab === t.id
                        ? "bg-white text-zinc-950 shadow-2xs"
                        : "text-zinc-600 hover:text-zinc-900"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {activeKey && (
                <button
                  type="button"
                  onClick={handleToggleRealKey}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-950"
                >
                  {loadingReveal ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : injectRealKey ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                  {injectRealKey ? "Mask key in preview" : "Show plain key"}
                </button>
              )}
            </div>

            <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-100">
              <div className="flex items-center justify-between border-b border-zinc-800/90 px-3.5 py-2">
                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-zinc-400">
                  <Terminal className="h-3.5 w-3.5 text-zinc-500" />
                  {activeModel.apiModelId}
                </span>
                <button
                  type="button"
                  onClick={handleCopySnippetWithRealKey}
                  className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-indigo-500"
                >
                  {copiedTarget === "snippet" ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Copied with Key!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      {activeKey ? "Copy Ready Snippet" : "Copy Template"}
                    </>
                  )}
                </button>
              </div>
              <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-zinc-200">
                <code>{snippetText}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
