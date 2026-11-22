"use client";

import {
  ArrowLeftRight,
  Boxes,
  Check,
  Copy,
  KeyRound,
  Plus,
  Search,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ApiKeyDTO,
  LlmModelDTO,
  WorkspacePayload,
} from "@/lib/types";
import { copyTextToClipboard } from "@/lib/ui";
import { CustomModelModal } from "./CustomModelModal";
import { ImportExportView } from "./ImportExportView";
import { KeyModal } from "./KeyModal";
import { KeysVaultView } from "./KeysVaultView";
import { ModelsView } from "./ModelsView";
import { ProviderIcon } from "./ProviderIcon";
import { SnippetDrawer } from "./SnippetDrawer";

type ActiveTab = "vault" | "models" | "export";

interface KeyBenchAppProps {
  initialData: WorkspacePayload;
}

export function KeyBenchApp({ initialData }: KeyBenchAppProps) {
  const [workspace, setWorkspace] = useState<WorkspacePayload>(initialData);
  const [activeTab, setActiveTab] = useState<ActiveTab>("vault");
  const [selectedProviderId, setSelectedProviderId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Reveal & copy states
  const [revealedMap, setRevealedMap] = useState<Record<number, string>>({});
  const [revealAll, setRevealAll] = useState<boolean>(false);
  const [loadingRevealAll, setLoadingRevealAll] = useState<boolean>(false);
  const [copiedSignal, setCopiedSignal] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);

  // Modals & drawers
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKeyDTO | null>(null);
  const [modalProviderId, setModalProviderId] = useState<string | null>(null);
  const [modalTargetModel, setModalTargetModel] = useState<LlmModelDTO | null>(null);

  const [snippetOpen, setSnippetOpen] = useState(false);
  const [snippetModel, setSnippetModel] = useState<LlmModelDTO | null>(null);
  const [snippetKey, setSnippetKey] = useState<ApiKeyDTO | null>(null);

  const [customModelOpen, setCustomModelOpen] = useState(false);

  // Toast feedback
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 2800);
  }, []);

  const flashCopied = useCallback((id: string) => {
    setCopiedSignal(id);
    setTimeout(() => {
      setCopiedSignal((prev) => (prev === id ? null : prev));
    }, 1800);
  }, []);

  const refreshWorkspace = useCallback(
    async (withReveal?: boolean) => {
      const shouldReveal = withReveal ?? revealAll;
      const res = await fetch(
        `/api/workspace${shouldReveal ? "?reveal=true" : ""}`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const data: WorkspacePayload = await res.json();
      setWorkspace(data);
      if (shouldReveal) {
        const nextMap: Record<number, string> = {};
        for (const k of data.keys) {
          if (k.rawKey) nextMap[k.id] = k.rawKey;
        }
        setRevealedMap(nextMap);
      }
    },
    [revealAll]
  );

  // Global keyboard shortcuts: `/` focuses search, `Escape` closes modals
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;

      if (e.key === "/" && !isTyping && !keyModalOpen && !snippetOpen && !customModelOpen) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "Escape") {
        if (keyModalOpen) setKeyModalOpen(false);
        else if (snippetOpen) setSnippetOpen(false);
        else if (customModelOpen) setCustomModelOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [keyModalOpen, snippetOpen, customModelOpen]);

  // Provider counts for sidebar
  const providerCounts = useMemo(() => {
    const map = new Map<string, { keys: number; models: number }>();
    for (const p of workspace.providers) {
      map.set(p.id, { keys: 0, models: 0 });
    }
    for (const m of workspace.models) {
      const entry = map.get(m.providerId);
      if (entry) entry.models += 1;
    }
    for (const k of workspace.keys) {
      const entry = map.get(k.providerId);
      if (entry) entry.keys += 1;
    }
    return map;
  }, [workspace.providers, workspace.models, workspace.keys]);

  const revealSingleKey = useCallback(
    async (keyId: number, recordCopy = false): Promise<string | null> => {
      try {
        const res = await fetch(`/api/keys/${keyId}/reveal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recordCopy }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (typeof data?.rawKey === "string") {
          setRevealedMap((prev) => ({ ...prev, [keyId]: data.rawKey }));
          if (recordCopy) {
            setWorkspace((prev) => ({
              ...prev,
              keys: prev.keys.map((k) =>
                k.id === keyId
                  ? {
                      ...k,
                      copyCount: data.copyCount ?? k.copyCount + 1,
                      lastAccessedAt: data.lastAccessedAt ?? new Date().toISOString(),
                    }
                  : k
              ),
              stats: {
                ...prev.stats,
                totalCopies: prev.stats.totalCopies + 1,
              },
            }));
          }
          return data.rawKey;
        }
        return null;
      } catch {
        return null;
      }
    },
    []
  );

  const handleToggleRevealOne = useCallback(
    async (keyId: number) => {
      if (revealedMap[keyId]) {
        setRevealedMap((prev) => {
          const next = { ...prev };
          delete next[keyId];
          return next;
        });
        return;
      }
      await revealSingleKey(keyId, false);
    },
    [revealedMap, revealSingleKey]
  );

  const handleToggleRevealAll = useCallback(async () => {
    if (revealAll) {
      setRevealAll(false);
      setRevealedMap({});
      setWorkspace((prev) => ({
        ...prev,
        keys: prev.keys.map(({ rawKey: _omit, ...rest }) => rest),
      }));
      return;
    }
    setLoadingRevealAll(true);
    try {
      await refreshWorkspace(true);
      setRevealAll(true);
    } finally {
      setLoadingRevealAll(false);
    }
  }, [revealAll, refreshWorkspace]);

  const handleCopyKey = useCallback(
    async (key: ApiKeyDTO, asEnvLine = false) => {
      // Always trigger reveal with recordCopy so usage count updates and latest key is copied
      const raw = await revealSingleKey(key.id, true);
      const value = raw || key.rawKey || revealedMap[key.id];
      if (!value) {
        showToast("Could not retrieve API key");
        return;
      }

      // Do not leave key permanently visible on screen if user only clicked Copy (unless it was already open)
      const wasOpen = Boolean(revealedMap[key.id]) || revealAll;
      if (!wasOpen) {
        setRevealedMap((prev) => {
          const next = { ...prev };
          delete next[key.id];
          return next;
        });
      }

      const textToCopy = asEnvLine
        ? `${key.effectiveEnvVar}="${value}"`
        : value;
      await copyTextToClipboard(textToCopy);
      flashCopied(asEnvLine ? `env-${key.id}` : `key-${key.id}`);
      showToast(
        asEnvLine
          ? `Copied ${key.effectiveEnvVar} line`
          : `Copied "${key.label}" to clipboard`
      );
    },
    [revealSingleKey, revealedMap, revealAll, flashCopied, showToast]
  );

  const handleQuickCopyAllEnv = async () => {
    if (workspace.keys.length === 0) {
      showToast("Store at least one key first");
      return;
    }
    try {
      const res = await fetch("/api/export?format=env&masked=false");
      const data = await res.json();
      if (data?.content) {
        await copyTextToClipboard(data.content);
        flashCopied("all-env");
        showToast(
          `Copied all ${workspace.keys.length} key${workspace.keys.length === 1 ? "" : "s"} as .env`
        );
      }
    } catch {
      showToast("Failed to export .env");
    }
  };

  const handleToggleFavorite = async (key: ApiKeyDTO) => {
    const nextFav = !key.isFavorite;
    setWorkspace((prev) => ({
      ...prev,
      keys: prev.keys.map((k) =>
        k.id === key.id ? { ...k, isFavorite: nextFav } : k
      ),
    }));
    await fetch(`/api/keys/${key.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isFavorite: nextFav }),
    });
    await refreshWorkspace();
    showToast(nextFav ? `Pinned "${key.label}"` : `Unpinned "${key.label}"`);
  };

  const handleDeleteKey = async (key: ApiKeyDTO) => {
    const res = await fetch(`/api/keys/${key.id}`, { method: "DELETE" });
    if (res.ok) {
      setRevealedMap((prev) => {
        const next = { ...prev };
        delete next[key.id];
        return next;
      });
      await refreshWorkspace();
      showToast(`Deleted "${key.label}"`);
    } else {
      showToast("Failed to delete key");
    }
  };

  const handleVerifyKey = async (keyId: number) => {
    setVerifyingId(keyId);
    try {
      const res = await fetch(`/api/keys/${keyId}/verify`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        await refreshWorkspace();
        showToast(data.lastStatusMessage || "Key verified");
      } else {
        showToast(data?.error || "Verification failed");
      }
    } catch {
      showToast("Verification request failed");
    } finally {
      setVerifyingId(null);
    }
  };

  const handleDeleteCustomModel = async (model: LlmModelDTO) => {
    const res = await fetch(`/api/models/${encodeURIComponent(model.id)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      await refreshWorkspace();
      showToast(`Removed "${model.name}"`);
    }
  };

  const openAddKeyForProvider = (providerId?: string) => {
    setEditingKey(null);
    setModalTargetModel(null);
    setModalProviderId(
      providerId || (selectedProviderId !== "all" ? selectedProviderId : "openai")
    );
    setKeyModalOpen(true);
  };

  const openAddKeyForModel = (model: LlmModelDTO) => {
    setEditingKey(null);
    setModalProviderId(model.providerId);
    setModalTargetModel(model);
    setKeyModalOpen(true);
  };

  const openEditKey = (key: ApiKeyDTO) => {
    setModalTargetModel(null);
    setModalProviderId(key.providerId);
    setEditingKey(key);
    setKeyModalOpen(true);
  };

  const openSnippetDrawer = ({
    model = null,
    key = null,
  }: {
    model?: LlmModelDTO | null;
    key?: ApiKeyDTO | null;
  }) => {
    setSnippetModel(model);
    setSnippetKey(key);
    setSnippetOpen(true);
  };

  const activeProviderName =
    selectedProviderId === "all"
      ? null
      : workspace.providers.find((p) => p.id === selectedProviderId)?.name ?? null;

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-950">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-zinc-200/90 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-15 max-w-[1360px] items-center justify-between gap-4 px-4 sm:px-6">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setActiveTab("vault");
                setSelectedProviderId("all");
              }}
              className="flex items-center gap-2.5 text-left"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  className="h-4 w-4"
                >
                  <circle cx="8.5" cy="12" r="4" />
                  <path d="M12.5 12H20.5" strokeLinecap="round" />
                  <path d="M17.5 12V15.2" strokeLinecap="round" />
                  <path d="M20.5 12V14.5" strokeLinecap="round" />
                </svg>
              </span>
              <span className="text-[15px] font-semibold tracking-tight text-zinc-950">
                KeyBench
              </span>
            </button>
            <span className="hidden rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-500 sm:inline-block">
              Test Vault
            </span>
          </div>

          {/* Primary 3-Tab Navigation (Desktop) */}
          <nav
            aria-label="Workspace views"
            className="hidden items-center gap-1 rounded-xl border border-zinc-200/90 bg-zinc-100/80 p-1 md:flex"
          >
            <button
              type="button"
              onClick={() => setActiveTab("vault")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${
                activeTab === "vault"
                  ? "bg-white text-zinc-950 shadow-2xs"
                  : "text-zinc-600 hover:text-zinc-950"
              }`}
            >
              <KeyRound className="h-3.5 w-3.5" />
              Keys Vault
              <span
                className={`ml-0.5 rounded-md px-1.5 py-0.5 text-[11px] leading-none tabular-nums ${
                  activeTab === "vault"
                    ? "bg-indigo-50 font-semibold text-indigo-700"
                    : "bg-zinc-200/70 text-zinc-600"
                }`}
              >
                {workspace.stats.totalKeys}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("models")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${
                activeTab === "models"
                  ? "bg-white text-zinc-950 shadow-2xs"
                  : "text-zinc-600 hover:text-zinc-950"
              }`}
            >
              <Boxes className="h-3.5 w-3.5" />
              Major Models
              <span
                className={`ml-0.5 rounded-md px-1.5 py-0.5 text-[11px] leading-none tabular-nums ${
                  activeTab === "models"
                    ? "bg-indigo-50 font-semibold text-indigo-700"
                    : "bg-zinc-200/70 text-zinc-600"
                }`}
              >
                {workspace.stats.totalModels}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("export")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${
                activeTab === "export"
                  ? "bg-white text-zinc-950 shadow-2xs"
                  : "text-zinc-600 hover:text-zinc-950"
              }`}
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Import &amp; Export
            </button>
          </nav>

          {/* Primary Action */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openAddKeyForProvider()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Key
            </button>
          </div>
        </div>

        {/* Mobile Tab Switcher */}
        <div className="flex border-t border-zinc-100 px-4 py-2 md:hidden">
          <div className="grid w-full grid-cols-3 gap-1 rounded-xl bg-zinc-100 p-1 text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab("vault")}
              className={`rounded-lg py-1.5 transition ${
                activeTab === "vault"
                  ? "bg-white text-zinc-950 shadow-2xs"
                  : "text-zinc-600"
              }`}
            >
              Keys ({workspace.stats.totalKeys})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("models")}
              className={`rounded-lg py-1.5 transition ${
                activeTab === "models"
                  ? "bg-white text-zinc-950 shadow-2xs"
                  : "text-zinc-600"
              }`}
            >
              Models ({workspace.stats.totalModels})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("export")}
              className={`rounded-lg py-1.5 transition ${
                activeTab === "export"
                  ? "bg-white text-zinc-950 shadow-2xs"
                  : "text-zinc-600"
              }`}
            >
              .env I/O
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Container */}
      <div className="mx-auto flex max-w-[1360px] flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:items-start lg:py-8">
        {/* Left Provider Rail (Shown on Vault & Models views) */}
        {activeTab !== "export" && (
          <aside className="w-full shrink-0 lg:sticky lg:top-22 lg:w-60">
            {/* Mobile Horizontal Provider Pills */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 lg:hidden">
              <button
                type="button"
                onClick={() => setSelectedProviderId("all")}
                className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                  selectedProviderId === "all"
                    ? "bg-zinc-950 text-white"
                    : "border border-zinc-200 bg-white text-zinc-700"
                }`}
              >
                All ({workspace.stats.totalProviders})
              </button>
              {workspace.providers.map((p) => {
                const counts = providerCounts.get(p.id) ?? { keys: 0, models: 0 };
                const active = selectedProviderId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedProviderId(p.id)}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                      active
                        ? "bg-indigo-600 text-white"
                        : "border border-zinc-200 bg-white text-zinc-700"
                    }`}
                  >
                    {counts.keys > 0 && (
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          active ? "bg-white" : "bg-emerald-500"
                        }`}
                      />
                    )}
                    {p.name}
                  </button>
                );
              })}
            </div>

            {/* Desktop Provider Rail */}
            <div className="hidden rounded-2xl border border-zinc-200 bg-white p-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.025)] lg:block">
              <div className="mb-1.5 flex items-center justify-between px-2.5 pt-1">
                <span className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                  Providers
                </span>
                <span className="text-[11px] text-zinc-400 tabular-nums">
                  {workspace.stats.coveredProviders}/{workspace.stats.totalProviders} keyed
                </span>
              </div>

              <div className="max-h-[calc(100vh-11rem)] space-y-0.5 overflow-y-auto pr-0.5">
                <button
                  type="button"
                  onClick={() => setSelectedProviderId("all")}
                  className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs font-medium transition ${
                    selectedProviderId === "all"
                      ? "bg-indigo-50/90 font-semibold text-indigo-700"
                      : "text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950"
                  }`}
                >
                  <span>All Providers</span>
                  <span className="rounded-md bg-white/80 px-1.5 py-0.5 text-[11px] text-zinc-500 tabular-nums ring-1 ring-zinc-200/70">
                    {activeTab === "vault"
                      ? workspace.stats.totalKeys
                      : workspace.stats.totalModels}
                  </span>
                </button>

                {workspace.providers.map((p) => {
                  const counts = providerCounts.get(p.id) ?? { keys: 0, models: 0 };
                  const active = selectedProviderId === p.id;
                  return (
                    <div
                      key={p.id}
                      className={`group flex items-center justify-between rounded-xl px-2 py-1.5 transition ${
                        active ? "bg-indigo-50/90" : "hover:bg-zinc-50"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedProviderId(p.id)}
                        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                      >
                        <ProviderIcon providerId={p.id} size="sm" />
                        <span
                          className={`truncate text-xs ${
                            active
                              ? "font-semibold text-indigo-700"
                              : "font-medium text-zinc-700 group-hover:text-zinc-950"
                          }`}
                        >
                          {p.name}
                        </span>
                      </button>

                      <div className="flex shrink-0 items-center gap-1">
                        {counts.keys > 0 ? (
                          <span
                            title={`${counts.keys} stored key${counts.keys === 1 ? "" : "s"}`}
                            className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 tabular-nums"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            {counts.keys}
                          </span>
                        ) : (
                          <span className="text-[11px] text-zinc-400 tabular-nums group-hover:hidden">
                            {counts.models}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openAddKeyForProvider(p.id);
                          }}
                          title={`Add ${p.name} key`}
                          className={`rounded p-0.5 text-zinc-400 transition hover:bg-indigo-100 hover:text-indigo-700 ${
                            counts.keys > 0 ? "hidden group-hover:inline-flex" : "hidden group-hover:inline-flex"
                          }`}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        )}

        {/* Main Content Area */}
        <main className="min-w-0 flex-1 space-y-6">
          {/* Page Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-zinc-950 sm:text-2xl">
                {activeTab === "vault"
                  ? activeProviderName
                    ? `${activeProviderName} API Keys`
                    : "LLM Test Key Vault"
                  : activeTab === "models"
                    ? activeProviderName
                      ? `${activeProviderName} Models`
                      : "Major LLM Models Directory"
                    : "Import & Export Environment Keys"}
              </h1>
              <p className="mt-1 text-xs text-zinc-500 sm:text-sm">
                {activeTab === "vault"
                  ? "Fast, frictionless storage and 1-click re-access for your dev, staging, and test platform keys."
                  : activeTab === "models"
                    ? `Browse all ${workspace.stats.totalModels} major models across ${workspace.stats.totalProviders} providers—attach or copy API keys in one click.`
                    : "Export plaintext .env files directly into test platforms, or bulk-import existing key files."}
              </p>
            </div>

            {activeProviderName && activeTab !== "export" && (
              <button
                type="button"
                onClick={() => setSelectedProviderId("all")}
                className="inline-flex self-start items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-950 sm:self-auto"
              >
                Showing: {activeProviderName}
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Compact 3-Card Summary Strip + Search (Vault & Models) */}
          {activeTab !== "export" && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setActiveTab("vault")}
                  className={`rounded-2xl border p-4 text-left transition ${
                    activeTab === "vault"
                      ? "border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
                      : "border-zinc-200/80 bg-white/80 hover:border-zinc-300 hover:bg-white"
                  }`}
                >
                  <span className="text-xs font-medium text-zinc-500">
                    Stored Test Keys
                  </span>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-2xl font-semibold tracking-tight text-zinc-950 tabular-nums">
                      {workspace.stats.totalKeys}
                    </span>
                    <span className="text-xs text-zinc-400 tabular-nums">
                      {workspace.stats.coveredProviders} of {workspace.stats.totalProviders} providers
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("models")}
                  className={`rounded-2xl border p-4 text-left transition ${
                    activeTab === "models"
                      ? "border-indigo-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
                      : "border-zinc-200/80 bg-white/80 hover:border-indigo-200 hover:bg-white"
                  }`}
                >
                  <span className="text-xs font-medium text-zinc-500">
                    Major Models Ready
                  </span>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-2xl font-semibold tracking-tight text-zinc-950 tabular-nums">
                      {workspace.stats.coveredModels}
                      <span className="text-base font-normal text-zinc-400">
                        /{workspace.stats.totalModels}
                      </span>
                    </span>
                    <span className="text-xs font-medium text-indigo-600">
                      {activeTab === "models" ? "Attach keys below" : "Browse models →"}
                    </span>
                  </div>
                </button>

                <div className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                  <div className="min-w-0">
                    <span className="text-xs font-medium text-zinc-500">
                      Quick .env Bundle
                    </span>
                    <p className="mt-1 truncate text-xs text-zinc-400">
                      Copy all stored keys at once
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleQuickCopyAllEnv}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                      copiedSignal === "all-env"
                        ? "bg-emerald-600 text-white"
                        : "border border-zinc-200 bg-zinc-50 text-zinc-900 hover:bg-zinc-100"
                    }`}
                  >
                    {copiedSignal === "all-env" ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy .env
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    activeTab === "vault"
                      ? "Search stored keys by label, provider, model (gpt-5, claude-sonnet-4-6), or ENV var..."
                      : "Search 50+ major models (GPT-5, Claude 4.6, Gemini 3, Grok 4, DeepSeek R1, Llama 4, Qwen 3, Mistral)..."
                  }
                  className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pr-12 pl-10 text-sm text-zinc-900 placeholder:text-zinc-400 shadow-[0_1px_2px_rgba(0,0,0,0.02)] outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search"
                    className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <kbd className="pointer-events-none absolute top-1/2 right-3.5 hidden -translate-y-1/2 rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 sm:inline-block">
                    /
                  </kbd>
                )}
              </div>
            </>
          )}

          {/* Active Workspace View */}
          {activeTab === "vault" && (
            <KeysVaultView
              providers={workspace.providers}
              models={workspace.models}
              keys={workspace.keys}
              selectedProviderId={selectedProviderId}
              searchQuery={searchQuery}
              revealedMap={revealedMap}
              revealAll={revealAll}
              loadingRevealAll={loadingRevealAll}
              onToggleRevealAll={handleToggleRevealAll}
              onToggleRevealOne={handleToggleRevealOne}
              onCopyKey={handleCopyKey}
              copiedSignal={copiedSignal}
              onToggleFavorite={handleToggleFavorite}
              onEditKey={openEditKey}
              onDeleteKey={handleDeleteKey}
              onVerifyKey={handleVerifyKey}
              verifyingId={verifyingId}
              onOpenSnippet={openSnippetDrawer}
              onAddKeyForProvider={openAddKeyForProvider}
              onAddKeyForModel={openAddKeyForModel}
              onSwitchToModels={() => setActiveTab("models")}
            />
          )}

          {activeTab === "models" && (
            <ModelsView
              providers={workspace.providers}
              models={workspace.models}
              keys={workspace.keys}
              selectedProviderId={selectedProviderId}
              searchQuery={searchQuery}
              copiedSignal={copiedSignal}
              onCopyKey={handleCopyKey}
              onAddKeyForModel={openAddKeyForModel}
              onAddKeyForProvider={openAddKeyForProvider}
              onOpenSnippet={openSnippetDrawer}
              onOpenCustomModel={() => setCustomModelOpen(true)}
              onDeleteCustomModel={handleDeleteCustomModel}
            />
          )}

          {activeTab === "export" && (
            <ImportExportView
              providers={workspace.providers}
              keys={workspace.keys}
              onImported={async (msg) => {
                await refreshWorkspace();
                showToast(msg);
              }}
            />
          )}
        </main>
      </div>

      {/* Add / Edit / Attach Key Modal */}
      <KeyModal
        open={keyModalOpen}
        onClose={() => setKeyModalOpen(false)}
        providers={workspace.providers}
        models={workspace.models}
        existingKeys={workspace.keys}
        editingKey={editingKey}
        initialProviderId={modalProviderId}
        targetModel={modalTargetModel}
        onSaved={async (msg) => {
          await refreshWorkspace();
          showToast(msg);
        }}
      />

      {/* Quick Use Code Snippet & Verification Drawer */}
      <SnippetDrawer
        open={snippetOpen}
        onClose={() => setSnippetOpen(false)}
        providers={workspace.providers}
        models={workspace.models}
        keys={workspace.keys}
        initialModel={snippetModel}
        initialKey={snippetKey}
        revealedMap={revealedMap}
        onRevealKey={revealSingleKey}
        onVerifyKey={handleVerifyKey}
        verifyingId={verifyingId}
        onAddKeyForModel={openAddKeyForModel}
      />

      {/* Add Custom Model Modal */}
      <CustomModelModal
        open={customModelOpen}
        onClose={() => setCustomModelOpen(false)}
        providers={workspace.providers}
        defaultProviderId={selectedProviderId}
        onCreated={async (msg) => {
          await refreshWorkspace();
          showToast(msg);
        }}
      />

      {/* Floating Toast Feedback */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-5 bottom-5 z-50 flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-xs font-medium text-white shadow-xl"
        >
          <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
