/**
 * OpenRouter — SSE streaming adapter (OpenAI-compatible API)
 * Free models: gemini-2.0-flash, llama-3.3-70b, deepseek-r1, mistral-7b
 */

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ORChunk {
  choices?: { delta?: { content?: string }; finish_reason?: string }[];
}

export const OPENROUTER_MODELS = {
  smart: "google/gemini-2.0-flash-exp:free",
  fast: "meta-llama/llama-3.3-70b-instruct:free",
  coding: "deepseek/deepseek-r1:free",
  chat: "mistralai/mistral-7b-instruct:free",
};

export async function* streamOpenRouter(
  key: string,
  systemPrompt: string,
  messages: ChatMessage[],
  model = OPENROUTER_MODELS.smart
): AsyncGenerator<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "HTTP-Referer": "https://universe-ai.replit.app",
      "X-Title": "Universe AI",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      max_tokens: 8192,
      stream: true,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    const err = new Error(`OpenRouter API error ${res.status}: ${errText}`);
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
