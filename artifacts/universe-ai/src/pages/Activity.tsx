import { Shell } from "@/components/layout/Shell";
import { useListOpenaiConversations, useDeleteOpenaiConversation, getListOpenaiConversationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Search, History, MessageSquare, Bot, Heart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { Link } from "wouter";

export default function Activity() {
  const { data: conversations, isLoading } = useListOpenaiConversations();
  const deleteMutation = useDeleteOpenaiConversation();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredConversations = conversations?.filter(c => 
    c.title.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Group by date
  const grouped = filteredConversations.reduce((acc, conv) => {
    const date = new Date(conv.createdAt);
    let dateKey = "";
    if (isToday(date)) dateKey = "Today";
    else if (isYesterday(date)) dateKey = "Yesterday";
    else dateKey = format(date, "MMMM d, yyyy");
    
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(conv);
    return acc;
  }, {} as Record<string, typeof conversations>);

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this conversation?")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
        }
      });
    }
  };

  return (
    <Shell>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">My Activity</h1>
            <p className="text-muted-foreground">Your secure vault of past conversations.</p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-card border border-border flex items-center justify-center">
            <History className="h-6 w-6 text-muted-foreground" />
          </div>
        </div>

        <div className="relative mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input 
            className="pl-10 bg-card border-border text-white"
            placeholder="Search past conversations..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading activity...</div>
        ) : filteredConversations.length === 0 ? (
          <div className="text-center py-12 bg-card/30 rounded-xl border border-border border-dashed">
            <p className="text-muted-foreground">No conversations found.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([date, convs]) => (
              <div key={date}>
                <h3 className="text-sm font-medium text-muted-foreground mb-4 sticky top-16 bg-background/90 backdrop-blur-sm py-2 z-10">
                  {date}
                </h3>
                <div className="space-y-3">
                  {convs.map(conv => (
                    <Link key={conv.id} href={`/${conv.type === 'sarathi' ? 'sarathi' : 'manish'}/${conv.id}`}>
                      <Card className="bg-card/50 border-border hover:bg-card/80 hover:border-primary/30 transition-all cursor-pointer group">
                        <CardContent className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-4 min-w-0">
                            <div className={`shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${
                              conv.type === 'sarathi' ? 'bg-primary/20 text-primary' : 'bg-accent/20 text-accent'
                            }`}>
                              {conv.type === 'sarathi' ? <Bot className="h-5 w-5" /> : <Heart className="h-5 w-5" />}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-medium text-white truncate">{conv.title}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className={`text-xs ${
                                  conv.type === 'sarathi' ? 'border-primary/30 text-primary' : 'border-accent/30 text-accent'
                                }`}>
                                  {conv.type}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(conv.createdAt), "h:mm a")}
                                </span>
                              </div>
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all shrink-0"
                            onClick={(e) => handleDelete(conv.id, e)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}
