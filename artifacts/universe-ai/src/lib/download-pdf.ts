interface Chapter {
  title: string;
  content: string;
}

function parseContent(content: string): { title: string; chapters: Chapter[]; rawContent: string } {
  const lines = content.split("\n");
  let bookTitle = "Universe AI Document";
  const chapters: Chapter[] = [];
  let currentTitle = "";
  let currentLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ")) {
      bookTitle = trimmed.slice(2).trim();
    } else if (trimmed.startsWith("## ")) {
      if (currentLines.length > 0) {
        chapters.push({ title: currentTitle, content: currentLines.join("\n") });
        currentLines = [];
      }
      currentTitle = trimmed.slice(3).trim();
    } else {
      currentLines.push(line);
    }
  }
  if (currentLines.length > 0) {
    chapters.push({ title: currentTitle, content: currentLines.join("\n") });
  }

  return { title: bookTitle, chapters, rawContent: content };
}

function mdToHtml(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/^#{3}\s+(.+)$/gm, "<h4>$1</h4>")
    .replace(/^[-*•]\s+(.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
    .replace(/\n\n+/g, "</p><p>")
    .replace(/^(?!<[hul])/gm, "");
}

export function downloadAsPdf(content: string, filename = "universe-ai-document") {
  const { title, chapters } = parseContent(content);

  const chaptersHtml = chapters
    .map((ch, i) => {
      const bodyHtml = mdToHtml(ch.content);
      return `
      <div class="chapter">
        <div class="chapter-num">Chapter ${i + 1}</div>
        <h2>${ch.title || `Section ${i + 1}`}</h2>
        <div class="chapter-body"><p>${bodyHtml}</p></div>
      </div>`;
    })
    .join("\n");

  const wordCount = content.split(/\s+/).length;
  const pageEst = Math.ceil(wordCount / 250);
  const dateStr = new Date().toLocaleDateString("hi-IN", {
    year: "numeric", month: "long", day: "numeric",
  });

  const html = `<!DOCTYPE html>
<html lang="hi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@300;400;500;600;700&family=Noto+Serif+Devanagari:wght@400;700&display=swap" rel="stylesheet">
<style>
  :root { --accent: #2563eb; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Noto Sans Devanagari', 'Noto Serif Devanagari', Arial Unicode MS, sans-serif;
    font-size: 13pt;
    line-height: 1.6;
    color: #1a1a1a;
    background: #fff;
  }
  .cover {
    height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    background: linear-gradient(135deg, #0a0a1a 0%, #1a1050 100%);
    color: #fff;
    text-align: center;
    padding: 60px;
    page-break-after: always;
  }
  .cover-badge {
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.2);
    color: #a5b4fc;
    padding: 6px 20px;
    border-radius: 999px;
    font-size: 11pt;
    margin-bottom: 32px;
    letter-spacing: 0.05em;
  }
  .cover h1 {
    font-family: 'Noto Serif Devanagari', serif;
    font-size: 36pt;
    font-weight: 700;
    line-height: 1.2;
    margin-bottom: 24px;
    color: #fff;
  }
  .cover-meta { color: #94a3b8; font-size: 11pt; margin-top: 16px; }
  .cover-meta strong { color: #cbd5e1; }
  .toc-page {
    padding: 60px 80px;
    page-break-after: always;
  }
  .toc-page h2 {
    font-size: 22pt;
    color: var(--accent);
    border-bottom: 2px solid var(--accent);
    padding-bottom: 10px;
    margin-bottom: 28px;
  }
  .toc-item {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 8px 0;
    border-bottom: 1px dotted #e2e8f0;
    font-size: 12pt;
    color: #334155;
  }
  .toc-num { color: var(--accent); font-weight: 600; min-width: 28px; }
  .chapter {
    padding: 60px 80px;
    page-break-before: always;
  }
  .chapter-num {
    font-size: 10pt;
    color: var(--accent);
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin-bottom: 10px;
  }
  .chapter h2 {
    font-family: 'Noto Serif Devanagari', serif;
    font-size: 24pt;
    color: #0f172a;
    margin-bottom: 28px;
    line-height: 1.2;
    border-left: 4px solid var(--accent);
    padding-left: 16px;
  }
  .chapter-body { color: #374151; }
  .chapter-body p { margin-bottom: 16px; }
  .chapter-body h4 {
    font-size: 14pt;
    font-weight: 600;
    color: #1e293b;
    margin: 24px 0 10px;
  }
  .chapter-body ul { padding-left: 24px; margin-bottom: 16px; }
  .chapter-body li { margin-bottom: 6px; }
  .print-btn {
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: var(--accent);
    color: white;
    border: none;
    padding: 12px 28px;
    border-radius: 8px;
    font-size: 14px;
    cursor: pointer;
    font-family: inherit;
    box-shadow: 0 4px 20px rgba(37,99,235,0.4);
    z-index: 1000;
  }
  .print-btn:hover { background: #1d4ed8; }
  @media print {
    .print-btn { display: none; }
    body { font-size: 11pt; }
    .cover { height: 100vh; }
    .chapter { padding: 40px 60px; }
  }
  @page { margin: 20mm 18mm; size: A4; }
</style>
</head>
<body>

<div class="cover">
  <div class="cover-badge">Universe AI · Sarathi Chat</div>
  <h1>${title}</h1>
  <div style="width:60px;height:3px;background:#6366f1;border-radius:2px;margin:0 auto 24px;"></div>
  <div class="cover-meta">
    <strong>रचयिता · Author:</strong> Manish Kumar Chaturvedi<br>
    Oteband, Balod, Chhattisgarh, India<br><br>
    <strong>अनुमानित पृष्ठ:</strong> ~${pageEst} pages · ${wordCount.toLocaleString("hi-IN")} शब्द<br>
    <strong>दिनांक:</strong> ${dateStr}
  </div>
</div>

<div class="toc-page">
  <h2>विषय-सूची · Table of Contents</h2>
  ${chapters.map((ch, i) => `
  <div class="toc-item">
    <span class="toc-num">${i + 1}.</span>
    <span>${ch.title || `Section ${i + 1}`}</span>
  </div>`).join("")}
</div>

${chaptersHtml}

<button class="print-btn" onclick="window.print()">🖨 Print / Save as PDF</button>

</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
