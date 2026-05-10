/**
 * Gemini — SSE streaming adapter (direct API)
 * Supports multiple Gemini models
 */

interface GeminiMessage {
  role: "user" | "assistant";
  content: string;
}

interface GeminiChunk {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
  }[];
}

// ─── Gemini models available with free API key ────────────────────────────────
export const GEMINI_MODELS: Record<string, { id: string; name: string; tag: string }> = {
  "gemini:2.0-flash":      { id: "gemini-2.0-flash",      name: "Gemini 2.0 Flash",      tag: "Fast" },
  "gemini:2.0-flash-lite": { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash Lite", tag: "Lightest" },
  "gemini:1.5-flash":      { id: "gemini-1.5-flash",      name: "Gemini 1.5 Flash",      tag: "Stable" },
  "gemini:1.5-flash-8b":   { id: "gemini-1.5-flash-8b",   name: "Gemini 1.5 Flash 8B",   tag: "Tiny" },
  "gemini:1.5-pro":        { id: "gemini-1.5-pro",        name: "Gemini 1.5 Pro",        tag: "Smart" },
};

export const DEFAULT_GEMINI_MODEL = "gemini:2.0-flash";

function getGeminiModelId(modelKey: string): string {
  return GEMINI_MODELS[modelKey]?.id ?? GEMINI_MODELS[DEFAULT_GEMINI_MODEL].id;
}

export async function* streamGemini(
  key: string,
  systemPrompt: string,
  messages: GeminiMessage[],
  modelKey = DEFAULT_GEMINI_MODEL
): AsyncGenerator<string> {
  const modelId = getGeminiModelId(modelKey);

  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?key=${key}&alt=sse`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    const err = new Error(`Gemini API error: ${errText}`);
    (err as unknown as { status: number }).status = res.status;
    throw err;
  }

  if (!res.body) throw new Error("No response body from Gemini");

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
        const parsed: GeminiChunk = JSON.parse(data);
        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) yield text;
      } catch {
        // skip malformed chunks
      }
    }
  }
}
