import { Shell } from "@/components/layout/Shell";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { useRoute, useLocation } from "wouter";
import { useCreateOpenaiConversation } from "@workspace/api-client-react";
import { Terminal, Eye, Share2, Code2, Download, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useState, useCallback, useEffect, useRef } from "react";
import { type ChatMessage } from "@/hooks/use-chat-stream";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import JSZip from "jszip";

interface ProjectFile {
  name: string;
  content: string;
  lang: string;
}

function extractFilesFromMessages(messages: ChatMessage[]): ProjectFile[] {
  const files: Map<string, ProjectFile> = new Map();

  const EXT_TO_LANG: Record<string, string> = {
    html: "html", css: "css", js: "javascript", ts: "typescript",
    jsx: "jsx", tsx: "tsx", json: "json", py: "python",
    md: "markdown", txt: "text", sh: "bash",
  };

  for (const msg of messages) {
    if (msg.role !== "assistant") continue;

    const codeBlocks = msg.content.matchAll(/```(\w+)?\n([\s\S]*?)```/g);
    let blockIdx = 0;

    for (const match of codeBlocks) {
      const lang = (match[1] || "text").toLowerCase();
      const code = match[2].trim();

      let filename: string | null = null;
      const beforeBlock = msg.content.slice(0, match.index || 0);
      const lastLines = beforeBlock.split("\n").slice(-4).join("\n");

      const filenameMatch =
        lastLines.match(/`([^`]+\.\w+)`/) ||
        lastLines.match(/\*\*([^*]+\.\w+)\*\*/) ||
        lastLines.match(/(?:file:|filename:|save as|create)\s*[:`]?\s*([^\s,\n]+\.\w+)/i);

      if (filenameMatch) {
        filename = filenameMatch[1];
      } else {
        const ext = lang === "javascript" ? "js" : lang === "typescript" ? "ts" : lang === "python" ? "py" : lang;
        if (lang === "html") filename = "index.html";
        else if (lang === "css") filename = "style.css";
        else if (lang === "javascript" || lang === "js") filename = "script.js";
        else filename = `file${blockIdx > 0 ? blockIdx : ""}.${ext}`;
      }

      const ext = filename.split(".").pop() || "txt";
      const detectedLang = EXT_TO_LANG[ext] || lang;

      if (!files.has(filename)) {
        files.set(filename, { name: filename, content: code, lang: detectedLang });
      } else {
        files.set(filename, { name: filename, content: code, lang: detectedLang });
      }
      blockIdx++;
    }
  }

  return Array.from(files.values());
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

