import { Shell } from "@/components/layout/Shell";
import {
  useListOpenaiConversations,
  useDeleteOpenaiConversation,
  getListOpenaiConversationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Trash2, Search, History, Bot, Heart, Sparkles,
  Globe, BookOpen, Presentation, Download, Eye,
  ExternalLink, Clock, FileCode2, X,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { Link } from "wouter";
import { useCreativityStore, type CreativityItem } from "@/contexts/creativity-store";
import { downloadAsPdf } from "@/lib/download-pdf";
import { downloadAsPpt } from "@/lib/download-ppt";
import JSZip from "jszip";

function WebsitePreview({ html, title }: { html: string; title: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!iframeRef.current || !html) return;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    iframeRef.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [html]);

  return (
    <div className="relative w-full h-28 rounded-lg overflow-hidden bg-background border border-border">
      <iframe
        ref={iframeRef}
        title={title}
        className="absolute inset-0 w-[600px] h-[450px] pointer-events-none border-0"
        style={{ transform: "scale(0.26)", transformOrigin: "top left" }}
        sandbox="allow-scripts"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
    </div>
  );
}

function LivePreviewDialog({ item, onClose }: { item: CreativityItem; onClose: () => void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!iframeRef.current || !item.previewHtml) return;
    const blob = new Blob([item.previewHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    iframeRef.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [item.previewHtml]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-5xl h-[85vh] bg-card rounded-2xl border border-border flex flex-col overflow-hidden shadow-2xl">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/80">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <span className="text-sm text-muted-foreground flex-1 truncate">{item.title}</span>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-white" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <iframe ref={iframeRef} title={item.title} className="flex-1 border-0 bg-white" sandbox="allow-scripts allow-same-origin" />
      </div>
    </div>
  );
}

function CreativityCard({ item, onRemove }: { item: CreativityItem; onRemove: () => void }) {
  const [showPreview, setShowPreview] = useState(false);

  const handleDownload = () => {
    if (!item.downloadContent) return;
    if (item.type === "textbook") downloadAsPdf(item.downloadContent, item.downloadFilename || "textbook");
    if (item.type === "presentation") downloadAsPpt(item.downloadContent, item.downloadFilename || "presentation");
  };

  const handleOpenSite = () => {
    if (!item.previewHtml) return;
    const blob = new Blob([item.previewHtml], { type: "text/html" });
    window.open(URL.createObjectURL(blob), "_blank");
  };

  const handleDownloadZip = async () => {
    if (!item.previewHtml) return;
    const zip = new JSZip();
    const folder = zip.folder("webcraft-site")!;
    folder.file("index.html", item.previewHtml);
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "webcraft-site.zip"; a.click();
    URL.revokeObjectURL(url);
  };

  const typeConfig = {
    website: { icon: <Globe className="w-4 h-4" />, color: "text-secondary border-secondary/30 bg-secondary/10", label: "Website" },
    textbook: { icon: <BookOpen className="w-4 h-4" />, color: "text-primary border-primary/30 bg-primary/10", label: "Textbook" },
    presentation: { icon: <Presentation className="w-4 h-4" />, color: "text-accent border-accent/30 bg-accent/10", label: "Presentation" },
  }[item.type];

  return (
    <>
      {showPreview && item.previewHtml && (
        <LivePreviewDialog item={item} onClose={() => setShowPreview(false)} />
      )}

      <Card className="bg-card/50 border-border hover:border-white/20 transition-all group overflow-hidden">
        {item.type === "website" && item.previewHtml && (
          <WebsitePreview html={item.previewHtml} title={item.title} />
        )}

        {item.type !== "website" && (
          <div className={`h-20 flex items-center justify-center ${
            item.type === "textbook" ? "bg-primary/5" : "bg-accent/5"
          } border-b border-border`}>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              item.type === "textbook" ? "bg-primary/20 text-primary" : "bg-accent/20 text-accent"
            }`}>
              {item.type === "textbook"
                ? <BookOpen className="w-6 h-6" />
                : <Presentation className="w-6 h-6" />}
            </div>
          </div>
        )}

        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-white truncate leading-tight">{item.title}</h4>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <Badge variant="outline" className={`text-[10px] px-1.5 h-4 ${typeConfig.color}`}>
                  {typeConfig.label}
                </Badge>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  {format(item.timestamp, "MMM d, h:mm a")}
                </span>
              </div>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
              onClick={onRemove}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>

          {item.type === "website" && item.fileNames && (
            <div className="flex flex-wrap gap-1">
              {item.fileNames.slice(0, 4).map(fn => (
                <span key={fn} className="text-[10px] flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-background border border-border text-muted-foreground font-mono">
                  <FileCode2 className="w-2.5 h-2.5" />{fn}
                </span>
              ))}
              {(item.fileNames.length > 4) && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-background border border-border text-muted-foreground">
                  +{item.fileNames.length - 4} more
                </span>
              )}
            </div>
          )}

          {item.type === "textbook" && item.wordCount && (
            <p className="text-xs text-muted-foreground">
              ~{item.wordCount.toLocaleString()} words · ~{Math.ceil(item.wordCount / 250)} pages
            </p>
          )}
          {item.type === "presentation" && item.slideCount && (
            <p className="text-xs text-muted-foreground">{item.slideCount} slides</p>
          )}

          <div className="flex gap-2 pt-1">
            {item.type === "website" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1.5 text-xs h-7 border-secondary/30 text-secondary hover:bg-secondary/10"
                  onClick={() => setShowPreview(true)}
                >
                  <Eye className="w-3 h-3" /> Live Site
                </Button>
                <Button size="sm" variant="ghost" className="gap-1.5 text-xs h-7 text-muted-foreground hover:text-white" onClick={handleOpenSite}>
                  <ExternalLink className="w-3 h-3" />
                </Button>
                <Button size="sm" variant="ghost" className="gap-1.5 text-xs h-7 text-muted-foreground hover:text-white" onClick={handleDownloadZip}>
                  <Download className="w-3 h-3" />
                </Button>
              </>
            )}
            {(item.type === "textbook" || item.type === "presentation") && item.downloadContent && (
              <Button
                size="sm"
                variant="outline"
                className={`flex-1 gap-1.5 text-xs h-7 ${item.type === "textbook" ? "border-primary/30 text-primary hover:bg-primary/10" : "border-accent/30 text-accent hover:bg-accent/10"}`}
                onClick={handleDownload}
              >
                <Download className="w-3 h-3" />
                {item.type === "textbook" ? "Re-download PDF" : "Re-download PPT"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

export default function Activity() {
  const { data: conversations, isLoading } = useListOpenaiConversations();
  const deleteMutation = useDeleteOpenaiConversation();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"history" | "creativity">("history");
  const { items: creativityItems, removeItem, clearAll } = useCreativityStore();

  const filteredConversations = conversations?.filter(c =>
    c.title.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const filteredCreativity = creativityItems.filter(i =>
    i.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
    if (confirm("Delete this conversation?")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() }),
      });
    }
  };

  return (
    <Shell>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">My Activity</h1>
            <p className="text-muted-foreground text-sm">Your conversation vault and creative outputs.</p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-card border border-border flex items-center justify-center">
            <History className="h-6 w-6 text-muted-foreground" />
          </div>
        </div>

        <div className="flex gap-1 mb-6 bg-card/50 rounded-xl p-1 border border-border w-fit">
          <button
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "history"
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:text-white"
            }`}
          >
            <History className="w-4 h-4" /> Chat History
            {conversations && (
              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                {conversations.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("creativity")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "creativity"
                ? "bg-accent/20 text-accent"
                : "text-muted-foreground hover:text-white"
            }`}
          >
            <Sparkles className="w-4 h-4" /> My Creativity
            {creativityItems.length > 0 && (
              <span className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-full">
                {creativityItems.length}
              </span>
            )}
          </button>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-10 bg-card border-border text-white h-10"
            placeholder={activeTab === "history" ? "Search conversations..." : "Search creative outputs..."}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        {activeTab === "history" && (
          isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-16 bg-card/30 rounded-xl border border-border border-dashed">
              <History className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-muted-foreground">No conversations found.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(grouped).map(([date, convs]) => (
                <div key={date}>
                  <h3 className="text-xs font-medium text-muted-foreground mb-3 sticky top-16 bg-background/90 backdrop-blur-sm py-2 z-10 uppercase tracking-wider">
                    {date}
                  </h3>
                  <div className="space-y-2">
                    {convs.map(conv => (
                      <Link key={conv.id} href={`/${conv.type === "sarathi" ? "sarathi" : conv.type === "webcraft" ? "webcraft" : "manish"}/${conv.id}`}>
                        <Card className="bg-card/50 border-border hover:bg-card/80 hover:border-primary/30 transition-all cursor-pointer group">
                          <CardContent className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`shrink-0 h-9 w-9 rounded-full flex items-center justify-center ${
                                conv.type === "sarathi"
                                  ? "bg-primary/20 text-primary"
                                  : conv.type === "webcraft"
                                  ? "bg-secondary/20 text-secondary"
                                  : "bg-accent/20 text-accent"
                              }`}>
                                {conv.type === "sarathi" ? <Bot className="h-4 w-4" /> : conv.type === "webcraft" ? <Globe className="h-4 w-4" /> : <Heart className="h-4 w-4" />}
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-medium text-white truncate text-sm">{conv.title}</h4>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <Badge variant="outline" className={`text-[10px] px-1.5 h-4 ${
                                    conv.type === "sarathi" ? "border-primary/30 text-primary" : conv.type === "webcraft" ? "border-secondary/30 text-secondary" : "border-accent/30 text-accent"
                                  }`}>
                                    {conv.type}
                                  </Badge>
                                  <span className="text-[10px] text-muted-foreground">
                                    {format(new Date(conv.createdAt), "h:mm a")}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8 shrink-0"
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
          )
        )}

        {activeTab === "creativity" && (
          filteredCreativity.length === 0 ? (
            <div className="text-center py-16 bg-card/30 rounded-xl border border-border border-dashed space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto">
                <Sparkles className="w-8 h-8 text-accent/40" />
              </div>
              <div>
                <p className="text-white font-medium">No creative outputs yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Generate a website in WebCraft, or a textbook/PPT in Sarathi — they'll appear here automatically.
                </p>
              </div>
              <div className="flex justify-center gap-3 pt-2">
                <Link href="/webcraft">
                  <Button size="sm" variant="outline" className="gap-2 border-secondary/30 text-secondary hover:bg-secondary/10">
                    <Globe className="w-3.5 h-3.5" /> Try WebCraft
                  </Button>
                </Link>
                <Link href="/sarathi">
                  <Button size="sm" variant="outline" className="gap-2 border-primary/30 text-primary hover:bg-primary/10">
                    <Sparkles className="w-3.5 h-3.5" /> Try Sarathi
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-muted-foreground">
                  {filteredCreativity.length} item{filteredCreativity.length !== 1 ? "s" : ""} · Saved locally on this device
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-muted-foreground hover:text-destructive gap-1.5 h-7"
                  onClick={() => { if (confirm("Clear all creative outputs?")) clearAll(); }}
                >
                  <Trash2 className="w-3 h-3" /> Clear All
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCreativity.map(item => (
                  <CreativityCard
                    key={item.id}
                    item={item}
                    onRemove={() => removeItem(item.id)}
                  />
                ))}
              </div>
            </>
          )
        )}
      </div>
    </Shell>
  );
}
