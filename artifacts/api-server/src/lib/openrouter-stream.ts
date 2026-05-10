/**
 * OpenRouter — SSE streaming adapter
 * Supports ALL free models available on OpenRouter
 */

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ORChunk {
  choices?: { delta?: { content?: string }; finish_reason?: string }[];
}

// ─── All free OpenRouter models ───────────────────────────────────────────────
export const OR_MODELS: Record<string, { id: string; name: string; provider: string; tag: string }> = {
  // Google Gemini (via OpenRouter) — updated stable IDs
  "or:gemini-flash":     { id: "google/gemini-2.0-flash:free",               name: "Gemini 2.0 Flash",    provider: "Google",    tag: "Fast" },
  "or:gemini-pro":       { id: "google/gemini-2.5-pro-preview:free",          name: "Gemini 2.5 Pro",      provider: "Google",    tag: "Smart" },

  // DeepSeek (via OpenRouter)
  "or:deepseek-r1":      { id: "deepseek/deepseek-r1:free",                  name: "DeepSeek R1",         provider: "DeepSeek",  tag: "Reasoning" },
  "or:deepseek-v3":      { id: "deepseek/deepseek-chat-v3-0324:free",        name: "DeepSeek V3",         provider: "DeepSeek",  tag: "Chat" },

  // Meta Llama (via OpenRouter)
  "or:llama-70b":        { id: "meta-llama/llama-3.3-70b-instruct:free",     name: "Llama 3.3 70B",       provider: "Meta",      tag: "Open" },
  "or:llama-8b":         { id: "meta-llama/llama-3.1-8b-instruct:free",      name: "Llama 3.1 8B",        provider: "Meta",      tag: "Light" },

  // Mistral (via OpenRouter)
  "or:mistral-7b":       { id: "mistralai/mistral-7b-instruct:free",         name: "Mistral 7B",          provider: "Mistral",   tag: "Efficient" },
  "or:mistral-small":    { id: "mistralai/mistral-small-3.1-24b-instruct:free", name: "Mistral Small 24B", provider: "Mistral",   tag: "Balanced" },

  // Qwen (via OpenRouter)
  "or:qwen3-235b":       { id: "qwen/qwen3-235b-a22b:free",                  name: "Qwen3 235B",          provider: "Alibaba",   tag: "Huge" },
  "or:qwen3-30b":        { id: "qwen/qwen3-30b-a3b:free",                    name: "Qwen3 30B",           provider: "Alibaba",   tag: "Large" },
  "or:qwen3-14b":        { id: "qwen/qwen3-14b:free",                        name: "Qwen3 14B",           provider: "Alibaba",   tag: "Medium" },
  "or:qwen3-8b":         { id: "qwen/qwen3-8b:free",                         name: "Qwen3 8B",            provider: "Alibaba",   tag: "Light" },

  // Microsoft Phi (via OpenRouter)
  "or:phi3-mini":        { id: "microsoft/phi-3-mini-128k-instruct:free",    name: "Phi-3 Mini 128K",     provider: "Microsoft", tag: "Tiny" },
  "or:phi3-medium":      { id: "microsoft/phi-3-medium-128k-instruct:free",  name: "Phi-3 Medium 128K",   provider: "Microsoft", tag: "Medium" },

  // NousResearch (via OpenRouter)
  "or:hermes-405b":      { id: "nousresearch/hermes-3-llama-3.1-405b:free",  name: "Hermes 3 405B",       provider: "Nous",      tag: "Giant" },

  // OpenChat (via OpenRouter)
  "or:openchat":         { id: "openchat/openchat-7b:free",                  name: "OpenChat 7B",         provider: "OpenChat",  tag: "Chat" },
};

// Default = Llama 70B — most stable free model on OpenRouter
export const DEFAULT_OR_MODEL = "or:llama-70b";

export function getORModelId(key: string): string {
  return OR_MODELS[key]?.id ?? OR_MODELS[DEFAULT_OR_MODEL].id;
}

export async function* streamOpenRouter(
  apiKey: string,
  systemPrompt: string,
  messages: ChatMessage[],
  modelKey = DEFAULT_OR_MODEL,
  maxTokens = 2048
): AsyncGenerator<string> {
  const modelId = getORModelId(modelKey);

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://universe-ai.replit.app",
      "X-Title": "Universe AI",
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      max_tokens: maxTokens,
      stream: true,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    const err = new Error(`OpenRouter error ${res.status}: ${errText}`);
    (err as unknown as { status: number }).status = res.status;
    throw err;
  }

  if (!res.body) throw new Error("No response body from OpenRouter");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") return;
      try {
        const parsed: ORChunk = JSON.parse(data);
        const text = parsed.choices?.[0]?.delta?.content;
        if (text) yield text;
      } catch {
        // skip malformed chunks
      }
    }
  }
}
