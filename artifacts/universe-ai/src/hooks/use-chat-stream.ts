import { useState, useRef, useCallback } from "react";

export interface ChatMessage {
  id: string | number;
  role: "user" | "assistant";
  content: string;
  imageB64?: string;
}

export function useChatStream(conversationId?: number) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  }, []);

  const sendMessage = useCallback(async (content: string, systemPrompt?: string, model?: string) => {
    if (!conversationId) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const userMsgId = `user-${Date.now()}`;
    setMessages(prev => [...prev, { id: userMsgId, role: "user", content }]);

    setIsStreaming(true);
    setError(null);

    const assistantMsgId = `asst-${Date.now()}`;
    setMessages(prev => [...prev, { id: assistantMsgId, role: "assistant", content: "" }]);

    try {
      const response = await fetch(
        `${import.meta.env.BASE_URL}api/openai/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, systemPrompt, model }),
          signal: abortController.signal,
        }
      );

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                setMessages(prev =>
                  prev.map(msg =>
                    msg.id === assistantMsgId
                      ? { ...msg, content: msg.content + data.content }
                      : msg
                  )
                );
              }
              if (data.done) {
                setIsStreaming(false);
                abortControllerRef.current = null;
              }
            } catch {
            }
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        setMessages(prev =>
          prev.map(msg =>
            msg.role === "assistant" && msg.content === ""
              ? { ...msg, content: "[Response interrupted]" }
              : msg
          )
        );
      } else {
        setError("Failed to get response. Please try again.");
      }
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [conversationId]);

  const sendImageMessage = useCallback(async (prompt: string) => {
    const userMsgId = `user-${Date.now()}`;
    setMessages(prev => [...prev, { id: userMsgId, role: "user", content: prompt }]);
    setIsStreaming(true);
    setError(null);

    const assistantMsgId = `asst-img-${Date.now()}`;
    setMessages(prev => [...prev, { id: assistantMsgId, role: "assistant", content: "Generating image..." }]);

    try {
      const response = await fetch(`${import.meta.env.BASE_URL}api/openai/generate-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, size: "1024x1024" }),
      });

      if (!response.ok) throw new Error("Image generation failed");
      const data = await response.json();

      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMsgId
            ? { ...msg, content: `Image generated for: "${prompt}"`, imageB64: data.b64_json }
            : msg
        )
      );
    } catch {
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMsgId
            ? { ...msg, content: "Failed to generate image. Please try again." }
            : msg
        )
      );
      setError("Image generation failed.");
    } finally {
      setIsStreaming(false);
    }
  }, []);

  return {
    messages,
    setMessages,
    sendMessage,
    sendImageMessage,
    stopStream,
    isStreaming,
    error,
  };
}
