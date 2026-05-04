import { Shell } from "@/components/layout/Shell";
import { Link } from "wouter";
import { useListOpenaiConversations } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Bot, Code2, Heart, History, MessageSquare, Terminal, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data: conversations, isLoading } = useListOpenaiConversations();
  const recentConversations = conversations?.slice(0, 5) || [];

  return (
    <Shell>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-12 text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
            Welcome to <span className="text-primary">Universe AI</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            India's Universal AI Platform. Your cosmic gateway to 200+ models.
            Built by Manish Kumar Chaturvedi.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          <Link href="/sarathi">
            <div className="group relative overflow-hidden rounded-2xl border border-primary/20 bg-card/40 p-8 hover:bg-card/60 transition-all cursor-pointer cosmic-glow">
              <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                <Bot className="w-32 h-32 text-primary" />
              </div>
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center mb-6">
                  <Bot className="w-7 h-7 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2 group-hover:text-primary transition-colors">Sarathi Chat</h2>
                <p className="text-muted-foreground">Your universal AI brain. Ask anything, get instant brilliant answers.</p>
              </div>
            </div>
          </Link>

          <Link href="/webcraft">
            <div className="group relative overflow-hidden rounded-2xl border border-secondary/20 bg-card/40 p-8 hover:bg-card/60 transition-all cursor-pointer cosmic-glow-purple">
              <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                <Code2 className="w-32 h-32 text-secondary" />
              </div>
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-xl bg-secondary/20 flex items-center justify-center mb-6">
                  <Terminal className="w-7 h-7 text-secondary" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2 group-hover:text-secondary transition-colors">WebCraft Pro</h2>
                <p className="text-muted-foreground">Developer studio. Build, debug, and ship code at lightspeed.</p>
              </div>
            </div>
          </Link>

          <Link href="/manish">
            <div className="group relative overflow-hidden rounded-2xl border border-accent/20 bg-card/40 p-8 hover:bg-card/60 transition-all cursor-pointer cosmic-glow-gold">
              <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                <Heart className="w-32 h-32 text-accent" />
              </div>
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-xl bg-accent/20 flex items-center justify-center mb-6">
                  <Heart className="w-7 h-7 text-accent" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2 group-hover:text-accent transition-colors">Manish Chat</h2>
                <p className="text-muted-foreground">Your emotional AI companion. Always here to listen and support.</p>
              </div>
            </div>
          </Link>

          <Link href="/activity">
            <div className="group relative overflow-hidden rounded-2xl border border-border bg-card/40 p-8 hover:bg-card/60 transition-all cursor-pointer hover:border-white/20 hover:shadow-[0_0_30px_-10px_rgba(255,255,255,0.2)]">
              <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                <History className="w-32 h-32 text-white" />
              </div>
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center mb-6">
                  <History className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2 group-hover:text-white transition-colors">My Activity</h2>
                <p className="text-muted-foreground">Your secure vault. Access all your past conversations and creations.</p>
              </div>
            </div>
          </Link>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-2 text-white">
            <Zap className="w-5 h-5 text-accent" />
            <h3 className="text-xl font-bold">Recent Signals</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading ? (
              Array(3).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-xl bg-card border border-border" />
              ))
            ) : recentConversations.length > 0 ? (
              recentConversations.map(conv => (
                <Link key={conv.id} href={`/${conv.type === 'sarathi' ? 'sarathi' : 'manish'}/${conv.id}`}>
                  <Card className="bg-card/50 border-border hover:bg-card/80 hover:border-primary/50 transition-all cursor-pointer h-full">
                    <CardContent className="p-5 flex flex-col h-full justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-semibold px-2 py-1 rounded-md ${
                            conv.type === 'sarathi' ? 'bg-primary/20 text-primary' : 'bg-accent/20 text-accent'
                          }`}>
                            {conv.type.charAt(0).toUpperCase() + conv.type.slice(1)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(conv.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <h4 className="font-medium text-white line-clamp-2">{conv.title}</h4>
                      </div>
                      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                        <MessageSquare className="w-3 h-3" /> Resume chat
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))
            ) : (
              <div className="col-span-full text-center py-8 text-muted-foreground bg-card/20 rounded-xl border border-border border-dashed">
                No recent activity. Start a new chat to begin exploring.
              </div>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}
