import { useState, useRef, useEffect, useCallback } from "react";

interface Message {
  id: string | number;
  role: "user" | "assistant";
  content: string;
}

export function useChatStream(conversationId?: number) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (content: string, systemPrompt?: string) => {
    if (!conversationId) return;

    // Add user message optimistically
    const userMsgId = Date.now();
    setMessages(prev => [...prev, { id: userMsgId, role: "user", content }]);
    
    setIsStreaming(true);
    setError(null);

    // Add empty assistant message for streaming
    const assistantMsgId = Date.now() + 1;
    setMessages(prev => [...prev, { id: assistantMsgId, role: "assistant", content: "" }]);

    try {
      const response = await fetch(`${import.meta.env.BASE_URL}api/openai/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, systemPrompt }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

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
              }
            } catch (e) {
              console.error("Error parsing SSE data", e);
            }
          }
        }
      }
    } catch (err) {
      console.error("Streaming error:", err);
      setError("Failed to get response. Please try again.");
      setIsStreaming(false);
    }
  }, [conversationId]);

  return {
    messages,
    setMessages,
    sendMessage,
    isStreaming,
    error
  };
}
