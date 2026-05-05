import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, conversations, messages } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  CreateOpenaiConversationBody,
  GetOpenaiConversationParams,
  DeleteOpenaiConversationParams,
  ListOpenaiMessagesParams,
  SendOpenaiMessageBody,
  SendOpenaiMessageParams,
  ListOpenaiConversationsQueryParams,
  GenerateOpenaiImageBody,
} from "@workspace/api-zod";
import { withKeyRotation, hasKeys } from "../../lib/failover.js";
import { streamGemini } from "../../lib/gemini-stream.js";
import { streamGroq } from "../../lib/groq-stream.js";
import { generateImageHuggingFace } from "../../lib/huggingface.js";

const router = Router();

// ─── CRUD ────────────────────────────────────────────────────────────────────

router.get("/conversations", async (req, res) => {
  try {
    const query = ListOpenaiConversationsQueryParams.parse(req.query);
    const allConversations = await db.select().from(conversations).orderBy(conversations.createdAt);
    const filtered = query.type ? allConversations.filter((c) => c.type === query.type) : allConversations;
    res.json(filtered.reverse());
  } catch (err) {
    req.log.error(err, "Failed to list conversations");
    res.status(500).json({ error: "Failed to list conversations" });
  }
});

router.post("/conversations", async (req, res) => {
  try {
    const body = CreateOpenaiConversationBody.parse(req.body);
    const [conversation] = await db.insert(conversations).values({ title: body.title, type: body.type }).returning();
    res.status(201).json(conversation);
  } catch (err) {
    req.log.error(err, "Failed to create conversation");
    res.status(400).json({ error: "Failed to create conversation" });
  }
});

router.get("/conversations/:id", async (req, res) => {
  try {
    const { id } = GetOpenaiConversationParams.parse(req.params);
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });
    const msgs = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(messages.createdAt);
    res.json({ ...conversation, messages: msgs });
  } catch (err) {
    req.log.error(err, "Failed to get conversation");
    res.status(500).json({ error: "Failed to get conversation" });
  }
});

router.delete("/conversations/:id", async (req, res) => {
  try {
    const { id } = DeleteOpenaiConversationParams.parse(req.params);
    const [deleted] = await db.delete(conversations).where(eq(conversations.id, id)).returning();
    if (!deleted) return res.status(404).json({ error: "Conversation not found" });
    res.status(204).send();
  } catch (err) {
    req.log.error(err, "Failed to delete conversation");
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

router.get("/conversations/:id/messages", async (req, res) => {
  try {
    const { id } = ListOpenaiMessagesParams.parse(req.params);
    const msgs = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(messages.createdAt);
    res.json(msgs);
  } catch (err) {
    req.log.error(err, "Failed to list messages");
    res.status(500).json({ error: "Failed to list messages" });
  }
});

// ─── System prompts ───────────────────────────────────────────────────────────

const SARATHI_SYSTEM_PROMPT = `Aap Universe AI ke Sarathi hain — ek advanced AI brain jo coding, research aur academic writing mein expert hai.
Aap Hinglish (Hindi + English mix) mein baat karte hain aur Devnagari Hindi mein professional jawab dete hain.
Capabilities:
- Full-stack code generation aur debugging (proper markdown code blocks with language tag)
- Textbook writing (500+ pages, use "## Chapter N: Title" format)
- PPT creation (use "## Slide N: Title" format, 3-5 bullet points per slide)
- Image generation (user "generate image" ya "/imagine" likhe toh)
- UPSC preparation aur research
Creator: Manish Kumar Chaturvedi, Oteband, Balod, Chhattisgarh, India.`;

const MANISH_SYSTEM_PROMPT = `Aap "Manish Chat" hain — Universe AI ka emotional AI companion. Ek sacha dost, teacher aur guider ki tarah.
Personality: empathetic, caring, counter-questions poochein, warm aur supportive. Kabhi mechanical ya robotic mat bano.
Hamesha Hindi/Hinglish mein respond karein. Creator: Manish Kumar Chaturvedi, Oteband, Balod, Chhattisgarh, India.`;

// ─── Hybrid streaming engine ──────────────────────────────────────────────────
// Priority matrix:
//  Manish Chat  → Groq Llama 3 (fast human-like) → Gemini 1.5 Flash → Replit OpenAI
//  Sarathi/WebCraft → Replit OpenAI → Gemini 1.5 Flash backup

type MsgRole = { role: "user" | "assistant"; content: string };

async function* hybridStream(
  convType: string,
  systemPrompt: string,
  chatMessages: MsgRole[],
  log: typeof console
): AsyncGenerator<string> {
  const isManish = convType === "manish";

  // ── Phase 1: Groq for Manish Chat (fast human-like) ──────────────────────
  if (isManish && hasKeys("GROQ_KEY")) {
    try {
      yield* await (async () => {
        return withKeyRotation("GROQ_KEY", (key) =>
          Promise.resolve(streamGroq(key, systemPrompt, chatMessages))
        );
      })();
      return;
    } catch (err) {
      log.warn?.("Groq failed, falling back:", err);
    }
  }

  // ── Phase 2: Replit built-in OpenAI (primary for Sarathi / WebCraft) ─────
  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      messages: [{ role: "system", content: systemPrompt }, ...chatMessages],
      stream: true,
    });
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) yield text;
    }
    return;
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    if (status !== 429 && status !== 500 && status !== 503) throw err;
    log.warn?.("Primary OpenAI failed, switching to Gemini backup:", err);
  }

  // ── Phase 3: Gemini 1.5 Flash (backup key pool) ──────────────────────────
  if (hasKeys("GEMINI_KEY")) {
    const gen = await withKeyRotation("GEMINI_KEY", (key) =>
      Promise.resolve(streamGemini(key, systemPrompt, chatMessages))
    );
    yield* gen;
    return;
  }

  throw new Error("All AI models exhausted. Please configure backup API keys in Settings.");
}

