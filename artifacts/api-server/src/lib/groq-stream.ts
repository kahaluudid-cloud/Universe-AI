/**
 * Groq — SSE streaming adapter (OpenAI-compatible API)
 * All free Groq models supported
 */

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface GroqChunk {
  choices?: { delta?: { content?: string }; finish_reason?: string }[];
}

// ─── All free Groq models ─────────────────────────────────────────────────────
export const GROQ_MODELS: Record<string, { id: string; name: string; tag: string }> = {
  "groq:llama3.3-70b":    { id: "llama-3.3-70b-versatile",          name: "Llama 3.3 70B",         tag: "Best" },
  "groq:llama3.1-8b":     { id: "llama-3.1-8b-instant",             name: "Llama 3.1 8B",          tag: "Fastest" },
  "groq:llama3-70b":      { id: "llama3-70b-8192",                  name: "Llama 3 70B",           tag: "Smart" },
  "groq:llama3-8b":       { id: "llama3-8b-8192",                   name: "Llama 3 8B",            tag: "Light" },
  "groq:gemma2-9b":       { id: "gemma2-9b-it",                     name: "Gemma 2 9B",            tag: "Google" },
  "groq:mixtral-8x7b":    { id: "mixtral-8x7b-32768",               name: "Mixtral 8x7B",          tag: "MoE" },
  "groq:deepseek-r1":     { id: "deepseek-r1-distill-llama-70b",    name: "DeepSeek R1 (Groq)",    tag: "Reasoning" },
};

// 8B instant = 14,400 req/day (vs 70B which hits token limits faster)
export const DEFAULT_GROQ_MODEL = "groq:llama3.1-8b";

function getGroqModelId(modelKey: string): string {
  return GROQ_MODELS[modelKey]?.id ?? GROQ_MODELS[DEFAULT_GROQ_MODEL].id;
}

export async function* streamGroq(
  key: string,
  systemPrompt: string,
  messages: ChatMessage[],
  modelKey = DEFAULT_GROQ_MODEL,
  maxTokens = 2048
): AsyncGenerator<string> {
  const modelId = getGroqModelId(modelKey);

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      max_tokens: maxTokens,
      temperature: 0.8,
      stream: true,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    const err = new Error(`Groq API error: ${errText}`);
    (err as unknown as { status: number }).status = res.status;
    throw err;
  }

  if (!res.body) throw new Error("No response body from Groq");

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
        const parsed: GroqChunk = JSON.parse(data);
        const text = parsed.choices?.[0]?.delta?.content;
        if (text) yield text;
      } catch {
        // skip malformed chunks
      }
    }
  }
}
