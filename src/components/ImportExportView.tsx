"use client";

import {
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileDown,
  FileUp,
  Loader2,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { ENVIRONMENT_OPTIONS } from "@/lib/catalog";
import type { ApiKeyDTO, KeyEnvironment, ProviderDTO } from "@/lib/types";
import { copyTextToClipboard } from "@/lib/ui";
import { ProviderIcon } from "./ProviderIcon";

interface ImportExportViewProps {
  providers: ProviderDTO[];
  keys: ApiKeyDTO[];
  onImported: (message: string) => Promise<void>;
}

export function ImportExportView({
  providers,
  keys,
  onImported,
}: ImportExportViewProps) {
  // Export state
  const [format, setFormat] = useState<"env" | "shell" | "json">("env");
  const [envFilter, setEnvFilter] = useState<string>("all");
  const [showPlainPreview, setShowPlainPreview] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>(() =>
    keys.map((k) => k.id)
  );
  const [previewText, setPreviewText] = useState<string>("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [copiedExport, setCopiedExport] = useState(false);

  // Import state
  const [importText, setImportText] = useState("");
  const [importEnv, setImportEnv] = useState<KeyEnvironment>("test");
  const [importSuffix, setImportSuffix] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const providerMap = new Map(providers.map((p) => [p.id, p]));

  useEffect(() => {
    setSelectedIds(keys.map((k) => k.id));
  }, [keys]);

  const filteredSelectableKeys = keys.filter(
    (k) => envFilter === "all" || k.environment === envFilter
  );

  const activeExportIds = filteredSelectableKeys
    .filter((k) => selectedIds.includes(k.id))
    .map((k) => k.id);

  useEffect(() => {
    let cancelled = false;
    async function loadPreview() {
      if (activeExportIds.length === 0) {
        setPreviewText("# Select at least one stored key to generate your test file.");
        return;
      }
      setLoadingPreview(true);
      try {
        const params = new URLSearchParams({
          format,
          environment: envFilter,
          masked: showPlainPreview ? "false" : "true",
          ids: activeExportIds.join(","),
        });
        const res = await fetch(`/api/export?${params.toString()}`);
        const data = await res.json();
        if (!cancelled && typeof data?.content === "string") {
          setPreviewText(data.content);
        }
      } catch {
        if (!cancelled) setPreviewText("# Failed to load export preview.");
      } finally {
        if (!cancelled) setLoadingPreview(false);
      }
    }
    loadPreview();
    return () => {
      cancelled = true;
    };
  }, [format, envFilter, showPlainPreview, activeExportIds.join(",")]);

  const handleCopyPlainExport = async () => {
    if (activeExportIds.length === 0) return;
    const params = new URLSearchParams({
      format,
      environment: envFilter,
      masked: "false",
      ids: activeExportIds.join(","),
    });
    const res = await fetch(`/api/export?${params.toString()}`);
    const data = await res.json();
    if (data?.content) {
      await copyTextToClipboard(data.content);
      setCopiedExport(true);
      setTimeout(() => setCopiedExport(false), 1800);
    }
  };

  const handleDownloadExport = () => {
    if (activeExportIds.length === 0) return;
    const params = new URLSearchParams({
      format,
      environment: envFilter,
      masked: "false",
      download: "true",
      ids: activeExportIds.join(","),
    });
    window.open(`/api/export?${params.toString()}`, "_blank");
  };

  const toggleKeyId = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleBulkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportError(null);
    if (!importText.trim()) {
      setImportError("Paste one or more KEY=value lines from your .env file.");
      return;
    }
    setImporting(true);
    try {
      const res = await fetch("/api/keys/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          envText: importText,
          environment: importEnv,
          labelSuffix: importSuffix.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImportError(data?.error || "Import failed.");
        return;
      }
      setImportText("");
      setImportSuffix("");
      await onImported(
        `Imported ${data.importedCount} API key${data.importedCount === 1 ? "" : "s"} into vault`
      );
    } catch {
      setImportError("Network error while importing keys.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      {/* Export Column */}
      <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] xl:col-span-7 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <FileDown className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-zinc-950">
                Export Keys to Test Platform
              </h2>
              <p className="text-xs text-zinc-500">
                Copy or download ready-to-drop <code className="font-mono">.env</code>, shell,
                or JSON bundles with decrypted keys
              </p>
            </div>
          </div>
        </div>

        {/* Format + Environment Row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl border border-zinc-200 bg-zinc-100 p-1 text-xs font-medium">
            {(
              [
                { id: "env", label: ".env File" },
                { id: "shell", label: "Shell (export)" },
                { id: "json", label: "JSON + Models" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setFormat(opt.id)}
                className={`rounded-lg px-3 py-1.5 transition ${
                  format === opt.id
                    ? "bg-white text-zinc-950 shadow-2xs"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <select
            value={envFilter}
            onChange={(e) => setEnvFilter(e.target.value)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 outline-none focus:border-indigo-500"
          >
            <option value="all">All environments</option>
            {ENVIRONMENT_OPTIONS.map((env) => (
              <option key={env.value} value={env.value}>
                {env.label} only
              </option>
            ))}
          </select>
        </div>

        {/* Key Selection Pills */}
        {filteredSelectableKeys.length > 0 && (
          <div className="max-h-36 space-y-1 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50/70 p-2">
            {filteredSelectableKeys.map((k) => {
              const checked = selectedIds.includes(k.id);
              const prov = providerMap.get(k.providerId);
              return (
                <label
                  key={k.id}
                  className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs transition hover:bg-white"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleKeyId(k.id)}
                      className="h-3.5 w-3.5 rounded accent-indigo-600"
                    />
                    <ProviderIcon providerId={k.providerId} size="sm" />
                    <span className="truncate font-medium text-zinc-900">{k.label}</span>
                    <span className="hidden text-zinc-400 sm:inline">
                      ({prov?.name})
                    </span>
                  </span>
                  <code className="shrink-0 font-mono text-[11px] text-zinc-500">
                    {k.effectiveEnvVar}
                  </code>
                </label>
              );
            })}
          </div>
        )}

        {/* Code Preview */}
        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-100">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 px-3.5 py-2.5">
            <button
              type="button"
              onClick={() => setShowPlainPreview((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white"
            >
              {showPlainPreview ? (
                <>
                  <EyeOff className="h-3.5 w-3.5" />
                  Mask preview
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5" />
                  Show plain keys
                </>
              )}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={activeExportIds.length === 0}
                onClick={handleDownloadExport}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-40"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </button>
              <button
                type="button"
                disabled={activeExportIds.length === 0}
                onClick={handleCopyPlainExport}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-40"
              >
                {copiedExport ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Copied Keys!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy Plain Export
                  </>
                )}
              </button>
            </div>
          </div>

          <pre className="max-h-72 overflow-auto p-4 font-mono text-xs leading-relaxed text-zinc-200">
            <code>{loadingPreview ? "# Generating preview..." : previewText}</code>
          </pre>
        </div>
      </section>

      {/* Bulk .env Import Column */}
      <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] xl:col-span-5 sm:p-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <FileUp className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-zinc-950">
              Bulk Import from .env
            </h2>
            <p className="text-xs text-zinc-500">
              Paste multiple <code className="font-mono">PROVIDER_API_KEY=...</code> lines to auto-match providers
            </p>
          </div>
        </div>

        <form onSubmit={handleBulkImport} className="space-y-3.5">
          {importError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {importError}
            </div>
          )}

          <textarea
            rows={9}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            spellCheck={false}
            placeholder={`# Paste lines from any test project .env:\nDEEPSEEK_API_KEY=sk-test-1234567890\nGROQ_API_KEY=gsk_test_abcdefghijk\nXAI_API_KEY=xai-test-9876543210\nOPENROUTER_API_KEY=sk-or-v1-test-key`}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50/70 p-3.5 font-mono text-xs leading-relaxed text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/15"
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">
                Tag Environment
              </label>
              <select
                value={importEnv}
                onChange={(e) => setImportEnv(e.target.value as KeyEnvironment)}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-900 outline-none focus:border-indigo-500"
              >
                {ENVIRONMENT_OPTIONS.map((env) => (
                  <option key={env.value} value={env.value}>
                    {env.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">
                Project Tag <span className="font-normal text-zinc-400">(opt.)</span>
              </label>
              <input
                type="text"
                value={importSuffix}
                onChange={(e) => setImportSuffix(e.target.value)}
                placeholder="e.g. QA Bot"
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={importing}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-zinc-800 disabled:opacity-60"
          >
            {importing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Detect Providers & Save Keys
          </button>
        </form>
      </section>
    </div>
  );
}
