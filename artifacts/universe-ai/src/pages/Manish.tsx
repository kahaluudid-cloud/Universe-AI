import { Shell } from "@/components/layout/Shell";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { useRoute, useLocation } from "wouter";
import { useCreateOpenaiConversation, useListOpenaiConversations, getListOpenaiConversationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Heart, WifiOff, MessageSquare, Plus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect, useCallback } from "react";

export default function Manish() {
  const [match, params] = useRoute("/manish/:id");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingMsg, setPendingMsg] = useState("");

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  const conversationId = match && params?.id ? parseInt(params.id, 10) : undefined;

  const { data: conversations, isLoading: isLoadingHistory } = useListOpenaiConversations({ type: "manish" });
  const createConversation = useCreateOpenaiConversation();

  const handleNewMessage = useCallback((content: string) => {
    setPendingMsg(content);
    const title = content.split(' ').slice(0, 5).join(' ') + '...';
    createConversation.mutate({ data: { title, type: "manish" } }, {
      onSuccess: (newConv) => {
        queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
        setLocation(`/manish/${newConv.id}`);
      }
    });
  }, [createConversation, queryClient, setLocation]);

  const EmptyState = () => (
    <>
      <div className="h-20 w-20 rounded-full bg-accent/20 flex items-center justify-center">
        <Heart className="h-10 w-10 text-accent" />
      </div>
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">Manish Chat</h2>
        <p className="text-lg text-muted-foreground">I'm here for you. How are you feeling today?</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mt-8">
        {[
          "I'm feeling a bit stressed",
          "Can we talk about my day?",
          "I need some motivation",
          "Tell me something positive"
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
    </>
  );

  const HeaderIndicator = () => (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${
      isOnline 
        ? "bg-accent/10 border-accent/20 text-accent" 
        : "bg-destructive/10 border-destructive/20 text-destructive"
    }`}>
      {isOnline ? (
        <>
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span>Manish is online</span>
        </>
      ) : (
        <>
          <WifiOff className="w-3 h-3" />
          <span>Offline Mode</span>
        </>
      )}
    </div>
  );

  return (
    <Shell>
      <div className="flex flex-1 h-[calc(100vh-64px)] overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 border-r border-border bg-card/30 flex flex-col hidden md:flex shrink-0">
          <div className="p-4 border-b border-border">
            <Button 
              className="w-full justify-start gap-2 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20" 
              variant="outline"
              onClick={() => setLocation('/manish')}
            >
              <Plus className="w-4 h-4" /> New Conversation
            </Button>
          </div>
          <ScrollArea className="flex-1 p-3">
            <div className="space-y-1">
              {isLoadingHistory ? (
                Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-md" />)
              ) : conversations?.map(conv => (
                <Button
                  key={conv.id}
                  variant={conv.id === conversationId ? "secondary" : "ghost"}
                  className={`w-full justify-start text-left truncate ${
                    conv.id === conversationId ? "bg-accent/20 text-accent font-medium" : "text-muted-foreground hover:text-white"
                  }`}
                  onClick={() => setLocation(`/manish/${conv.id}`)}
                >
                  <MessageSquare className="w-4 h-4 mr-2 shrink-0" />
                  <span className="truncate">{conv.title}</span>
                </Button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 min-w-0">
          <ChatInterface 
            conversationId={conversationId}
            title="Manish Chat"
            placeholder="Share your thoughts..."
            brandColor="accent"
            emptyStateContent={<EmptyState />}
            headerContent={<HeaderIndicator />}
            onNewMessage={handleNewMessage}
            initialMessage={pendingMsg}
            onInitialMessageSent={() => setPendingMsg("")}
            systemPrompt="You are Manish, a warm, empathetic, and supportive emotional AI companion part of the Universe AI platform. You listen carefully, validate feelings, and offer gentle encouragement. You talk like a close, caring friend."
          />
        </div>
      </div>
    </Shell>
  );
}
