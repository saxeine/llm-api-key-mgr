export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below for restricted iframe or HTTP contexts
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Recently";
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 15) return "Just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export const ENV_BADGE_STYLES: Record<string, string> = {
  test: "bg-indigo-50 text-indigo-700 border-indigo-200/80",
  dev: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
  staging: "bg-amber-50 text-amber-700 border-amber-200/80",
  sandbox: "bg-zinc-100 text-zinc-700 border-zinc-200",
};

export const CATEGORY_BADGE_STYLES: Record<string, string> = {
  flagship: "bg-indigo-50/80 text-indigo-700 border-indigo-200/70",
  reasoning: "bg-violet-50/80 text-violet-700 border-violet-200/70",
  fast: "bg-emerald-50/80 text-emerald-700 border-emerald-200/70",
  coding: "bg-sky-50/80 text-sky-700 border-sky-200/70",
  "open-weights": "bg-amber-50/80 text-amber-800 border-amber-200/70",
  search: "bg-cyan-50/80 text-cyan-700 border-cyan-200/70",
  router: "bg-zinc-100 text-zinc-700 border-zinc-200",
};
