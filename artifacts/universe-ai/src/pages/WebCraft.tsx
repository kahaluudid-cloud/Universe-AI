import { Shell } from "@/components/layout/Shell";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { useRoute, useLocation } from "wouter";
import { useCreateOpenaiConversation } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Terminal, Eye, Share2, Code2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function WebCraft() {
  const [match, params] = useRoute("/webcraft/:id");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const conversationId = match && params?.id ? parseInt(params.id, 10) : undefined;
  const createConversation = useCreateOpenaiConversation();

  const handleNewMessage = (content: string) => {
    const title = content.split(' ').slice(0, 5).join(' ') + '...';
    createConversation.mutate({ data: { title, type: "sarathi" } }, { // Note: using sarathi type for now as only manish/sarathi exist in schema
      onSuccess: (newConv) => {
        setLocation(`/webcraft/${newConv.id}`);
      }
    });
  };

  const EmptyState = () => (
    <>
      <div className="h-20 w-20 rounded-xl bg-secondary/20 flex items-center justify-center border border-secondary/30">
        <Terminal className="h-10 w-10 text-secondary" />
      </div>
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">WebCraft Pro</h2>
        <p className="text-lg text-muted-foreground">The ultimate developer studio. What are we building today?</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mt-8">
        {[
          "Build a React dashboard",
          "Create a REST API with Express",
          "Fix a CORS error",
          "Write a database schema"
        ].map((suggestion, i) => (
          <button 
            key={i}
            className="p-4 bg-card hover:bg-card/80 border border-secondary/20 rounded-xl text-left text-sm text-muted-foreground hover:text-white transition-colors"
            onClick={() => handleNewMessage(suggestion)}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </>
  );

  const HeaderMenu = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 bg-secondary/10 text-secondary border-secondary/20 hover:bg-secondary/20 hover:text-secondary">
          <Eye className="w-4 h-4" />
          <span>View Options</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-card border-border">
        <DropdownMenuItem className="gap-2 cursor-pointer text-white focus:bg-secondary/20 focus:text-secondary">
          <Eye className="w-4 h-4" /> Live Site Preview
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 cursor-pointer text-white focus:bg-secondary/20 focus:text-secondary">
          <Code2 className="w-4 h-4" /> Show Coding
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 cursor-pointer text-white focus:bg-secondary/20 focus:text-secondary">
          <Share2 className="w-4 h-4" /> Share Link
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 cursor-pointer text-white focus:bg-secondary/20 focus:text-secondary">
          <Download className="w-4 h-4" /> Download Files
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <Shell>
      <div className="flex flex-1 h-[calc(100vh-64px)] overflow-hidden">
        {/* Full screen chat for WebCraft */}
        <div className="flex-1 min-w-0">
          <ChatInterface 
            conversationId={conversationId}
            title="WebCraft Pro"
            placeholder="Describe what you want to build..."
            brandColor="secondary"
            emptyStateContent={<EmptyState />}
            headerContent={<HeaderMenu />}
            onNewMessage={handleNewMessage}
            systemPrompt="You are WebCraft Pro, an expert software developer and coding assistant. Provide clean, efficient, and well-documented code. Explain complex technical concepts clearly."
          />
        </div>
      </div>
    </Shell>
  );
}
