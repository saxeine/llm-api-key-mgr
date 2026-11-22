"use client";

import React from "react";

interface ProviderIconProps {
  providerId: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const PROVIDER_PALETTE: Record<string, { bg: string; fg: string; border: string }> = {
  openai: { bg: "bg-emerald-50", fg: "text-emerald-700", border: "border-emerald-200/70" },
  anthropic: { bg: "bg-orange-50", fg: "text-orange-700", border: "border-orange-200/70" },
  google: { bg: "bg-blue-50", fg: "text-blue-600", border: "border-blue-200/70" },
  xai: { bg: "bg-zinc-900", fg: "text-white", border: "border-zinc-800" },
  deepseek: { bg: "bg-sky-50", fg: "text-sky-600", border: "border-sky-200/70" },
  meta: { bg: "bg-blue-50", fg: "text-blue-700", border: "border-blue-200/70" },
  mistral: { bg: "bg-amber-50", fg: "text-orange-600", border: "border-amber-200/70" },
  qwen: { bg: "bg-violet-50", fg: "text-violet-700", border: "border-violet-200/70" },
  cohere: { bg: "bg-teal-50", fg: "text-teal-700", border: "border-teal-200/70" },
  groq: { bg: "bg-orange-50", fg: "text-orange-600", border: "border-orange-200/70" },
  perplexity: { bg: "bg-cyan-50", fg: "text-cyan-700", border: "border-cyan-200/70" },
  openrouter: { bg: "bg-indigo-50", fg: "text-indigo-600", border: "border-indigo-200/70" },
  together: { bg: "bg-blue-50", fg: "text-indigo-700", border: "border-blue-200/70" },
  fireworks: { bg: "bg-purple-50", fg: "text-purple-700", border: "border-purple-200/70" },
};

const SIZE_CLASSES = {
  sm: { box: "h-6 w-6 rounded-md", svg: "h-3.5 w-3.5" },
  md: { box: "h-8 w-8 rounded-lg", svg: "h-4 w-4" },
  lg: { box: "h-10 w-10 rounded-xl", svg: "h-5 w-5" },
};

function renderGlyph(providerId: string, svgClass: string) {
  switch (providerId) {
    case "openai":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={svgClass}>
          <polygon points="12 3 19.8 7.5 19.8 16.5 12 21 4.2 16.5 4.2 7.5 12 3" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="3.2" />
        </svg>
      );
    case "anthropic":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" className={svgClass}>
          <path d="M5 18.5L10.2 5.5L15.4 18.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M14.2 5.5L19.4 18.5" strokeLinecap="round" />
          <path d="M7.1 14.2H13.3" strokeLinecap="round" />
        </svg>
      );
    case "google":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={svgClass}>
          <path d="M12 2.5C12.5 8 16 11.5 21.5 12C16 12.5 12.5 16 12 21.5C11.5 16 8 12.5 2.5 12C8 11.5 11.5 8 12 2.5Z" />
        </svg>
      );
    case "xai":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className={svgClass}>
          <path d="M5.5 5.5L18.5 18.5" strokeLinecap="round" />
          <path d="M18.5 5.5L5.5 18.5" strokeLinecap="round" />
        </svg>
      );
    case "deepseek":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={svgClass}>
          <path d="M4 13.5C4 8.8 7.8 5.5 12.5 5.5C16.5 5.5 19.5 8 20.5 11.2C18.5 11.2 17 12.5 17 14.5C15.5 17.5 12.5 19 9 19C6.2 19 4 16.6 4 13.5Z" strokeLinejoin="round" />
          <circle cx="11" cy="11" r="1.2" fill="currentColor" />
        </svg>
      );
    case "meta":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={svgClass}>
          <path d="M12 12C9.8 8.5 7.5 7 5.8 7C3.9 7 2.8 9 2.8 12C2.8 15 3.9 17 5.8 17C7.5 17 9.8 15.5 12 12ZM12 12C14.2 8.5 16.5 7 18.2 7C20.1 7 21.2 9 21.2 12C21.2 15 20.1 17 18.2 17C16.5 17 14.2 15.5 12 12Z" strokeLinejoin="round" />
        </svg>
      );
    case "mistral":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={svgClass}>
          <rect x="4" y="5" width="4" height="4" rx="0.6" />
          <rect x="16" y="5" width="4" height="4" rx="0.6" />
          <rect x="4" y="10" width="6" height="4" rx="0.6" />
          <rect x="14" y="10" width="6" height="4" rx="0.6" />
          <rect x="10" y="12" width="4" height="3.5" rx="0.6" />
          <rect x="4" y="15" width="4" height="4" rx="0.6" />
          <rect x="16" y="15" width="4" height="4" rx="0.6" />
        </svg>
      );
    case "qwen":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={svgClass}>
          <circle cx="11.5" cy="11.5" r="6.5" />
          <path d="M15 15L20 20" strokeLinecap="round" />
          <circle cx="11.5" cy="11.5" r="2.2" />
        </svg>
      );
    case "cohere":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={svgClass}>
          <circle cx="8" cy="9" r="3.2" />
          <circle cx="16" cy="9" r="3.2" opacity="0.7" />
          <rect x="5" y="14" width="14" height="5" rx="2.5" />
        </svg>
      );
    case "groq":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" className={svgClass}>
          <path d="M13 3L5 14H12L11 21L19 10H12L13 3Z" strokeLinejoin="round" />
        </svg>
      );
    case "perplexity":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={svgClass}>
          <path d="M12 3V21M4.5 12H19.5M6.2 6.2L17.8 17.8M17.8 6.2L6.2 17.8" strokeLinecap="round" />
        </svg>
      );
    case "openrouter":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={svgClass}>
          <path d="M4 12H10L14 7H20" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10 12L14 17H20" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M17.5 4.8L20 7L17.5 9.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M17.5 14.8L20 17L17.5 19.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "together":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={svgClass}>
          <circle cx="9.2" cy="12" r="5" />
          <circle cx="14.8" cy="12" r="5" />
        </svg>
      );
    case "fireworks":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={svgClass}>
          <circle cx="12" cy="12" r="2" fill="currentColor" />
          <path d="M12 3V7M12 17V21M3 12H7M17 12H21M5.6 5.6L8.5 8.5M15.5 15.5L18.4 18.4M18.4 5.6L15.5 8.5M8.5 15.5L5.6 18.4" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={svgClass}>
          <rect x="4" y="4" width="16" height="16" rx="4" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
  }
}

export function ProviderIcon({
  providerId,
  size = "md",
  className = "",
}: ProviderIconProps) {
  const palette = PROVIDER_PALETTE[providerId] ?? {
    bg: "bg-zinc-100",
    fg: "text-zinc-700",
    border: "border-zinc-200",
  };
  const sz = SIZE_CLASSES[size];

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center border ${sz.box} ${palette.bg} ${palette.fg} ${palette.border} ${className}`}
      aria-hidden="true"
    >
      {renderGlyph(providerId, sz.svg)}
    </span>
  );
}
