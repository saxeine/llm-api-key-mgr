"use client";

import { Loader2, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import { CATEGORY_LABELS } from "@/lib/catalog";
import type { ModelCategory, ProviderDTO } from "@/lib/types";

interface CustomModelModalProps {
  open: boolean;
  onClose: () => void;
  providers: ProviderDTO[];
  defaultProviderId?: string | null;
  onCreated: (message: string) => Promise<void>;
}

export function CustomModelModal({
  open,
  onClose,
  providers,
  defaultProviderId,
  onCreated,
}: CustomModelModalProps) {
  const [providerId, setProviderId] = useState(
    defaultProviderId && defaultProviderId !== "all"
      ? defaultProviderId
      : providers[0]?.id || "openai"
  );
  const [name, setName] = useState("");
  const [apiModelId, setApiModelId] = useState("");
  const [category, setCategory] = useState<ModelCategory>("flagship");
  const [contextWindow, setContextWindow] = useState("128K");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setProviderId(
      defaultProviderId && defaultProviderId !== "all"
        ? defaultProviderId
        : providers[0]?.id || "openai"
    );
  }, [open, defaultProviderId, providers]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !apiModelId.trim()) {
      setError("Enter both a display name and an API model ID.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId,
          name: name.trim(),
          apiModelId: apiModelId.trim(),
          category,
          contextWindow: contextWindow.trim() || "128K",
          description:
            description.trim() ||
            `Custom ${name.trim()} model endpoint for test platform integration.`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Failed to add model.");
        return;
      }
      setName("");
      setApiModelId("");
      setDescription("");
      await onCreated(`Added custom model "${data.model.name}"`);
      onClose();
    } catch {
      setError("Network error while creating model.");
    } finally {
      setSubmitting(false);
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
        aria-labelledby="custom-model-title"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div>
            <h2 id="custom-model-title" className="text-base font-semibold text-zinc-950">
              Add Custom LLM Model
            </h2>
            <p className="text-xs text-zinc-500">
              Register a fine-tune, snapshot, or gateway model ID
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-700">
              Provider
            </label>
            <select
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-500"
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-700">
                Display Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="GPT-4.1 Fine-Tune"
                autoFocus
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-700">
                API Model ID
              </label>
              <input
                type="text"
                value={apiModelId}
                onChange={(e) => setApiModelId(e.target.value)}
                placeholder="ft:gpt-4.1-mini:test"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-900 outline-none focus:border-indigo-500 focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-700">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ModelCategory)}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-indigo-500"
              >
                {Object.entries(CATEGORY_LABELS).map(([val, lbl]) => (
                  <option key={val} value={val}>
                    {lbl}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-700">
                Context Window
              </label>
              <input
                type="text"
                value={contextWindow}
                onChange={(e) => setContextWindow(e.target.value)}
                placeholder="128K"
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-700">
              Short Description <span className="font-normal text-zinc-400">(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Staging checkpoint for automated evaluation tests"
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Add Model
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
