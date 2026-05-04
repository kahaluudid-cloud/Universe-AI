import React from "react";
import { Link } from "wouter";
import { Bell, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ShellProps {
  children: React.ReactNode;
}

export function Shell({ children }: ShellProps) {
  return (
    <div className="min-h-screen flex flex-col cosmic-bg text-foreground">
      <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-background/60 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <span className="font-bold text-lg leading-none">U</span>
            </div>
            <span className="font-bold text-xl tracking-tight text-white">Universe AI</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-white">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-accent"></span>
            </Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white">
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>
      
      <main className="flex-1 flex flex-col relative">
        {children}
      </main>
    </div>
  );
}
