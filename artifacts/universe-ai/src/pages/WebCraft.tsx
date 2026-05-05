import { Shell } from "@/components/layout/Shell";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { useRoute, useLocation } from "wouter";
import { useCreateOpenaiConversation } from "@workspace/api-client-react";
import {
  Terminal, Eye, Share2, Code2, Download, X, ExternalLink,
  History, CheckCircle2, FileCode2, RotateCcw, User, Bot, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useRef, useCallback } from "react";
import { type ChatMessage } from "@/hooks/use-chat-stream";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import JSZip from "jszip";

interface ProjectFile {
  name: string;
  content: string;
  lang: string;
}

interface VersionSnapshot {
  version: number;
  timestamp: Date;
  files: ProjectFile[];
  description: string;
}

const EXT_TO_LANG: Record<string, string> = {
  html: "html", css: "css", js: "javascript", ts: "typescript",
  jsx: "jsx", tsx: "tsx", json: "json", py: "python",
  md: "markdown", txt: "text", sh: "bash", sql: "sql",
};

function extractFilesFromContent(content: string): ProjectFile[] {
  const files = new Map<string, ProjectFile>();
  let blockIdx = 0;

  const codeBlocks = content.matchAll(/```(\w+)?\n([\s\S]*?)```/g);
  for (const match of codeBlocks) {
    const lang = (match[1] || "text").toLowerCase();
    const code = match[2].trim();
    if (!code) { blockIdx++; continue; }

    const beforeBlock = content.slice(0, match.index || 0);
    const lastLines = beforeBlock.split("\n").slice(-5).join("\n");

    const filenameMatch =
      lastLines.match(/`([^`]+\.[a-z]{1,5})`/i) ||
      lastLines.match(/\*\*([^*]+\.[a-z]{1,5})\*\*/i) ||
      lastLines.match(/(?:file:|filename:|save as|create|named?)\s*[:`]?\s*([^\s,\n"']+\.[a-z]{1,5})/i);

    let filename: string;
    if (filenameMatch) {
      filename = filenameMatch[1];
    } else {
      if (lang === "html") filename = "index.html";
      else if (lang === "css") filename = "style.css";
      else if (lang === "javascript" || lang === "js") filename = blockIdx === 0 ? "script.js" : `script${blockIdx}.js`;
      else if (lang === "typescript" || lang === "ts") filename = "index.ts";
      else if (lang === "python" || lang === "py") filename = "main.py";
      else {
        const ext = lang.length <= 5 ? lang : "txt";
        filename = `file${blockIdx > 0 ? blockIdx : ""}.${ext}`;
      }
    }

    const ext = filename.split(".").pop() || "txt";
    const detectedLang = EXT_TO_LANG[ext] || lang;
    files.set(filename, { name: filename, content: code, lang: detectedLang });
    blockIdx++;
  }

  return Array.from(files.values());
}

function extractAllFiles(messages: ChatMessage[]): ProjectFile[] {
  const allFiles = new Map<string, ProjectFile>();
  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    const msgFiles = extractFilesFromContent(msg.content);
    for (const f of msgFiles) allFiles.set(f.name, f);
  }
  return Array.from(allFiles.values());
}

