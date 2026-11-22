import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const APP_SALT = "keybench-llm-test-vault-v1";

let cachedSecretKey: Buffer | null = null;

function getSecretKey(): Buffer {
  if (cachedSecretKey) return cachedSecretKey;
  const seed =
    process.env.KEY_VAULT_SECRET ||
    process.env.DATABASE_URL ||
    "keybench-default-local-seed";
  cachedSecretKey = scryptSync(seed, APP_SALT, 32);
  return cachedSecretKey;
}

export function encryptApiKey(rawKey: string): string {
  const key = getSecretKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(rawKey, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `v1:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptApiKey(payload: string): string {
  if (!payload.startsWith("v1:")) {
    return payload;
  }
  const parts = payload.split(":");
  if (parts.length !== 4) {
    throw new Error("Invalid encrypted key format");
  }
  const [, ivHex, tagHex, dataHex] = parts;
  const key = getSecretKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

const KNOWN_PREFIXES = [
  "sk-or-v1-",
  "sk-proj-",
  "sk-ant-",
  "sk-svcacct-",
  "fw_3Z",
  "pplx-",
  "AIzaSy",
  "AIza",
  "gsk_",
  "xai-",
  "fw_",
  "sk-",
  "r8_",
];

export function maskApiKey(rawKey: string): string {
  const trimmed = rawKey.trim();
  if (trimmed.length <= 8) {
    if (trimmed.length <= 3) return "••••••••";
    return `${trimmed.slice(0, 2)}••••••${trimmed.slice(-1)}`;
  }

  const matchedPrefix = KNOWN_PREFIXES.find(
    (p) => trimmed.startsWith(p) && trimmed.length > p.length + 6
  );

  if (matchedPrefix) {
    return `${matchedPrefix}••••••••${trimmed.slice(-4)}`;
  }

  if (trimmed.length <= 14) {
    return `${trimmed.slice(0, 4)}••••••${trimmed.slice(-3)}`;
  }

  return `${trimmed.slice(0, 7)}••••••••${trimmed.slice(-4)}`;
}

export function detectProviderFromKey(rawKey: string): string | null {
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

export function isSafePublicHttpsUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      host === "[::1]" ||
      host.endsWith(".local") ||
      host.endsWith(".internal")
    ) {
      return false;
    }
    const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
      const [, a, b] = ipv4Match.map(Number);
      if (
        a === 10 ||
        a === 127 ||
        a === 0 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168)
      ) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}
