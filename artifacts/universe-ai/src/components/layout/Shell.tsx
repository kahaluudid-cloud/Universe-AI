import React, { useState, useCallback } from "react";
import { Link } from "wouter";
import { Home, LogIn, Settings, Bell, Sun, Moon, Languages, X, Trash2, CheckCheck, Key, CheckCircle2, AlertCircle, Loader2, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { useNotifications } from "@/contexts/notifications";
import { useSettings } from "@/contexts/settings";

interface ShellProps { children: React.ReactNode; }

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
    setTimeout(() => { setSent(false); setName(""); setMessage(""); onClose(); }, 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Help & Contact</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Send a message to Manish Kumar Chaturvedi — Universe AI founder.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <Input placeholder="Your name (optional)" value={name} onChange={e => setName(e.target.value)} className="bg-background border-border text-white" />
          <Textarea placeholder="Describe your issue or feedback..." value={message} onChange={e => setMessage(e.target.value)} className="min-h-[120px] bg-background border-border text-white resize-none" />
          <Button onClick={handleSend} disabled={!message.trim() || sent} className="w-full">
            {sent ? "Opening your email app..." : "Send Message"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">Will open your email app · mk119151580@gmail.com</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NotificationPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { notifications, markAllRead, clearAll } = useNotifications();

  const typeIcon = (type: string) => {
    if (type === "build") return "🏗";
    if (type === "complete") return "✅";
    return "ℹ️";
  };

  const timeAgo = (date: Date) => {
    const s = Math.floor((Date.now() - date.getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    return `${Math.floor(s / 3600)}h ago`;
  };

  if (!open) return null;

  return (
    <div className="absolute top-14 right-24 w-80 z-50 bg-card border border-border rounded-xl shadow-2xl shadow-black/40 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm font-semibold text-white">Notifications</span>
        <div className="flex gap-2">
          {notifications.length > 0 && (
            <>
              <button onClick={markAllRead} className="text-xs text-muted-foreground hover:text-white flex items-center gap-1">
                <CheckCheck className="w-3 h-3" /> Mark read
              </button>
              <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-red-400 flex items-center gap-1">
                <Trash2 className="w-3 h-3" /> Clear
              </button>
            </>
          )}
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground hover:text-white" /></button>
        </div>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground text-sm">
            <Bell className="w-6 h-6 mx-auto mb-2 opacity-30" />
            No notifications yet
          </div>
        ) : (
          notifications.map(n => (
            <div key={n.id} className={`flex gap-3 px-4 py-3 border-b border-border/50 transition-colors ${n.read ? "opacity-60" : "bg-primary/5"}`}>
              <span className="text-lg mt-0.5">{typeIcon(n.type)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">{n.title}</span>
                  <span className="text-[10px] text-muted-foreground ml-2 shrink-0">{timeAgo(n.timestamp)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.message}</p>
              </div>
              {!n.read && <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

type KeyStatus = { ok: boolean; latency: number; error?: string } | null;

interface KeyReport {
  summary: { total: number; healthy: number; mode: string };
  keys: Record<string, { configured: boolean; ok?: boolean; latency?: number; error?: string }>;
}

function KeyHealthPanel() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<KeyReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runCheck = useCallback(async () => {
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const res = await fetch(`${base}/api/health/keys/health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: KeyReport = await res.json();
      setReport(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const KEY_LABELS: Record<string, { label: string; color: string }> = {
    GEMINI_KEY_1: { label: "Gemini Key 1", color: "#4285f4" },
    GEMINI_KEY_2: { label: "Gemini Key 2", color: "#4285f4" },
    GEMINI_KEY_3: { label: "Gemini Key 3", color: "#4285f4" },
    GROQ_KEY_1: { label: "Groq Key 1", color: "#f97316" },
    GROQ_KEY_2: { label: "Groq Key 2", color: "#f97316" },
    GROQ_KEY_3: { label: "Groq Key 3", color: "#f97316" },
    HF_TOKEN: { label: "HuggingFace", color: "#fbbf24" },
  };

  return (
    <div className="border-t border-border pt-5 space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-white flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" /> AI Key Health
        </label>
        {report && (
          <Badge
            variant="outline"
            className={`text-[10px] h-4 px-1.5 ${
              report.summary.healthy === report.summary.total && report.summary.total > 0
                ? "border-emerald-500/30 text-emerald-400"
                : report.summary.healthy > 0
                ? "border-yellow-500/30 text-yellow-400"
                : "border-red-500/30 text-red-400"
            }`}
          >
            {report.summary.healthy}/{report.summary.total} OK
          </Badge>
        )}
      </div>

      {report && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 py-1.5 px-2 rounded-md bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-xs text-emerald-300 font-medium">Replit AI — Primary (Always Active)</span>
          </div>
          {Object.entries(report.keys).map(([k, val]) => {
            const meta = KEY_LABELS[k] ?? { label: k, color: "#888" };
            return (
              <div
                key={k}
                className={`flex items-center gap-2 py-1.5 px-2 rounded-md border ${
                  !val.configured
                    ? "bg-white/3 border-border opacity-50"
                    : val.ok
                    ? "bg-emerald-500/5 border-emerald-500/20"
                    : "bg-red-500/5 border-red-500/20"
                }`}
              >
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: val.configured ? meta.color : "#555" }} />
                <span className="text-xs text-white flex-1 truncate">{meta.label}</span>
                {!val.configured && <span className="text-[10px] text-muted-foreground">Not set</span>}
                {val.configured && val.ok && (
                  <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                    <CheckCircle2 className="w-2.5 h-2.5" /> {val.latency}ms
                  </span>
                )}
                {val.configured && !val.ok && (
                  <span className="text-[10px] text-red-400 flex items-center gap-0.5">
                    <AlertCircle className="w-2.5 h-2.5" /> Error
                  </span>
                )}
              </div>
            );
          })}
          <p className={`text-[10px] text-center mt-1 ${report.summary.mode === "hybrid" ? "text-emerald-400" : "text-muted-foreground"}`}>
            {report.summary.mode === "hybrid"
              ? `✓ Hybrid mode — ${report.summary.total} backup key${report.summary.total !== 1 ? "s" : ""} in pool`
              : "Primary-only mode — add keys for failover"}
          </p>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-2 py-1.5">
          {error}
        </p>
      )}

      <Button
        size="sm"
        variant="outline"
        className="w-full gap-2 text-xs h-8 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
        onClick={runCheck}
        disabled={loading}
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
        {loading ? "Testing all keys..." : "Run Health Check"}
      </Button>

      <div className="rounded-lg bg-white/3 border border-border p-2.5 space-y-1">
        <p className="text-[10px] font-medium text-muted-foreground">Add your free API keys as secrets:</p>
        {["GEMINI_KEY_1", "GEMINI_KEY_2", "GEMINI_KEY_3", "GROQ_KEY_1", "GROQ_KEY_2", "GROQ_KEY_3", "HF_TOKEN"].map(k => (
          <p key={k} className="text-[10px] font-mono text-primary/70">{k}</p>
        ))}
        <p className="text-[10px] text-muted-foreground mt-1">Get free keys: Google AI Studio · Groq Cloud · HuggingFace</p>
      </div>
    </div>
  );
}

function SettingsSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { brightness, setBrightness, language, setLanguage, theme, setTheme } = useSettings();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="w-80 bg-card border-l border-border h-full overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-primary" />
            <span className="font-semibold text-white">Settings</span>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground hover:text-white" /></button>
        </div>

        <div className="p-5 space-y-7">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-white flex items-center gap-2">
                <Sun className="w-4 h-4 text-yellow-400" /> Brightness
              </label>
              <span className="text-xs text-muted-foreground tabular-nums">{brightness}%</span>
            </div>
            <Slider
              value={[brightness]}
              onValueChange={([v]) => setBrightness(v)}
              min={30}
              max={130}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Dim</span><span>Normal</span><span>Bright</span>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-white flex items-center gap-2">
              <Moon className="w-4 h-4 text-indigo-400" /> Theme
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["dark", "light"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-sm transition-all ${
                    theme === t
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-white hover:border-white/30"
                  }`}
                >
                  {t === "dark" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                  {t === "dark" ? "Dark" : "Light"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-white flex items-center gap-2">
              <Languages className="w-4 h-4 text-green-400" /> Language
            </label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: "en" as const, label: "English", sub: "English" },
                { id: "hi" as const, label: "हिंदी", sub: "Hindi" },
              ]).map(l => (
                <button
                  key={l.id}
                  onClick={() => setLanguage(l.id)}
                  className={`flex flex-col items-center p-3 rounded-lg border text-sm transition-all ${
                    language === l.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-white hover:border-white/30"
                  }`}
                >
                  <span className="text-lg font-bold">{l.label}</span>
                  <span className="text-[10px] mt-0.5 opacity-70">{l.sub}</span>
                </button>
              ))}
            </div>
          </div>

          <KeyHealthPanel />

          <div className="pt-2 border-t border-border space-y-2">
            <p className="text-xs text-muted-foreground">About</p>
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-1">
              <p className="text-xs font-semibold text-primary">Universe AI</p>
              <p className="text-xs text-muted-foreground">India's Universal AI Platform</p>
              <p className="text-xs text-muted-foreground">By Manish Kumar Chaturvedi</p>
              <p className="text-xs text-muted-foreground">Oteband, Balod, Chhattisgarh · © 2026</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Shell({ children }: ShellProps) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { hasUnread, markAllRead } = useNotifications();

  const handleBellClick = () => {
    setNotifOpen(v => !v);
    if (!notifOpen) markAllRead();
  };

  return (
    <div className="min-h-screen flex flex-col cosmic-bg text-foreground">
      <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-background/60 backdrop-blur-md">
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
                <Home className="h-4 w-4" /> Home
              </Button>
            </Link>
          </div>

          <div className="flex items-center gap-1 relative">
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="relative text-muted-foreground hover:text-white"
                onClick={handleBellClick}
              >
                <Bell className="h-5 w-5" />
                {hasUnread && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                )}
              </Button>
              <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-white"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="h-5 w-5" />
            </Button>

            <Button
              size="sm"
              className="gap-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 hidden sm:flex ml-1"
              variant="outline"
              onClick={() => setHelpOpen(true)}
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
      <SettingsSidebar open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