export default function WebCraft() {
  const [match, params] = useRoute("/webcraft/:id");
  const [, setLocation] = useLocation();
  const conversationId = match && params?.id ? parseInt(params.id, 10) : undefined;

  const createConversation = useCreateOpenaiConversation();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showCode, setShowCode] = useState(false);
  const [showLive, setShowLive] = useState(false);
  const [activeFile, setActiveFile] = useState(0);
  const previewRef = useRef<HTMLIFrameElement>(null);

  const files = extractFilesFromMessages(messages);
  const previewHtml = buildPreviewHtml(files);

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
      onSuccess: (newConv) => {
        setLocation(`/webcraft/${newConv.id}`);
      },
    });
  };

  const handleDownloadZip = async () => {
    if (files.length === 0) return;
    const zip = new JSZip();
    const folder = zip.folder("webcraft-project")!;
    for (const f of files) {
      folder.file(f.name, f.content);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "webcraft-project.zip";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShareLink = () => {
    if (previewHtml) {
      const blob = new Blob([previewHtml], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    }
  };

  const hasFiles = files.length > 0;

  const HeaderMenu = () => (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      <Button
        variant="outline"
        size="sm"
        className={`gap-2 text-xs ${hasFiles ? "border-secondary/40 text-secondary hover:bg-secondary/10" : "text-muted-foreground opacity-50"}`}
        onClick={() => hasFiles && setShowLive(true)}
        disabled={!hasFiles}
        title="Live Site Preview"
      >
        <Eye className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Live Site</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        className={`gap-2 text-xs ${hasFiles ? "border-secondary/40 text-secondary hover:bg-secondary/10" : "text-muted-foreground opacity-50"}`}
        onClick={() => hasFiles && setShowCode(true)}
        disabled={!hasFiles}
        title="Show Generated Code"
      >
        <Code2 className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Show Code</span>
        {hasFiles && <span className="bg-secondary/20 text-secondary text-xs px-1.5 py-0.5 rounded-full">{files.length}</span>}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className={`gap-2 text-xs ${hasFiles ? "border-secondary/40 text-secondary hover:bg-secondary/10" : "text-muted-foreground opacity-50"}`}
        onClick={handleShareLink}
        disabled={!hasFiles || !previewHtml}
        title="Open site link"
      >
        <Share2 className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Site Link</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        className={`gap-2 text-xs ${hasFiles ? "border-secondary/40 text-secondary hover:bg-secondary/10" : "text-muted-foreground opacity-50"}`}
        onClick={handleDownloadZip}
        disabled={!hasFiles}
        title="Download as ZIP"
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Download</span>
      </Button>
    </div>
  );

  const EmptyState = () => (
    <>
      <div className="h-20 w-20 rounded-xl bg-secondary/20 flex items-center justify-center border border-secondary/30">
        <Terminal className="h-10 w-10 text-secondary" />
      </div>
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">WebCraft Pro</h2>
        <p className="text-lg text-muted-foreground">Describe what to build — AI creates it silently in the background.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mt-8">
        {[
          "Build a portfolio website with dark theme",
          "Create a calculator with HTML, CSS, JS",
          "Make a landing page for a mobile app",
          "Build a todo app with local storage",
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

  return (
    <Shell>
      <div className="flex flex-1 h-[calc(100vh-64px)] overflow-hidden">
        <div className="flex-1 min-w-0">
          <ChatInterface
            conversationId={conversationId}
            title="WebCraft Pro"
            placeholder="Describe what you want to build (e.g. Make a portfolio site)..."
            brandColor="secondary"
            emptyStateContent={<EmptyState />}
            headerContent={<HeaderMenu />}
            onNewMessage={handleNewMessage}
            onMessagesChange={setMessages}
            systemPrompt={`You are WebCraft Pro — Universe AI's silent developer engine. When user asks to build something:

1. Generate complete, working HTML/CSS/JS code.
2. ALWAYS output files with clear labels like: \`index.html\`, \`style.css\`, \`script.js\`
3. Put each file in its own code block with the correct language tag.
4. Make the code production-ready, visually stunning, fully functional.
5. After generating, briefly explain what was built (1-2 lines only).
6. For revision requests: regenerate the full updated files — not just the diff.
7. Support infinite revisions — every change request gets new full files.

Creator: Manish Kumar Chaturvedi, Oteband, Balod, Chhattisgarh, India.`}
          />
        </div>
      </div>

      <Dialog open={showCode} onOpenChange={setShowCode}>
        <DialogContent className="bg-card border-border max-w-4xl w-full max-h-[85vh] p-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-secondary" />
              <span className="font-semibold text-white text-sm">Generated Files</span>
              <span className="text-xs text-muted-foreground">({files.length} file{files.length !== 1 ? "s" : ""})</span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setShowCode(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex h-[calc(85vh-56px)] overflow-hidden">
            <div className="w-40 border-r border-border bg-background/50 flex flex-col gap-1 p-2 shrink-0">
              {files.map((f, i) => (
                <button
                  key={f.name}
                  className={`text-left px-3 py-2 rounded text-xs font-mono truncate transition-colors ${i === activeFile ? "bg-secondary/20 text-secondary" : "text-muted-foreground hover:text-white hover:bg-white/5"}`}
                  onClick={() => setActiveFile(i)}
                >
                  {f.name}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-auto">
              {files[activeFile] && (
                <SyntaxHighlighter
                  language={files[activeFile].lang}
                  style={oneDark}
                  customStyle={{ margin: 0, borderRadius: 0, height: "100%", fontSize: "0.8rem" }}
                  showLineNumbers
                >
                  {files[activeFile].content}
                </SyntaxHighlighter>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showLive} onOpenChange={setShowLive}>
        <DialogContent className="bg-card border-border max-w-5xl w-full max-h-[90vh] p-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-secondary" />
              <span className="font-semibold text-white text-sm">Live Site Preview</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="gap-2 text-xs text-muted-foreground" onClick={handleShareLink}>
                <ExternalLink className="w-3.5 h-3.5" /> Open in tab
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setShowLive(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="bg-white h-[calc(90vh-56px)]">
            <iframe
              ref={previewRef}
              className="w-full h-full border-0"
              title="Live Site Preview"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </DialogContent>
      </Dialog>
    </Shell>
  );
}
