import type { ApiKeyDTO, LlmModelDTO, ProviderDTO } from "./types";

export type SnippetTab = "env" | "curl" | "typescript" | "python";

export function buildSnippet({
  tab,
  provider,
  model,
  apiKey,
  keyValue,
}: {
  tab: SnippetTab;
  provider: ProviderDTO;
  model: LlmModelDTO;
  apiKey: ApiKeyDTO | null;
  keyValue: string;
}): string {
  const envVar = apiKey?.effectiveEnvVar || provider.envVar;
  const baseUrl = (apiKey?.effectiveBaseUrl || provider.baseUrl).replace(/\/+$/, "");
  const modelId = model.apiModelId;

  if (tab === "env") {
    const lines = [
      `# ${provider.name} — ${model.name}${apiKey ? ` (${apiKey.label} · ${apiKey.environment})` : ""}`,
      `${envVar}="${keyValue}"`,
      `LLM_MODEL="${modelId}"`,
      `LLM_BASE_URL="${baseUrl}"`,
    ];
    return lines.join("\n");
  }

  // Anthropic Messages API
  if (provider.authStyle === "x-api-key") {
    if (tab === "curl") {
      return `curl ${baseUrl}/messages \\
  -H "x-api-key: ${keyValue}" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "content-type: application/json" \\
  -d '{
    "model": "${modelId}",
    "max_tokens": 512,
    "messages": [
      { "role": "user", "content": "Reply with OK from the test platform." }
    ]
  }'`;
    }

    if (tab === "typescript") {
      return `const response = await fetch("${baseUrl}/messages", {
  method: "POST",
  headers: {
    "x-api-key": "${keyValue}",
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  },
  body: JSON.stringify({
    model: "${modelId}",
    max_tokens: 512,
    messages: [{ role: "user", content: "Reply with OK from the test platform." }],
  }),
});

const data = await response.json();
console.log(data.content?.[0]?.text ?? data);`;
    }

    return `import anthropic

client = anthropic.Anthropic(api_key="${keyValue}")

message = client.messages.create(
    model="${modelId}",
    max_tokens=512,
    messages=[{"role": "user", "content": "Reply with OK from the test platform."}],
)
print(message.content[0].text)`;
  }

  // Google Gemini API
  if (provider.authStyle === "google-key") {
    if (tab === "curl") {
      return `curl "${baseUrl}/models/${modelId}:generateContent" \\
  -H "x-goog-api-key: ${keyValue}" \\
  -H "Content-Type: application/json" \\
  -X POST \\
  -d '{
    "contents": [
      { "parts": [{ "text": "Reply with OK from the test platform." }] }
    ]
  }'`;
    }

    if (tab === "typescript") {
      return `const response = await fetch(
  "${baseUrl}/models/${modelId}:generateContent",
  {
    method: "POST",
    headers: {
      "x-goog-api-key": "${keyValue}",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: "Reply with OK from the test platform." }] }],
    }),
  }
);

const data = await response.json();
console.log(data.candidates?.[0]?.content?.parts?.[0]?.text ?? data);`;
    }

    return `from google import genai

client = genai.Client(api_key="${keyValue}")
response = client.models.generate_content(
    model="${modelId}",
    contents="Reply with OK from the test platform.",
)
print(response.text)`;
  }

  // Cohere v2 Chat API
  if (provider.id === "cohere") {
    if (tab === "curl") {
      return `curl ${baseUrl}/chat \\
  -H "Authorization: Bearer ${keyValue}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${modelId}",
    "messages": [
      { "role": "user", "content": "Reply with OK from the test platform." }
    ]
  }'`;
    }

    if (tab === "typescript") {
      return `const response = await fetch("${baseUrl}/chat", {
  method: "POST",
  headers: {
    Authorization: "Bearer ${keyValue}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "${modelId}",
    messages: [{ role: "user", content: "Reply with OK from the test platform." }],
  }),
});

const data = await response.json();
console.log(data.message?.content?.[0]?.text ?? data);`;
    }

    return `import cohere

co = cohere.ClientV2(api_key="${keyValue}")
res = co.chat(
    model="${modelId}",
    messages=[{"role": "user", "content": "Reply with OK from the test platform."}],
)
print(res.message.content[0].text)`;
  }

  // Standard OpenAI-compatible Chat Completions (OpenAI, xAI, DeepSeek, Meta, Mistral, Qwen, Groq, Perplexity, OpenRouter, Together, Fireworks)
  if (tab === "curl") {
    return `curl ${baseUrl}/chat/completions \\
  -H "Authorization: Bearer ${keyValue}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${modelId}",
    "messages": [
      { "role": "user", "content": "Reply with OK from the test platform." }
    ]
  }'`;
  }

  if (tab === "typescript") {
    return `import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "${keyValue}",${provider.id !== "openai" || apiKey?.baseUrlOverride ? `\n  baseURL: "${baseUrl}",` : ""}
});

const completion = await client.chat.completions.create({
  model: "${modelId}",
  messages: [{ role: "user", content: "Reply with OK from the test platform." }],
});

console.log(completion.choices[0]?.message?.content);`;
  }

  return `from openai import OpenAI

client = OpenAI(
    api_key="${keyValue}",${provider.id !== "openai" || apiKey?.baseUrlOverride ? `\n    base_url="${baseUrl}",` : ""}
)

completion = client.chat.completions.create(
    model="${modelId}",
    messages=[{"role": "user", "content": "Reply with OK from the test platform."}],
)
print(completion.choices[0].message.content)`;
}
