import { useState, useEffect, useRef, useCallback } from "react";
import { Send, StopCircle, Bot, User, Copy, Check, Download, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useChatStream, type ChatMessage } from "@/hooks/use-chat-stream";
import { useGetOpenaiConversation } from "@workspace/api-client-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

interface ChatInterfaceProps {
  conversationId?: number;
  title: string;
  systemPrompt?: string;
  placeholder?: string;
  headerContent?: React.ReactNode;
  emptyStateContent?: React.ReactNode;
  onNewMessage?: (content: string) => void;
  brandColor?: "primary" | "secondary" | "accent";
  onMessagesChange?: (messages: ChatMessage[]) => void;
  enableImageGen?: boolean;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/20 text-gray-300 transition-colors"
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function MessageContent({ content, imageB64 }: { content: string; imageB64?: string }) {
  if (imageB64) {
    const dataUrl = `data:image/png;base64,${imageB64}`;
    const handleDownload = () => {
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "universe-ai-image.png";
      a.click();
    };
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{content}</p>
        <img src={dataUrl} alt="AI Generated" className="rounded-lg max-w-sm w-full border border-border" />
        <Button size="sm" variant="outline" onClick={handleDownload} className="gap-2 text-xs">
          <Download className="w-3 h-3" /> Download Image
        </Button>
      </div>
    );
  }

  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2">
      {parts.map((part, i) => {
        if (part.startsWith("```")) {
          const match = part.match(/```(\w*)\n?([\s\S]*?)```/);
          if (match) {
            const lang = match[1] || "text";
            const code = match[2].trim();
            return (
              <div key={i} className="rounded-lg overflow-hidden border border-white/10 text-sm">
                <div className="flex items-center justify-between px-4 py-2 bg-[#1a1a2e] border-b border-white/10">
                  <span className="text-xs text-muted-foreground font-mono">{lang || "code"}</span>
                  <CopyButton text={code} />
                </div>
                <SyntaxHighlighter
                  language={lang}
                  style={oneDark}
                  customStyle={{ margin: 0, borderRadius: 0, background: "#0d0d1a", fontSize: "0.8rem" }}
                  wrapLongLines
                >
                  {code}
                </SyntaxHighlighter>
              </div>
            );
          }
        }

        if (!part.trim()) return null;

        const lines = part.split("\n");
        return (
          <div key={i} className="whitespace-pre-wrap leading-relaxed">
            {lines.map((line, j) => {
              if (line.startsWith("### ")) return <h3 key={j} className="font-bold text-base mt-3 mb-1">{line.slice(4)}</h3>;
              if (line.startsWith("## ")) return <h2 key={j} className="font-bold text-lg mt-3 mb-1">{line.slice(3)}</h2>;
              if (line.startsWith("# ")) return <h1 key={j} className="font-bold text-xl mt-3 mb-1">{line.slice(2)}</h1>;
              if (line.startsWith("- ") || line.startsWith("* ")) {
                return <div key={j} className="flex gap-2"><span className="text-primary mt-1">•</span><span>{line.slice(2)}</span></div>;
              }
              if (line.match(/^\d+\. /)) {
                const numMatch = line.match(/^(\d+)\. (.*)/);
                if (numMatch) return <div key={j} className="flex gap-2"><span className="text-primary">{numMatch[1]}.</span><span>{numMatch[2]}</span></div>;
              }
              const boldLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code class="bg-white/10 px-1 rounded text-xs font-mono">$1</code>');
              return <p key={j} dangerouslySetInnerHTML={{ __html: boldLine || "&nbsp;" }} />;
            })}
          </div>
        );
      })}
    </div>
  );
}

const IMAGE_KEYWORDS = ["generate image", "create image", "make image", "draw", "paint", "illustrate", "show me a picture", "generate a picture", "image of", "picture of", "/imagine"];

function detectImageRequest(text: string): boolean {
  const lower = text.toLowerCase();
  return IMAGE_KEYWORDS.some(kw => lower.includes(kw));
}

