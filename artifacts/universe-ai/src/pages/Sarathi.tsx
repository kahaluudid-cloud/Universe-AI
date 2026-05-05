import { Shell } from "@/components/layout/Shell";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { useRoute, useLocation } from "wouter";
import {
  useCreateOpenaiConversation,
  useListOpenaiConversations,
  getListOpenaiConversationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bot, MessageSquare, Plus, Image as ImageIcon, BookOpen,
  Presentation, ChevronDown, Sparkles, Download, User, Check,
  Cpu, Zap,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState, useCallback } from "react";
import { type ChatMessage } from "@/hooks/use-chat-stream";
import { MessageContent } from "@/components/chat/ChatInterface";
import { downloadAsPdf } from "@/lib/download-pdf";
import { downloadAsPpt } from "@/lib/download-ppt";
import { useNotifications } from "@/contexts/notifications";
import { useCreativityStore } from "@/contexts/creativity-store";

const MODELS = [
  { id: "gpt", name: "ChatGPT", label: "OpenAI GPT-5.4", color: "#10a37f", icon: "G", tag: "Smart" },
  { id: "claude", name: "Claude", label: "Anthropic Claude", color: "#d97706", icon: "C", tag: "Creative" },
  { id: "gemini", name: "Gemini", label: "Google Gemini", color: "#4285f4", icon: "Ge", tag: "Fast" },
  { id: "deepseek", name: "DeepSeek", label: "DeepSeek AI", color: "#7c3aed", icon: "D", tag: "Coding" },
  { id: "llama", name: "Llama 3", label: "Meta Llama 3", color: "#0ea5e9", icon: "L", tag: "Open" },
  { id: "mistral", name: "Mistral", label: "Mistral AI", color: "#f59e0b", icon: "M", tag: "Light" },
  { id: "perplexity", name: "Perplexity", label: "Perplexity Pro", color: "#22d3ee", icon: "P", tag: "Search" },
];

const MODEL_PERSONAS: Record<string, string> = {
  gpt: "You are Sarathi using the ChatGPT (OpenAI) model. Be comprehensive, structured, and professional.",
  claude: "You are Sarathi using Claude (Anthropic). Be thoughtful, nuanced, and creatively detailed.",
  gemini: "You are Sarathi using Gemini (Google). Be fast, factual, and multimodal-aware.",
  deepseek: "You are Sarathi using DeepSeek. Prioritize coding accuracy, technical depth, and logical reasoning.",
  llama: "You are Sarathi using Llama 3 (Meta). Be open, balanced, and straightforward.",
  mistral: "You are Sarathi using Mistral AI. Be concise, efficient, and direct.",
  perplexity: "You are Sarathi using Perplexity Pro. Always reference knowledge accurately and be search-aware.",
};

const BASE_SYSTEM = `Aap Universe AI ke Sarathi hain — ek advanced AI brain jo coding, research, image generation, aur academic writing mein expert hai.

Aap Hinglish (Hindi + English mix) mein baat karte hain. Hindi mein jawab dete hain jab user Hindi/Hinglish mein likhta hai.

Capabilities:
- Full-stack code generation aur debugging (proper markdown code blocks with language tag)
- Textbook writing (500+ pages, structured chapters)
- PPT/presentation creation (50+ slides, "## Slide N: Title" format use karo)
- Image generation (user "generate image" ya "/imagine" likhe toh)
- UPSC preparation aur competitive exams
- Research aur academic writing

Jab textbook likhna ho:
- Start with "# Book Title"
- Use "## Chapter N: Title" for chapters
- Use "### Section Title" for sections
- Write detailed, structured content

Jab PPT banana ho:
- Start with "# Presentation Title"  
- Use "## Slide N: Title" format for EVERY slide
- Each slide mein 3-5 bullet points dena ("- point" format)
- 20+ slides minimum banana

Creator: Manish Kumar Chaturvedi, Oteband, Balod, Chhattisgarh, India.`;

