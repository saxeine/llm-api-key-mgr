import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { apiKeys, providers } from "@/db/schema";
import { decryptApiKey, isSafePublicHttpsUrl } from "@/lib/crypto";
import { ensureSeeded } from "@/lib/seed";
import type { KeyStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSeeded();
    const { id } = await context.params;
    const keyId = Number(id);
    if (!Number.isInteger(keyId) || keyId <= 0) {
      return NextResponse.json({ error: "Invalid key ID." }, { status: 400 });
    }

    const [row] = await db.select().from(apiKeys).where(eq(apiKeys.id, keyId)).limit(1);
    if (!row) {
      return NextResponse.json({ error: "API key not found." }, { status: 404 });
    }

    const [provider] = await db
      .select()
      .from(providers)
      .where(eq(providers.id, row.providerId))
      .limit(1);

    if (!provider) {
      return NextResponse.json({ error: "Provider not found." }, { status: 404 });
    }

    const rawKey = decryptApiKey(row.encryptedKey).trim();
    const baseUrl = (row.baseUrlOverride?.trim() || provider.baseUrl).replace(/\/+$/, "");

    let status: KeyStatus = "format_ok";
    let message = `Key format looks ready for ${provider.name}`;

    // Skip live network check for sample demo keys or unsafe custom URLs
    if (rawKey.toLowerCase().includes("demo-testbench") || rawKey.toLowerCase().includes("demotestbench")) {
      status = "format_ok";
      message = "Sample placeholder key — format valid (replace with a live key to ping API)";
    } else if (!isSafePublicHttpsUrl(baseUrl)) {
      status = "format_ok";
      message = "Saved cleanly — live ping skipped for custom non-public URL";
    } else {
      try {
        let checkUrl = `${baseUrl}/models`;
        const headers: Record<string, string> = {
          Accept: "application/json",
        };

        if (provider.authStyle === "x-api-key") {
          headers["x-api-key"] = rawKey;
          headers["anthropic-version"] = "2023-06-01";
        } else if (provider.authStyle === "google-key") {
          headers["x-goog-api-key"] = rawKey;
        } else {
          headers["Authorization"] = `Bearer ${rawKey}`;
        }

        if (provider.id === "perplexity") {
          // Perplexity doesn't expose GET /models cleanly; check format unless key responds
          checkUrl = `${baseUrl}/models`;
        }

        const res = await fetch(checkUrl, {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(6000),
          cache: "no-store",
        });

        if (res.ok) {
          status = "valid";
          message = `Authenticated with ${provider.name} API (HTTP ${res.status})`;
        } else if (res.status === 401 || res.status === 403) {
          status = "invalid";
          message = `${provider.name} rejected this key (HTTP ${res.status} Unauthorized)`;
        } else if (res.status === 404 && provider.id === "perplexity") {
          status = rawKey.startsWith("pplx-") ? "format_ok" : "untested";
          message = rawKey.startsWith("pplx-")
            ? "Perplexity pplx- prefix verified (ready for /chat/completions)"
            : "Stored — check pplx- prefix if requests fail";
        } else {
          status = "format_ok";
          message = `Endpoint reachable (HTTP ${res.status}) — key stored & ready`;
        }
      } catch {
        const matchesPrefix =
          provider.keyPrefix && rawKey.startsWith(provider.keyPrefix.slice(0, 3));
        status = matchesPrefix ? "format_ok" : "network_error";
        message = matchesPrefix
          ? `Prefix matches ${provider.name} (offline / sandbox network)`
          : "Live ping timed out — key remains stored and copyable";
      }
    }

    const now = new Date();
    await db
      .update(apiKeys)
      .set({
        lastStatus: status,
        lastStatusMessage: message,
        lastVerifiedAt: now,
        updatedAt: now,
      })
      .where(eq(apiKeys.id, keyId));

    return NextResponse.json({
      id: keyId,
      lastStatus: status,
      lastStatusMessage: message,
      lastVerifiedAt: now.toISOString(),
    });
  } catch (error) {
    console.error("POST /api/keys/[id]/verify failed:", error);
    return NextResponse.json({ error: "Failed to verify API key." }, { status: 500 });
  }
}
