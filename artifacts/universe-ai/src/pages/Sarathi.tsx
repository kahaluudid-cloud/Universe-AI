import { Shell } from "@/components/layout/Shell";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { useRoute, useLocation } from "wouter";
import {
  useCreateOpenaiConversation,
  useListOpenaiConversations,
  getListOpenaiConversationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Bot, Sparkles, MessageSquare, Plus, Image as ImageIcon } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function Sarathi() {
  const [match, params] = useRoute("/sarathi/:id");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

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

  const EmptyState = () => (
    <>
      <div className="h-20 w-20 rounded-2xl bg-primary/20 flex items-center justify-center animate-pulse">
        <Bot className="h-10 w-10 text-primary" />
      </div>
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">Main Sarathi Hoon</h2>
        <p className="text-lg text-muted-foreground">Your universal AI brain. Ask anything — coding, research, UPSC, creative writing, or generate images.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mt-8">
        {[
          "Explain quantum physics simply in Hindi",
          "Write an essay on Indian space missions",
          "Generate image: a futuristic Indian city",
          "Help me prepare for UPSC exam",
        ].map((suggestion, i) => (
          <button
            key={i}
            className="p-4 bg-card hover:bg-card/80 border border-border rounded-xl text-left text-sm text-muted-foreground hover:text-white transition-colors"
            onClick={() => handleNewMessage(suggestion)}
          >
            {suggestion}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
        <ImageIcon className="w-3 h-3" />
        <span>Tip: Type "generate image of..." to create AI images with download</span>
      </div>
    </>
  );

  const HeaderIndicator = () => (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary">
      <Sparkles className="w-3 h-3" />
      <span>Auto · GPT-5.4 + Image Gen</span>
    </div>
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
        </div>

        <div className="flex-1 min-w-0">
          <ChatInterface
            conversationId={conversationId}
            title="Sarathi Chat"
            placeholder="Ask anything... ya image generate karo (e.g. generate image of...)"
            brandColor="primary"
            emptyStateContent={<EmptyState />}
            headerContent={<HeaderIndicator />}
            onNewMessage={handleNewMessage}
            enableImageGen={true}
            systemPrompt={`Aap Universe AI ke Sarathi hain — ek advanced AI brain jo coding, research, image generation, aur academic writing mein expert hai.

Aap Hinglish (Hindi + English mix) mein baat karte hain aur Hindi mein jawab dete hain jab user Hinglish mein likhta hai.

Capabilities:
- Full-stack code generation aur debugging (with syntax highlighting)
- Research aur academic writing (500+ pages tak)
- UPSC preparation
- Image generation (user "/imagine" ya "generate image" likhe toh)
- Multi-topic assistance

Jab code generate karo: proper markdown code blocks use karo with language tag.
Jab book ya document generate karo: structured, detailed content dena.

Hamesha helpful, precise aur professional rahein.
Creator: Manish Kumar Chaturvedi, Oteband, Balod, Chhattisgarh, India.`}
          />
        </div>
      </div>
    </Shell>
  );
}