// ─── Message endpoint ─────────────────────────────────────────────────────────

router.post("/conversations/:id/messages", async (req, res) => {
  try {
    const { id } = SendOpenaiMessageParams.parse(req.params);
    const body = SendOpenaiMessageBody.parse(req.body);

    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });

    await db.insert(messages).values({ conversationId: id, role: "user", content: body.content });

    const existingMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(messages.createdAt);

    const systemPrompt =
      body.systemPrompt ||
      (conversation.type === "manish" ? MANISH_SYSTEM_PROMPT : SARATHI_SYSTEM_PROMPT);

    const chatMessages: MsgRole[] = existingMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullResponse = "";

    try {
      for await (const text of hybridStream(conversation.type, systemPrompt, chatMessages, req.log as typeof console)) {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    } catch (streamErr) {
      req.log.error(streamErr, "Stream error in hybrid engine");
      const errMsg = "\n\n⚠️ AI model limit reached. Switching automatically — please resend.";
      res.write(`data: ${JSON.stringify({ content: errMsg })}\n\n`);
    }

    await db.insert(messages).values({ conversationId: id, role: "assistant", content: fullResponse });
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error(err, "Failed to send message");
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to send message" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "Stream error" })}\n\n`);
      res.end();
    }
  }
});

// ─── Image generation ─────────────────────────────────────────────────────────

router.post("/generate-image", async (req, res) => {
  try {
    const body = GenerateOpenaiImageBody.parse(req.body);

    // Phase 1: HuggingFace FLUX.1-schnell (free, if token configured)
    const hfToken = process.env["HF_TOKEN"];
    if (hfToken) {
      try {
        const b64 = await generateImageHuggingFace(body.prompt, hfToken);
        return res.json({ b64_json: b64, source: "huggingface" });
      } catch (hfErr) {
        req.log.warn(hfErr, "HuggingFace image gen failed, falling back to OpenAI");
      }
    }

    // Phase 2: Replit OpenAI image generation (fallback)
    const { generateImageBuffer } = await import("@workspace/integrations-openai-ai-server/image");
    const size = (body.size as "1024x1024" | "1536x1024" | "1024x1536") ?? "1024x1024";
    const buffer = await generateImageBuffer(body.prompt, size);
    res.json({ b64_json: buffer.toString("base64"), source: "openai" });
  } catch (err) {
    req.log.error(err, "Failed to generate image");
    res.status(500).json({ error: "Failed to generate image" });
  }
});

// ─── Key status endpoint ──────────────────────────────────────────────────────

router.get("/keys/status", (req, res) => {
  const geminiKeys: string[] = [];
  const groqKeys: string[] = [];
  for (let i = 1; i <= 3; i++) {
    if (process.env[`GEMINI_KEY_${i}`]) geminiKeys.push(`GEMINI_KEY_${i}`);
    if (process.env[`GROQ_KEY_${i}`]) groqKeys.push(`GROQ_KEY_${i}`);
  }
  const hfToken = !!process.env["HF_TOKEN"];
  res.json({
    gemini: { count: geminiKeys.length, slots: geminiKeys },
    groq: { count: groqKeys.length, slots: groqKeys },
    huggingface: { configured: hfToken },
    primary: "replit-openai",
    mode: geminiKeys.length > 0 || groqKeys.length > 0 ? "hybrid" : "primary-only",
  });
});

// ─── Health check: test individual keys ──────────────────────────────────────

router.post("/keys/test", async (req, res) => {
  try {
    const { prefix, key } = req.body as { prefix: string; key: string };
    if (!prefix || !key) return res.status(400).json({ error: "prefix and key required" });
    const { checkKey } = await import("../../lib/failover.js");
    const result = await checkKey(prefix, key);
    res.json(result);
  } catch (err) {
    req.log.error(err, "Key test failed");
    res.status(500).json({ ok: false, error: "Test failed" });
  }
});

export default router;
