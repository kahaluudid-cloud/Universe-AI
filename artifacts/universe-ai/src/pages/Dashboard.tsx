import { Shell } from "@/components/layout/Shell";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Bot, Code2, Heart, History, Terminal } from "lucide-react";

export default function Dashboard() {
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                <p className="text-muted-foreground">Your universal AI brain. Ask anything, get brilliant answers. Supports Hinglish, image generation, PDF & slide creation.</p>
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
                <p className="text-muted-foreground">Developer studio. Describe what to build — AI creates files silently. Live preview, instant ZIP download, infinite revisions.</p>
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
                <p className="text-muted-foreground">Your emotional AI companion. Always here to listen and support. Works online and offline.</p>
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
                <p className="text-muted-foreground">Your secure vault. Access all past conversations and creations. Search, review, and resume anytime.</p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </Shell>
  );
}