function stripCodeBlocks(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildPreviewHtml(files: ProjectFile[]): string {
  const htmlFile = files.find(f => f.name.endsWith(".html"));
  const cssFile = files.find(f => f.name.endsWith(".css"));
  const jsFile = files.find(f => f.name.endsWith(".js") || f.name.endsWith(".ts"));

  if (!htmlFile && !cssFile && !jsFile) return "";

  if (htmlFile) {
    let html = htmlFile.content;
    if (cssFile && !html.includes("<style>")) {
      html = html.replace("</head>", `<style>${cssFile.content}</style></head>`);
    }
    if (jsFile && !html.includes("<script>")) {
      html = html.replace("</body>", `<script>${jsFile.content}</script></body>`);
    }
    return html;
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>${cssFile?.content || ""}</style></head>
<body>${jsFile ? `<script>${jsFile.content}</script>` : ""}</body>
</html>`;
}

function BuildCard({
  msg,
  onViewLive,
  onViewCode,
  isLatest,
}: {
  msg: ChatMessage;
  onViewLive: () => void;
  onViewCode: () => void;
  isLatest: boolean;
}) {
  const files = extractFilesFromContent(msg.content);
  const description = stripCodeBlocks(msg.content);
  const totalLines = files.reduce((sum, f) => sum + f.content.split("\n").length, 0);

  return (
    <div className="flex gap-3 justify-start">
      <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-1 bg-secondary/20 text-secondary">
        <Bot className="h-4 w-4" />
      </div>
      <div className="flex-1 max-w-[85%] space-y-2">
        {description && (
          <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-card border border-border text-card-foreground text-sm">
            <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{description}</p>
          </div>
        )}

        <div className={`rounded-xl border p-4 space-y-3 ${isLatest ? "border-secondary/40 bg-secondary/5" : "border-border bg-card/30"}`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className={`w-4 h-4 ${isLatest ? "text-secondary" : "text-muted-foreground"}`} />
            <span className={`text-sm font-semibold ${isLatest ? "text-secondary" : "text-muted-foreground"}`}>
              {isLatest ? "Build Complete — Site Updated" : "Previous Build"}
            </span>
            {isLatest && (
              <span className="ml-auto flex items-center gap-1 text-xs text-secondary bg-secondary/10 px-2 py-0.5 rounded-full">
                <Zap className="w-3 h-3" /> Latest
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {files.map(f => (
              <div key={f.name} className="flex items-center gap-1 px-2 py-1 rounded-md bg-background/60 border border-border text-xs font-mono text-muted-foreground">
                <FileCode2 className="w-3 h-3" />
                {f.name}
              </div>
            ))}
            <span className="text-xs text-muted-foreground self-center">{totalLines} lines total</span>
          </div>

          {isLatest && (
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={onViewLive} className="gap-2 text-xs border-secondary/30 text-secondary hover:bg-secondary/10 h-7">
                <Eye className="w-3 h-3" /> Live Preview
              </Button>
              <Button size="sm" variant="ghost" onClick={onViewCode} className="gap-2 text-xs text-muted-foreground hover:text-white h-7">
                <Code2 className="w-3 h-3" /> View Code
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WebCraft() {
  const [match, params] = useRoute("/webcraft/:id");
  const [, setLocation] = useLocation();
  const conversationId = match && params?.id ? parseInt(params.id, 10) : undefined;

  const createConversation = useCreateOpenaiConversation();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showCode, setShowCode] = useState(false);
  const [showLive, setShowLive] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [activeFile, setActiveFile] = useState(0);
  const [versions, setVersions] = useState<VersionSnapshot[]>([]);
  const [restoredFiles, setRestoredFiles] = useState<ProjectFile[] | null>(null);
  const previewRef = useRef<HTMLIFrameElement>(null);
  const lastVersionCount = useRef(0);

  const currentFiles = restoredFiles ?? extractAllFiles(messages);
  const previewHtml = buildPreviewHtml(currentFiles);
  const hasFiles = currentFiles.length > 0;

  useEffect(() => {
    const assistantMsgs = messages.filter(m => m.role === "assistant");
    if (assistantMsgs.length > lastVersionCount.current) {
      const lastMsg = assistantMsgs[assistantMsgs.length - 1];
      const msgFiles = extractFilesFromContent(lastMsg.content);
      if (msgFiles.length > 0) {
        const desc = stripCodeBlocks(lastMsg.content);
        const shortDesc = desc.split("\n")[0]?.slice(0, 80) || `Build v${versions.length + 1}`;
        setVersions(prev => [
          ...prev,
          {
            version: prev.length + 1,
            timestamp: new Date(),
            files: msgFiles,
            description: shortDesc || `Build v${prev.length + 1}`,
          },
        ]);
        setRestoredFiles(null);
      }
      lastVersionCount.current = assistantMsgs.length;
    }
  }, [messages]);

  useEffect(() => {
    if (showLive && previewRef.current && previewHtml) {
      const blob = new Blob([previewHtml], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      previewRef.current.src = url;
      return () => URL.revokeObjectURL(url);
    }
  }, [showLive, previewHtml]);

  const handleNewMessage = (content: string) => {
    const title = content.split(" ").slice(0, 5).join(" ") + "...";
    createConversation.mutate({ data: { title, type: "sarathi" } }, {
      onSuccess: newConv => setLocation(`/webcraft/${newConv.id}`),
    });
  };

  const handleDownloadZip = async () => {
    if (!hasFiles) return;
    const zip = new JSZip();
    const folder = zip.folder("webcraft-project")!;
    for (const f of currentFiles) folder.file(f.name, f.content);
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "webcraft-project.zip";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShareLink = () => {
    if (!previewHtml) return;
    const blob = new Blob([previewHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  const handleRestoreVersion = (snapshot: VersionSnapshot) => {
    setRestoredFiles(snapshot.files);
    setShowHistory(false);
  };

  const assistantMsgIds = messages.filter(m => m.role === "assistant" && extractFilesFromContent(m.content).length > 0).map(m => m.id);
  const latestBuildId = assistantMsgIds[assistantMsgIds.length - 1];

  const messageRenderer = useCallback(
    (msg: ChatMessage, _brandBgClass: string): React.ReactNode | null => {
      if (msg.role === "user") {
        return (
          <div className="flex gap-4 justify-end">
            <div className="px-4 py-3 rounded-2xl max-w-[80%] text-sm bg-primary text-primary-foreground rounded-tr-sm">
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
            </div>
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1">
              <User className="h-4 w-4" />
            </div>
          </div>
        );
      }

      const hasCodes = extractFilesFromContent(msg.content).length > 0;
      if (!hasCodes) {
        return (
          <div className="flex gap-4 justify-start">
            <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-1 bg-secondary/20 text-secondary">
              <Bot className="h-4 w-4" />
            </div>
            <div className="px-4 py-3 rounded-2xl max-w-[85%] text-sm bg-card border border-border text-card-foreground rounded-tl-sm">
              <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">{msg.content}</p>
            </div>
          </div>
        );
      }

      return (
        <BuildCard
          msg={msg}
          isLatest={msg.id === latestBuildId}
          onViewLive={() => setShowLive(true)}
          onViewCode={() => { setActiveFile(0); setShowCode(true); }}
        />
      );
    },
    [latestBuildId]
  );

  const HeaderMenu = () => (
    <div className="flex items-center gap-1.5 flex-wrap justify-end">
      <Button
        variant="outline"
        size="sm"
        disabled={!hasFiles}
        onClick={() => setShowLive(true)}
        className={`gap-1.5 text-xs h-8 ${hasFiles ? "border-secondary/40 text-secondary hover:bg-secondary/10" : "opacity-40"}`}
      >
        <Eye className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Live Site</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={!hasFiles}
        onClick={() => { setActiveFile(0); setShowCode(true); }}
        className={`gap-1.5 text-xs h-8 ${hasFiles ? "border-secondary/40 text-secondary hover:bg-secondary/10" : "opacity-40"}`}
      >
        <Code2 className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Show Code</span>
        {hasFiles && (
          <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4 bg-secondary/20 text-secondary border-0">
            {currentFiles.length}
          </Badge>
        )}
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={!hasFiles || !previewHtml}
        onClick={handleShareLink}
        className={`gap-1.5 text-xs h-8 ${hasFiles ? "border-secondary/40 text-secondary hover:bg-secondary/10" : "opacity-40"}`}
      >
        <Share2 className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Site Link</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={!hasFiles}
        onClick={handleDownloadZip}
        className={`gap-1.5 text-xs h-8 ${hasFiles ? "border-secondary/40 text-secondary hover:bg-secondary/10" : "opacity-40"}`}
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Download</span>
      </Button>
      {versions.length > 1 && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowHistory(true)}
          className="gap-1.5 text-xs h-8 border-border text-muted-foreground hover:text-white hover:border-white/30"
        >
          <History className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">History</span>
          <Badge variant="outline" className="text-xs px-1.5 py-0 h-4 border-white/20">
            {versions.length}
          </Badge>
        </Button>
      )}
    </div>
  );

  const EmptyState = () => (
    <>
      <div className="h-20 w-20 rounded-xl bg-secondary/20 flex items-center justify-center border border-secondary/30">
        <Terminal className="h-10 w-10 text-secondary" />
      </div>
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">WebCraft Pro</h2>
        <p className="text-lg text-muted-foreground">Bolo kya banana hai — AI silently files create kar dega. No code visible in chat.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mt-6">
        {[
          "Build a dark portfolio website for a developer",
          "Create a calculator with animations",
          "Make a modern landing page for a startup",
          "Build a todo app with dark theme and local storage",
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
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Zap className="w-3 h-3 text-secondary" />
        <span>Infinite revisions supported · Live Site · ZIP Download · Version History</span>
      </div>
    </>
  );

  return (
    <Shell>
      <div className="flex flex-1 h-[calc(100vh-64px)] overflow-hidden">
        <div className="flex-1 min-w-0">
          <ChatInterface
            conversationId={conversationId}
            title="WebCraft Pro"
            placeholder="Describe what to build or what to change..."
            brandColor="secondary"
            emptyStateContent={<EmptyState />}
            headerContent={<HeaderMenu />}
            onNewMessage={handleNewMessage}
            onMessagesChange={setMessages}
            messageRenderer={messageRenderer}
            systemPrompt={`You are WebCraft Pro — Universe AI's silent background developer engine.

CRITICAL RULES:
1. NEVER explain that you will generate code or talk about the process.
2. ALWAYS output complete, working files in code blocks.
3. Label files clearly before each block, e.g.: "index.html", "style.css", "script.js"
4. Make each file a separate code block with correct language tag (html, css, javascript).
5. After the code blocks, write ONLY 1-2 sentences describing what was built.
6. For ANY revision/change request: regenerate ALL files completely updated — never partial code.
7. Make designs visually stunning: gradients, animations, modern fonts, professional look.
8. Include ALL functionality the user asked for — fully working, no placeholders.

Example output format:
\`index.html\`
\`\`\`html
<!DOCTYPE html>...
\`\`\`

\`style.css\`
\`\`\`css
...
\`\`\`

\`script.js\`
\`\`\`javascript
...
\`\`\`

Portfolio website with dark theme, smooth animations aur contact form ready hai.

Creator: Manish Kumar Chaturvedi, Oteband, Balod, Chhattisgarh, India.`}
          />
        </div>
      </div>

      {/* Show Code Dialog */}
      <Dialog open={showCode} onOpenChange={setShowCode}>
        <DialogContent className="bg-[#0a0a12] border-border max-w-5xl w-full max-h-[90vh] p-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-secondary" />
              <span className="font-semibold text-white text-sm">Generated Files</span>
              <span className="text-xs text-muted-foreground">· {currentFiles.length} file{currentFiles.length !== 1 ? "s" : ""}</span>
              {restoredFiles && (
                <Badge variant="outline" className="text-xs border-accent/30 text-accent">Restored Version</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-xs text-muted-foreground"
                onClick={handleDownloadZip}
              >
                <Download className="w-3.5 h-3.5" /> Download ZIP
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setShowCode(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="flex h-[calc(90vh-57px)] overflow-hidden">
            <div className="w-44 border-r border-border bg-background/50 flex flex-col p-2 gap-1 shrink-0 overflow-y-auto">
              {currentFiles.map((f, i) => (
                <button
                  key={f.name}
                  className={`text-left px-3 py-2 rounded text-xs font-mono truncate transition-colors ${
                    i === activeFile
                      ? "bg-secondary/20 text-secondary"
                      : "text-muted-foreground hover:text-white hover:bg-white/5"
                  }`}
                  onClick={() => setActiveFile(i)}
                >
                  {f.name}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-auto">
              {currentFiles[activeFile] && (
                <SyntaxHighlighter
                  language={currentFiles[activeFile].lang}
                  style={oneDark}
                  customStyle={{ margin: 0, borderRadius: 0, minHeight: "100%", fontSize: "0.8rem" }}
                  showLineNumbers
                >
                  {currentFiles[activeFile].content}
                </SyntaxHighlighter>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Live Site Dialog */}
      <Dialog open={showLive} onOpenChange={setShowLive}>
        <DialogContent className="bg-card border-border max-w-6xl w-full max-h-[92vh] p-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-destructive/60" />
              <div className="w-3 h-3 rounded-full bg-accent/60" />
              <div className="w-3 h-3 rounded-full bg-secondary/60" />
              <span className="font-semibold text-white text-sm ml-2">Live Site Preview</span>
              {restoredFiles && (
                <Badge variant="outline" className="text-xs border-accent/30 text-accent">Restored Version</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="gap-2 text-xs text-muted-foreground" onClick={handleShareLink}>
                <ExternalLink className="w-3.5 h-3.5" /> Open in tab
              </Button>
              <Button variant="ghost" size="sm" className="gap-2 text-xs text-muted-foreground" onClick={handleDownloadZip}>
                <Download className="w-3.5 h-3.5" /> Download ZIP
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setShowLive(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="bg-white h-[calc(92vh-57px)]">
            <iframe
              ref={previewRef}
              className="w-full h-full border-0"
              title="Live Site Preview"
              sandbox="allow-scripts allow-same-origin allow-forms"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Version History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="bg-card border-border max-w-lg w-full">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-secondary" />
              <span className="font-semibold text-white">Build History</span>
              <span className="text-xs text-muted-foreground">· {versions.length} versions</span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setShowHistory(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {[...versions].reverse().map((snap, i) => (
              <div
                key={snap.version}
                className={`p-4 rounded-xl border transition-colors ${
                  i === 0 ? "border-secondary/40 bg-secondary/5" : "border-border bg-card/30"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-secondary">v{snap.version}</span>
                      {i === 0 && <Badge variant="outline" className="text-xs border-secondary/30 text-secondary h-4 px-1">Latest</Badge>}
                      <span className="text-xs text-muted-foreground">{snap.timestamp.toLocaleTimeString()}</span>
                    </div>
                    <p className="text-sm text-white truncate">{snap.description}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {snap.files.map(f => (
                        <span key={f.name} className="text-xs font-mono text-muted-foreground bg-background/50 px-1.5 py-0.5 rounded">
                          {f.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  {i !== 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs border-border text-muted-foreground hover:text-white shrink-0 h-7"
                      onClick={() => handleRestoreVersion(snap)}
                    >
                      <RotateCcw className="w-3 h-3" /> Restore
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {restoredFiles && (
            <div className="mt-3 pt-3 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 text-xs border-secondary/30 text-secondary hover:bg-secondary/10"
                onClick={() => { setRestoredFiles(null); setShowHistory(false); }}
              >
                <Zap className="w-3.5 h-3.5" /> Back to Latest Build
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Shell>
  );
}
