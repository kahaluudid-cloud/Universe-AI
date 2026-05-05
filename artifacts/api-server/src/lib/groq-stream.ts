/**
 * Groq Llama 3 — SSE streaming adapter (OpenAI-compatible API)
 * Used as primary for Manish Chat (fast human-like responses)
 */

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface GroqChunk {
  choices?: { delta?: { content?: string }; finish_reason?: string }[];
}

export async function* streamGroq(
  key: string,
  systemPrompt: string,
  messages: ChatMessage[],
  model = "llama3-70b-8192"
): AsyncGenerator<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      max_tokens: 8192,
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
        // Skip malformed chunks
      }
    }
  }
}
