import { useState, useEffect, useRef } from "react";
import { Send, Loader2, Bot, User, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatStream } from "@/hooks/use-chat-stream";
import { useGetOpenaiConversation } from "@workspace/api-client-react";

interface ChatInterfaceProps {
  conversationId?: number;
  title: string;
  systemPrompt?: string;
  placeholder?: string;
  headerContent?: React.ReactNode;
  emptyStateContent?: React.ReactNode;
  onNewMessage?: (content: string) => void;
  brandColor?: "primary" | "secondary" | "accent";
}

export function ChatInterface({
  conversationId,
  title,
  systemPrompt,
  placeholder = "Type your message...",
  headerContent,
  emptyStateContent,
  onNewMessage,
  brandColor = "primary"
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { data: conversation, isLoading: isLoadingHistory } = useGetOpenaiConversation(
    conversationId as number,
    { query: { enabled: !!conversationId } }
  );

  const { messages, setMessages, sendMessage, isStreaming, error } = useChatStream(conversationId);

  // Sync history
  useEffect(() => {
    if (conversation?.messages) {
      setMessages(conversation.messages.map(m => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content
      })));
    }
  }, [conversation?.messages, setMessages]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    
    if (!conversationId && onNewMessage) {
      onNewMessage(input);
      setInput("");
      return;
    }

    sendMessage(input, systemPrompt);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const brandColorClass = {
    primary: "text-primary border-primary",
    secondary: "text-secondary border-secondary",
    accent: "text-accent border-accent"
  }[brandColor];

  const brandBgClass = {
    primary: "bg-primary/20 text-primary",
    secondary: "bg-secondary/20 text-secondary",
    accent: "bg-accent/20 text-accent"
  }[brandColor];

  return (
    <div className="flex flex-col h-full bg-background relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-background/80 backdrop-blur-sm z-10">
        <h1 className="text-xl font-bold text-white tracking-tight">{title}</h1>
        {headerContent}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4" ref={scrollRef}>
        {isLoadingHistory ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-2xl mx-auto space-y-6">
            {emptyStateContent}
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6 pb-20">
            {messages.map((msg, idx) => (
              <div
                key={msg.id || idx}
                className={`flex gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${brandBgClass}`}>
                    <Bot className="h-5 w-5" />
                  </div>
                )}
                
                <div className={`px-4 py-3 rounded-2xl max-w-[80%] ${
                  msg.role === "user" 
                    ? "bg-primary text-primary-foreground rounded-tr-sm" 
                    : "bg-card border border-border text-card-foreground rounded-tl-sm"
                }`}>
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>

                {msg.role === "user" && (
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <User className="h-5 w-5" />
                  </div>
                )}
              </div>
            ))}
            
            {isStreaming && messages[messages.length - 1]?.role === "user" && (
              <div className="flex gap-4 justify-start">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${brandBgClass}`}>
                  <Bot className="h-5 w-5" />
                </div>
                <div className="px-4 py-3 rounded-2xl bg-card border border-border text-card-foreground rounded-tl-sm flex items-center gap-2">
                  <span className="h-2 w-2 bg-primary rounded-full animate-bounce"></span>
                  <span className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></span>
                  <span className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></span>
                </div>
              </div>
            )}
            
            {error && (
              <div className="text-destructive text-center p-4 border border-destructive/50 rounded-lg bg-destructive/10">
                {error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-gradient-to-t from-background via-background to-transparent border-t border-border/50">
        <div className="max-w-4xl mx-auto relative">
          <form onSubmit={handleSubmit} className="relative flex items-end gap-2 bg-card border border-border rounded-xl p-2 focus-within:ring-1 focus-within:ring-primary transition-all">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="min-h-[56px] max-h-32 resize-none border-0 focus-visible:ring-0 bg-transparent text-white p-3 py-3"
              disabled={isStreaming}
            />
            <Button 
              type="submit" 
              size="icon" 
              disabled={!input.trim() || isStreaming || (!conversationId && !onNewMessage)}
              className="shrink-0 h-10 w-10 rounded-lg mb-1 mr-1"
            >
              {isStreaming ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </Button>
          </form>
          <div className="text-center mt-2 text-xs text-muted-foreground">
            Universe AI is powerful but can make mistakes. Consider verifying important information.
          </div>
        </div>
      </div>
    </div>
  );
}
