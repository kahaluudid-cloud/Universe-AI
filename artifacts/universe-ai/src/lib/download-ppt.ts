interface Slide {
  title: string;
  bullets: string[];
  notes?: string;
}

function parseSlides(content: string): { presentationTitle: string; slides: Slide[] } {
  const lines = content.split("\n");
  let presentationTitle = "Universe AI Presentation";
  const slides: Slide[] = [];
  let currentSlide: Slide | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("# ")) {
      presentationTitle = trimmed.slice(2);
    } else if (
      trimmed.startsWith("## ") ||
      /^slide\s*\d+/i.test(trimmed) ||
      /^\*\*slide\s*\d+/i.test(trimmed)
    ) {
      if (currentSlide) slides.push(currentSlide);
      const title = trimmed
        .replace(/^#+\s*/, "")
        .replace(/\*\*/g, "")
        .replace(/^slide\s*\d+[:\-—]?\s*/i, "")
        .trim();
      currentSlide = { title: title || `Slide ${slides.length + 1}`, bullets: [] };
    } else if (currentSlide) {
      const bullet = trimmed
        .replace(/^[-*•]\s+/, "")
        .replace(/^\d+\.\s+/, "")
        .replace(/\*\*/g, "");
      if (bullet) currentSlide.bullets.push(bullet);
    }
  }

  if (currentSlide) slides.push(currentSlide);

  if (slides.length === 0) {
    const chunks = content.split(/\n{2,}/);
    chunks.forEach((chunk, i) => {
      const chunkLines = chunk.split("\n").filter(l => l.trim());
      if (chunkLines.length > 0) {
        slides.push({
          title: chunkLines[0].replace(/^#+\s*/, "").replace(/\*\*/g, "") || `Slide ${i + 1}`,
          bullets: chunkLines.slice(1).map(l => l.replace(/^[-*•]\s+/, "").replace(/\*\*/g, "")),
        });
      }
    });
  }

  return { presentationTitle, slides };
}

export function downloadAsPpt(content: string, filename = "universe-ai-presentation") {
  const { presentationTitle, slides } = parseSlides(content);

  const COLORS = [
    ["#0a0a1a", "#00d2ff"],
    ["#0d1b2a", "#7c3aed"],
    ["#0a1628", "#06b6d4"],
    ["#100720", "#a855f7"],
    ["#041b1b", "#10b981"],
    ["#1a0a00", "#f59e0b"],
  ];

  const slideHtmls = slides.map((slide, i) => {
    const [bg, accent] = COLORS[i % COLORS.length];
    const bulletItems = slide.bullets
      .map(b => `<li>${b}</li>`)
      .join("");

    return `
    <section class="slide" data-index="${i}" style="background:${bg}; display:${i === 0 ? "flex" : "none"}; flex-direction:column; justify-content:center; align-items:flex-start; padding:8% 10%; min-height:100vh; box-sizing:border-box; position:absolute; inset:0; transition: opacity 0.5s;">
      <div class="slide-num" style="position:absolute; top:24px; right:32px; font-size:13px; color:${accent}80; font-family:monospace;">${i + 1} / ${slides.length}</div>
      <div style="width:48px; height:4px; background:${accent}; border-radius:2px; margin-bottom:32px;"></div>
      <h2 style="color:#ffffff; font-size:clamp(24px, 4vw, 48px); font-weight:800; margin:0 0 32px; line-height:1.1; font-family:system-ui,sans-serif; max-width:85%;">${slide.title}</h2>
      ${bulletItems ? `<ul style="color:#c0cfe0; font-size:clamp(14px, 2vw, 20px); line-height:1.7; padding-left:0; list-style:none; margin:0; max-width:90%;">
        ${slide.bullets.map(b => `<li style="display:flex;gap:12px;align-items:flex-start;margin-bottom:12px;"><span style="color:${accent};font-size:1.2em;margin-top:2px;">▸</span><span>${b}</span></li>`).join("")}
      </ul>` : ""}
      <div style="position:absolute; bottom:0; left:0; right:0; height:3px; background:linear-gradient(90deg,${accent},transparent);"></div>
    </section>`;
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${presentationTitle}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#000;font-family:system-ui,sans-serif;overflow:hidden;height:100vh}
  .slide-container{position:relative;width:100vw;height:100vh}
  .slide{position:absolute;inset:0}
  .controls{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);display:flex;gap:12px;z-index:100}
  .btn{padding:10px 24px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.08);color:#fff;border-radius:8px;cursor:pointer;font-size:14px;transition:background .2s;backdrop-filter:blur(8px)}
  .btn:hover{background:rgba(255,255,255,.18)}
  .btn:disabled{opacity:.3;cursor:default}
  .progress{position:fixed;top:0;left:0;height:3px;background:linear-gradient(90deg,#00d2ff,#7c3aed);transition:width .4s;z-index:100}
  .title-overlay{position:fixed;top:16px;left:24px;color:rgba(255,255,255,.4);font-size:13px;z-index:100}
  @media(max-width:640px){h2{font-size:22px!important}ul{font-size:14px!important}}
</style>
</head>
<body>
<div class="progress" id="prog"></div>
<div class="title-overlay">${presentationTitle}</div>
<div class="slide-container">
${slideHtmls.join("\n")}
</div>
<div class="controls">
  <button class="btn" id="prev" onclick="go(-1)">&#8592; Prev</button>
  <span class="btn" id="counter" style="cursor:default;min-width:80px;text-align:center">1 / ${slides.length}</span>
  <button class="btn" id="next" onclick="go(1)">Next &#8594;</button>
</div>
<script>
  let cur=0;
  const slides=document.querySelectorAll('.slide');
  const total=${slides.length};
  function go(d){
    slides[cur].style.display='none';
    cur=Math.max(0,Math.min(total-1,cur+d));
    slides[cur].style.display='flex';
    document.getElementById('counter').textContent=(cur+1)+' / '+total;
    document.getElementById('prev').disabled=cur===0;
    document.getElementById('next').disabled=cur===total-1;
    document.getElementById('prog').style.width=((cur+1)/total*100)+'%';
  }
  document.addEventListener('keydown',e=>{
    if(e.key==='ArrowRight'||e.key===' ')go(1);
    if(e.key==='ArrowLeft')go(-1);
  });
  go(0);
</scr${"ipt"}>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