function detectContentType(content: string): "textbook" | "ppt" | "none" {
  const slideMatches = (content.match(/^##\s+slide\s+\d+/gim) || []).length;
  if (slideMatches >= 3) return "ppt";

  const chapterMatches = (content.match(/^##\s+chapter\s+\d+/gim) || []).length;
  const h2Count = (content.match(/^##\s+/gm) || []).length;
  const wordCount = content.split(/\s+/).length;
  if (chapterMatches >= 2 || (h2Count >= 4 && wordCount > 800)) return "textbook";

  return "none";
}

function SarathiMessageRenderer(
  msg: ChatMessage,
  brandBgClass: string,
  onDownloadPdf: (content: string) => void,
  onDownloadPpt: (content: string) => void
): React.ReactNode | null {
  if (msg.role === "user") {
    return (
      <div className="flex gap-4 justify-end">
        <div className="px-4 py-3 rounded-2xl max-w-[80%] text-sm bg-primary text-primary-foreground rounded-tr-sm">
          <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
        </div>
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1">
          <User className="h-4 w-4" />
        </div>
      </div>
    );
  }

  const contentType = detectContentType(msg.content);

  if (contentType === "textbook") {
    const wordCount = msg.content.split(/\s+/).length;
    const chapterCount = (msg.content.match(/^##\s+chapter/gim) || []).length;
    const pageEst = Math.ceil(wordCount / 250);

    return (
      <div className="flex gap-3 justify-start">
        <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${brandBgClass}`}>
          <Bot className="h-4 w-4" />
        </div>
        <div className="flex-1 max-w-[85%] space-y-2">
          <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-card border border-border text-sm">
            <MessageContent content={msg.content.slice(0, 300) + (msg.content.length > 300 ? "…" : "")} />
          </div>
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-primary">Textbook Generated</span>
              <span className="ml-auto text-xs text-muted-foreground bg-primary/10 px-2 py-0.5 rounded-full">
                ~{pageEst} pages
              </span>
            </div>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-primary" />{chapterCount || "Multiple"} chapters</span>
              <span>{wordCount.toLocaleString()} words</span>
            </div>
            <Button
              size="sm"
              onClick={() => onDownloadPdf(msg.content)}
              className="gap-2 text-xs bg-primary hover:bg-primary/90 h-8"
            >
              <Download className="w-3.5 h-3.5" /> Download PDF Textbook
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (contentType === "ppt") {
    const slideCount = (msg.content.match(/^##\s+slide\s+\d+/gim) || []).length;

    return (
      <div className="flex gap-3 justify-start">
        <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${brandBgClass}`}>
          <Bot className="h-4 w-4" />
        </div>
        <div className="flex-1 max-w-[85%] space-y-2">
          <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-card border border-border text-sm">
            <MessageContent content={msg.content.slice(0, 250) + (msg.content.length > 250 ? "…" : "")} />
          </div>
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Presentation className="w-4 h-4 text-accent" />
              <span className="text-sm font-semibold text-accent">Presentation Created</span>
              <span className="ml-auto text-xs text-muted-foreground bg-accent/10 px-2 py-0.5 rounded-full text-accent">
                {slideCount} slides
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Arrow keys se navigate karo · Full-screen presentation
            </p>
            <Button
              size="sm"
              onClick={() => onDownloadPpt(msg.content)}
              className="gap-2 text-xs bg-accent text-accent-foreground hover:bg-accent/90 h-8"
            >
              <Download className="w-3.5 h-3.5" /> Download Presentation
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default function Sarathi() {
  const [match, params] = useRoute("/sarathi/:id");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const { addNotification } = useNotifications();
  const { addItem: addCreativityItem } = useCreativityStore();

  const conversationId = match && params?.id ? parseInt(params.id, 10) : undefined;

  const { data: conversations, isLoading: isLoadingHistory } = useListOpenaiConversations({ type: "sarathi" });
  const createConversation = useCreateOpenaiConversation();

  const handleNewMessage = (content: string) => {
    const title = content.split(" ").slice(0, 5).join(" ") + "...";
    createConversation.mutate({ data: { title, type: "sarathi" } }, {
      onSuccess: (newConv) => {
        queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
        setLocation(`/sarathi/${newConv.id}`);
      },
    });
  };

  const handleDownloadPdf = useCallback((content: string) => {
    downloadAsPdf(content, "sarathi-textbook");
    const wordCount = content.split(/\s+/).length;
    const firstLine = content.split("\n").find(l => l.startsWith("# "))?.slice(2).trim() || "Sarathi Textbook";
    addNotification({
      type: "complete",
      title: "Sarathi — Textbook Ready",
      message: "HTML file downloaded. Open it in browser and press Ctrl+P to save as PDF with full Hindi support.",
    });
    addCreativityItem({
      type: "textbook",
      title: firstLine,
      wordCount,
      downloadContent: content,
      downloadFilename: "sarathi-textbook",
    });
  }, [addNotification, addCreativityItem]);

  const handleDownloadPpt = useCallback((content: string) => {
    downloadAsPpt(content, "sarathi-presentation");
    const slideCount = (content.match(/^##\s+slide\s+\d+/gim) || []).length;
    const firstLine = content.split("\n").find(l => l.startsWith("# "))?.slice(2).trim() || "Sarathi Presentation";
    addNotification({
      type: "complete",
      title: "Sarathi — Presentation Ready",
      message: "Presentation downloaded. Open the HTML file in any browser — use arrow keys to navigate slides.",
    });
    addCreativityItem({
      type: "presentation",
      title: firstLine,
      slideCount,
      downloadContent: content,
      downloadFilename: "sarathi-presentation",
    });
  }, [addNotification, addCreativityItem]);

  const messageRenderer = useCallback(
    (msg: ChatMessage, brandBgClass: string) =>
      SarathiMessageRenderer(msg, brandBgClass, handleDownloadPdf, handleDownloadPpt),
    [handleDownloadPdf, handleDownloadPpt]
  );

  const systemPrompt = `${MODEL_PERSONAS[selectedModel.id]}\n\n${BASE_SYSTEM}`;

  const ModelSelector = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 h-8 text-xs border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary"
        >
          <div
            className="w-4 h-4 rounded-full flex items-center justify-center text-white font-bold text-[9px]"
            style={{ background: selectedModel.color }}
          >
            {selectedModel.icon}
          </div>
          <span className="hidden sm:inline">{selectedModel.name}</span>
          <Badge variant="outline" className="text-[10px] border-primary/20 text-primary/70 px-1 h-4 hidden sm:flex">
            {selectedModel.tag}
          </Badge>
          <ChevronDown className="w-3 h-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-card border-border w-52">
        <div className="px-3 py-2 text-xs text-muted-foreground font-medium flex items-center gap-2">
          <Cpu className="w-3 h-3" /> Select AI Model
        </div>
        <DropdownMenuSeparator />
        {MODELS.map(model => (
          <DropdownMenuItem
            key={model.id}
            className="gap-3 cursor-pointer py-2.5 focus:bg-primary/10"
            onClick={() => setSelectedModel(model)}
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-[10px] shrink-0"
              style={{ background: model.color }}
            >
              {model.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm text-white font-medium">{model.name}</span>
                <span className="text-[10px] text-muted-foreground bg-white/5 px-1.5 py-0.5 rounded">{model.tag}</span>
              </div>
              <span className="text-xs text-muted-foreground">{model.label}</span>
            </div>
            {selectedModel.id === model.id && (
              <Check className="w-4 h-4 text-primary shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <div className="px-3 py-2 text-[10px] text-muted-foreground">
          All models powered by Universe AI Hub
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const HeaderRight = () => (
    <div className="flex items-center gap-2">
      <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs text-primary">
        <Sparkles className="w-3 h-3" />
        <span>Image Gen · PDF · PPT</span>
      </div>
      <ModelSelector />
    </div>
  );

  const EmptyState = () => (
    <>
      <div className="h-20 w-20 rounded-2xl bg-primary/20 flex items-center justify-center">
        <Bot className="h-10 w-10 text-primary" />
      </div>
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">Main Sarathi Hoon</h2>
        <p className="text-lg text-muted-foreground">
          Your universal AI brain — coding, research, UPSC, image generation, textbooks aur presentations.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full mt-4">
        {[
          { text: "Write a 500-page textbook on Indian History", icon: <BookOpen className="w-3.5 h-3.5 text-primary" /> },
          { text: "Create a 30-slide PPT on Climate Change", icon: <Presentation className="w-3.5 h-3.5 text-accent" /> },
          { text: "Generate image: futuristic Indian city at night", icon: <ImageIcon className="w-3.5 h-3.5 text-secondary" /> },
          { text: "Build a full-stack React + Node.js app", icon: <Zap className="w-3.5 h-3.5 text-primary" /> },
          { text: "UPSC mains answer writing practice", icon: <Bot className="w-3.5 h-3.5 text-muted-foreground" /> },
          { text: "Explain quantum computing in simple Hindi", icon: <Bot className="w-3.5 h-3.5 text-muted-foreground" /> },
        ].map((s, i) => (
          <button
            key={i}
            className="flex items-center gap-3 p-3.5 bg-card hover:bg-card/80 border border-border rounded-xl text-left text-sm text-muted-foreground hover:text-white transition-colors"
            onClick={() => handleNewMessage(s.text)}
          >
            {s.icon}
            <span>{s.text}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-2 mt-2">
        {MODELS.map(m => (
          <div key={m.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/10 text-xs text-muted-foreground">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: m.color }} />
            {m.name}
          </div>
        ))}
      </div>
    </>
  );

  return (
    <Shell>
      <div className="flex flex-1 h-[calc(100vh-64px)] overflow-hidden">
        <div className="w-64 border-r border-border bg-card/30 flex-col hidden md:flex shrink-0">
          <div className="p-4 border-b border-border">
            <Button
              className="w-full justify-start gap-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20"
              variant="outline"
              onClick={() => setLocation("/sarathi")}
            >
              <Plus className="w-4 h-4" /> New Chat
            </Button>
          </div>
          <ScrollArea className="flex-1 p-3">
            <div className="space-y-1">
              {isLoadingHistory
                ? Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-md" />)
                : conversations?.map(conv => (
                  <Button
                    key={conv.id}
                    variant={conv.id === conversationId ? "secondary" : "ghost"}
                    className={`w-full justify-start text-left truncate ${
                      conv.id === conversationId
                        ? "bg-primary/20 text-primary font-medium"
                        : "text-muted-foreground hover:text-white"
                    }`}
                    onClick={() => setLocation(`/sarathi/${conv.id}`)}
                  >
                    <MessageSquare className="w-4 h-4 mr-2 shrink-0" />
                    <span className="truncate">{conv.title}</span>
                  </Button>
                ))}
            </div>
          </ScrollArea>

          <div className="p-3 border-t border-border space-y-1">
            <p className="text-xs text-muted-foreground px-2 mb-2">Connected Models</p>
            {MODELS.map(m => (
              <button
                key={m.id}
                onClick={() => setSelectedModel(m)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  selectedModel.id === m.id
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-white hover:bg-white/5"
                }`}
              >
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-white font-bold text-[9px]" style={{ background: m.color }}>
                  {m.icon}
                </div>
                <span className="truncate">{m.name}</span>
                {selectedModel.id === m.id && <Check className="w-3 h-3 ml-auto" />}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <ChatInterface
            conversationId={conversationId}
            title="Sarathi Chat"
            placeholder={`Ask anything (${selectedModel.name} selected)... ya image/PDF/PPT generate karo`}
            brandColor="primary"
            emptyStateContent={<EmptyState />}
            headerContent={<HeaderRight />}
            onNewMessage={handleNewMessage}
            enableImageGen={true}
            messageRenderer={messageRenderer}
            systemPrompt={systemPrompt}
          />
        </div>
      </div>
    </Shell>
  );
}
