import { jsPDF } from "jspdf";

interface Chapter {
  title: string;
  sections: { heading: string; body: string }[];
}

function parseChapters(content: string): { title: string; chapters: Chapter[] } {
  const lines = content.split("\n");
  let bookTitle = "Universe AI Textbook";
  const chapters: Chapter[] = [];
  let currentChapter: Chapter | null = null;
  let currentSection: { heading: string; body: string } | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("# ")) {
      bookTitle = trimmed.slice(2);
    } else if (trimmed.startsWith("## ") || /^chapter\s+\d+/i.test(trimmed)) {
      if (currentSection && currentChapter) {
        currentChapter.sections.push(currentSection);
        currentSection = null;
      }
      if (currentChapter) chapters.push(currentChapter);
      currentChapter = { title: trimmed.replace(/^#+\s*/, ""), sections: [] };
    } else if (trimmed.startsWith("### ")) {
      if (currentSection && currentChapter) {
        currentChapter.sections.push(currentSection);
      }
      currentSection = { heading: trimmed.slice(4), body: "" };
    } else {
      if (currentSection) {
        currentSection.body += (currentSection.body ? "\n" : "") + trimmed;
      } else if (currentChapter) {
        if (currentChapter.sections.length === 0) {
          currentChapter.sections.push({ heading: "", body: trimmed });
        } else {
          currentChapter.sections[currentChapter.sections.length - 1].body +=
            "\n" + trimmed;
        }
      }
    }
  }

  if (currentSection && currentChapter) currentChapter.sections.push(currentSection);
  if (currentChapter) chapters.push(currentChapter);

  return { title: bookTitle, chapters };
}

export function downloadAsPdf(content: string, filename = "universe-ai-document") {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const { title, chapters } = parseChapters(content);

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const marginL = 20;
  const marginR = 20;
  const marginT = 20;
  const marginB = 25;
  const textW = pageW - marginL - marginR;
  let y = marginT;

  const addPage = () => {
    pdf.addPage();
    y = marginT;
    pdf.setFontSize(8);
    pdf.setTextColor(150);
    pdf.text(`${title} · Universe AI · Manish Kumar Chaturvedi`, marginL, pageH - 8);
    pdf.text(`${pdf.internal.pages.length - 1}`, pageW - marginR, pageH - 8, { align: "right" });
    pdf.setTextColor(0);
  };

  const checkSpace = (needed: number) => {
    if (y + needed > pageH - marginB) addPage();
  };

  const addText = (text: string, size: number, color: [number, number, number], bold = false, indent = 0) => {
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
    if (bold) pdf.setFont("helvetica", "bold");
    else pdf.setFont("helvetica", "normal");

    const lines = pdf.splitTextToSize(text, textW - indent);
    for (const line of lines) {
      checkSpace(size * 0.5 + 2);
      pdf.text(line, marginL + indent, y);
      y += size * 0.5 + 1.5;
    }
    pdf.setTextColor(0);
  };

  pdf.setFillColor(10, 10, 30);
  pdf.rect(0, 0, pageW, pageH, "F");
  pdf.setFontSize(28);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(255, 255, 255);
  const titleLines = pdf.splitTextToSize(title, pageW - 40);
  const titleY = pageH / 2 - titleLines.length * 8;
  for (let i = 0; i < titleLines.length; i++) {
    pdf.text(titleLines[i], pageW / 2, titleY + i * 16, { align: "center" });
  }

  pdf.setFontSize(12);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(150, 180, 255);
  pdf.text("Universe AI · Sarathi Chat", pageW / 2, pageH / 2 + 20, { align: "center" });
  pdf.setTextColor(120, 120, 120);
  pdf.text("By Manish Kumar Chaturvedi · Oteband, Balod, Chhattisgarh", pageW / 2, pageH / 2 + 30, { align: "center" });
  pdf.text(new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" }), pageW / 2, pageH / 2 + 40, { align: "center" });

  pdf.addPage();
  y = marginT;

  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(30, 100, 200);
  pdf.text("Table of Contents", marginL, y);
  y += 10;
  pdf.setDrawColor(30, 100, 200);
  pdf.setLineWidth(0.5);
  pdf.line(marginL, y, pageW - marginR, y);
  y += 6;

  chapters.forEach((ch, i) => {
    checkSpace(8);
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(50, 50, 50);
    pdf.text(`${i + 1}.  ${ch.title}`, marginL + 4, y);
    y += 7;
  });

  for (let ci = 0; ci < chapters.length; ci++) {
    const ch = chapters[ci];
    addPage();

    pdf.setFillColor(30, 100, 200);
    pdf.rect(marginL - 2, y - 4, 4, 14, "F");
    addText(`Chapter ${ci + 1}: ${ch.title}`, 18, [30, 100, 200], true);
    y += 4;

    for (const sec of ch.sections) {
      if (sec.heading) {
        checkSpace(14);
        y += 4;
        addText(sec.heading, 13, [60, 60, 80], true);
        y += 2;
      }
      if (sec.body) {
        const paras = sec.body.split(/\n{2,}/);
        for (const para of paras) {
          checkSpace(12);
          addText(para.replace(/^[-*•]\s+/, ""), 10, [40, 40, 40], false, sec.heading ? 4 : 0);
          y += 3;
        }
      }
    }
  }

  pdf.save(`${filename}.pdf`);
}
