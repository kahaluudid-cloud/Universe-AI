import React, { useState } from "react";
import { Link } from "wouter";
import { Settings, HelpCircle, LogIn, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

interface ShellProps {
  children: React.ReactNode;
}

function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const handleSend = () => {
    if (!message.trim()) return;
    const subject = encodeURIComponent(`Universe AI Feedback from ${name || "User"}`);
    const body = encodeURIComponent(`Name: ${name}\n\nMessage:\n${message}`);
    window.open(`mailto:mk119151580@gmail.com?subject=${subject}&body=${body}`, "_blank");
    setSent(true);
    setTimeout(() => {
      setSent(false);
      setName("");
      setMessage("");
      onClose();
    }, 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Help & Contact</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Send a message directly to Manish Kumar Chaturvedi — Universe AI founder.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <Input
            placeholder="Your name (optional)"
            value={name}
            onChange={e => setName(e.target.value)}
            className="bg-background border-border text-white"
          />
          <Textarea
            placeholder="Describe your issue or feedback..."
            value={message}
            onChange={e => setMessage(e.target.value)}
            className="min-h-[120px] bg-background border-border text-white resize-none"
          />
          <Button
            onClick={handleSend}
            disabled={!message.trim() || sent}
            className="w-full"
          >
            {sent ? "Opening your email app..." : "Send Message"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Will open your email app · mk119151580@gmail.com
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function Shell({ children }: ShellProps) {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col cosmic-bg text-foreground">
      <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-background/60 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <span className="font-bold text-lg leading-none">U</span>
              </div>
              <span className="font-bold text-xl tracking-tight text-white">Universe AI</span>
            </Link>

            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-white hidden sm:flex">
                <Home className="h-4 w-4" />
                Home
              </Button>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground hover:text-white"
              onClick={() => setHelpOpen(true)}
            >
              <HelpCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Help</span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-white"
            >
              <Settings className="h-5 w-5" />
            </Button>

            <Button
              size="sm"
              className="gap-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 hidden sm:flex"
              variant="outline"
            >
              <LogIn className="h-4 w-4" />
              Google Login
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col relative">
        {children}
      </main>

      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