export function ChatInterface({
  conversationId,
  title,
  systemPrompt,
  placeholder = "Type your message...",
  headerContent,
  emptyStateContent,
  onNewMessage,
  brandColor = "primary",
  onMessagesChange,
  enableImageGen = false,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: conversation, isLoading: isLoadingHistory } = useGetOpenaiConversation(
    conversationId as number,
    { query: { enabled: !!conversationId } }
  );

  const { messages, setMessages, sendMessage, sendImageMessage, stopStream, isStreaming, error } = useChatStream(conversationId);

  useEffect(() => {
    onMessagesChange?.(messages);
  }, [messages, onMessagesChange]);

  useEffect(() => {
    if (conversation?.messages) {
      setMessages(
        conversation.messages.map(m => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
        }))
      );
    }
  }, [conversation?.messages, setMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    if (!conversationId && onNewMessage) {
      onNewMessage(trimmed);
      setInput("");
      return;
    }

    if (isStreaming) {
      stopStream();
    }

    if (enableImageGen && detectImageRequest(trimmed)) {
      sendImageMessage(trimmed);
    } else {
      sendMessage(trimmed, systemPrompt);
    }
    setInput("");
  }, [input, conversationId, onNewMessage, isStreaming, stopStream, enableImageGen, sendImageMessage, sendMessage, systemPrompt]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const brandBgClass = {
    primary: "bg-primary/20 text-primary",
    secondary: "bg-secondary/20 text-secondary",
    accent: "bg-accent/20 text-accent",
  }[brandColor];

  return (
    <div className="flex flex-col h-full bg-background relative overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-background/80 backdrop-blur-sm z-10">
        <h1 className="text-xl font-bold text-white tracking-tight">{title}</h1>
        {headerContent}
      </div>

      <div className="flex-1 overflow-y-auto p-4" ref={scrollRef}>
        {isLoadingHistory ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-2xl mx-auto space-y-6">
            {emptyStateContent}
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6 pb-24">
            {messages.map((msg, idx) => (
              <div
                key={msg.id || idx}
                className={`flex gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${brandBgClass}`}>
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                <div className={`px-4 py-3 rounded-2xl max-w-[85%] text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-card border border-border text-card-foreground rounded-tl-sm"
                }`}>
                  <MessageContent content={msg.content} imageB64={msg.imageB64} />
                </div>

                {msg.role === "user" && (
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}

            {isStreaming && messages[messages.length - 1]?.content === "" && (
              <div className="flex gap-4 justify-start">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${brandBgClass}`}>
                  <Bot className="h-4 w-4" />
                </div>
                <div className="px-4 py-3 rounded-2xl bg-card border border-border text-card-foreground rounded-tl-sm flex items-center gap-2">
                  <span className="h-2 w-2 bg-primary rounded-full animate-bounce" />
                  <span className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                  <span className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0.4s" }} />
                </div>
              </div>
            )}

            {error && (
              <div className="text-destructive text-center p-4 border border-destructive/50 rounded-lg bg-destructive/10 text-sm">
                {error}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-4 bg-gradient-to-t from-background via-background to-transparent border-t border-border/50 absolute bottom-0 left-0 right-0">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="relative flex items-end gap-2 bg-card border border-border rounded-xl p-2 focus-within:ring-1 focus-within:ring-primary transition-all">
            {enableImageGen && (
              <div className="p-3 text-muted-foreground">
                <ImageIcon className="w-4 h-4" />
              </div>
            )}
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isStreaming ? "Type to interrupt and send a new message..." : placeholder}
              className="min-h-[52px] max-h-32 resize-none border-0 focus-visible:ring-0 bg-transparent text-white p-3"
            />
            <Button
              type={isStreaming ? "button" : "submit"}
              size="icon"
              onClick={isStreaming ? stopStream : undefined}
              disabled={!isStreaming && !input.trim() && !conversationId}
              className={`shrink-0 h-10 w-10 rounded-lg mb-1 mr-1 ${isStreaming ? "bg-destructive hover:bg-destructive/80" : ""}`}
            >
              {isStreaming ? <StopCircle className="h-5 w-5" /> : <Send className="h-5 w-5" />}
            </Button>
          </form>
          <p className="text-center mt-2 text-xs text-muted-foreground">
            {isStreaming ? "Press Stop or type to interrupt." : "Universe AI · Built by Manish Kumar Chaturvedi"}
          </p>
        </div>
      </div>
    </div>
  );
}
