import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, conversations, messages } from "@workspace/db";
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
import { streamGemini, GEMINI_MODELS, DEFAULT_GEMINI_MODEL } from "../../lib/gemini-stream.js";
import { streamGroq, GROQ_MODELS, DEFAULT_GROQ_MODEL } from "../../lib/groq-stream.js";
import { streamOpenRouter, OR_MODELS, DEFAULT_OR_MODEL } from "../../lib/openrouter-stream.js";
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

// ─── Smart model router ───────────────────────────────────────────────────────
// model key format:
//   "or:<key>"     → OpenRouter  (e.g. "or:gemini-flash")
//   "groq:<key>"   → Groq        (e.g. "groq:llama3.3-70b")
//   "gemini:<key>" → Gemini      (e.g. "gemini:2.0-flash")
//   undefined      → auto (convType decides default)

type MsgRole = { role: "user" | "assistant"; content: string };

function hasOpenRouter(): boolean { return !!process.env["OPENROUTER_API_KEY"]; }
function getOpenRouterKey(): string {
  const k = process.env["OPENROUTER_API_KEY"];
  if (!k) throw new Error("OPENROUTER_API_KEY not set");
  return k;
}

// ─── Smart maxTokens detection ────────────────────────────────────────────────
const LONG_FORM_KEYWORDS = [
  "textbook", "text book", "kitaab", "kitab", "500 page", "1000 page",
  "ppt", "presentation", "powerpoint", "slide", "slides",
  "write a book", "write book", "ek book", "ek kitaab",
  "chapter", "chapters", "volume", "encyclopedia",
];

function detectMaxTokens(content: string): number {
  const lower = content.toLowerCase();
  if (LONG_FORM_KEYWORDS.some(kw => lower.includes(kw))) return 8192;
  return 2048;
}

async function* routeToModel(
  modelKey: string,
  systemPrompt: string,
  chatMessages: MsgRole[],
  log: typeof console,
  maxTokens = 2048
): AsyncGenerator<string> {
  // ── OpenRouter models ──
  if (modelKey.startsWith("or:") || modelKey in OR_MODELS) {
    if (!hasOpenRouter()) throw new Error("OPENROUTER_API_KEY not configured");
    yield* streamOpenRouter(getOpenRouterKey(), systemPrompt, chatMessages, modelKey, maxTokens);
    return;
  }

  // ── Groq models ──
  if (modelKey.startsWith("groq:") || modelKey in GROQ_MODELS) {
    if (!hasKeys("GROQ_KEY")) throw new Error("GROQ_KEY not configured");
    yield* await withKeyRotation("GROQ_KEY", (key) =>
      Promise.resolve(streamGroq(key, systemPrompt, chatMessages, modelKey, maxTokens))
    );
    return;
  }

  // ── Gemini direct models ──
  if (modelKey.startsWith("gemini:") || modelKey in GEMINI_MODELS) {
    if (!hasKeys("GEMINI_KEY")) throw new Error("GEMINI_KEY not configured");
    yield* await withKeyRotation("GEMINI_KEY", (key) =>
      Promise.resolve(streamGemini(key, systemPrompt, chatMessages, modelKey, maxTokens))
    );
    return;
  }

  throw new Error(`Unknown model key: ${modelKey}`);
}

async function* hybridStream(
  convType: string,
  systemPrompt: string,
  chatMessages: MsgRole[],
  modelKey: string | undefined,
  log: typeof console,
  maxTokens = 2048
): AsyncGenerator<string> {
  // ── If user picked a specific model, use it directly — no fallback ─────────
  if (modelKey && modelKey !== "auto") {
    try {
      yield* routeToModel(modelKey, systemPrompt, chatMessages, log, maxTokens);
      return;
    } catch (err) {
      log.warn?.(`Model ${modelKey} failed, falling back to auto:`, err);
    }
  }

  const isManish = convType === "manish";

  // Provider order: Manish = Groq → OpenRouter → Gemini
  //                 Sarathi = OpenRouter → Groq → Gemini
  // Flat fallback chain
  const errors: string[] = [];

  // 1. Groq (Manish) / OpenRouter (Sarathi)
  if (isManish && hasKeys("GROQ_KEY")) {
    try {
      yield* await withKeyRotation("GROQ_KEY", (key) =>
        Promise.resolve(streamGroq(key, systemPrompt, chatMessages, DEFAULT_GROQ_MODEL, maxTokens))
      );
      return;
    } catch (err) {
      errors.push(`Groq: ${err}`);
      log.warn?.("Groq exhausted, trying next provider...");
    }
  }
  if (!isManish && hasOpenRouter()) {
    try {
      yield* streamOpenRouter(getOpenRouterKey(), systemPrompt, chatMessages, DEFAULT_OR_MODEL, maxTokens);
      return;
    } catch (err) {
      errors.push(`OpenRouter: ${err}`);
      log.warn?.("OpenRouter exhausted, trying next provider...");
    }
  }

  // 2. OpenRouter (Manish) / Groq (Sarathi)
  if (isManish && hasOpenRouter()) {
    try {
      yield* streamOpenRouter(getOpenRouterKey(), systemPrompt, chatMessages, "or:llama-70b", maxTokens);
      return;
    } catch (err) {
      errors.push(`OpenRouter: ${err}`);
      log.warn?.("OpenRouter exhausted, trying Gemini...");
    }
  }
  if (!isManish && hasKeys("GROQ_KEY")) {
    try {
      yield* await withKeyRotation("GROQ_KEY", (key) =>
        Promise.resolve(streamGroq(key, systemPrompt, chatMessages, DEFAULT_GROQ_MODEL, maxTokens))
      );
      return;
    } catch (err) {
      errors.push(`Groq: ${err}`);
      log.warn?.("Groq exhausted, trying Gemini...");
    }
  }

  // 3. Gemini — last resort for both modes
  if (hasKeys("GEMINI_KEY")) {
    try {
      yield* await withKeyRotation("GEMINI_KEY", (key) =>
        Promise.resolve(streamGemini(key, systemPrompt, chatMessages, DEFAULT_GEMINI_MODEL, maxTokens))
      );
      return;
    } catch (err) {
      errors.push(`Gemini: ${err}`);
      log.warn?.("Gemini exhausted too.");
    }
  }

  throw new Error(
    `Sabhi providers rate-limited hain. Thodi der baad retry karein.\nDetails: ${errors.join(" | ")}`
  );
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
      .select().from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(messages.createdAt);

    const systemPrompt =
      body.systemPrompt ||
      (conversation.type === "manish" ? MANISH_SYSTEM_PROMPT : SARATHI_SYSTEM_PROMPT);

    const allChatMessages: MsgRole[] = existingMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
    // Sirf last 10 messages bhejna — tokens bachao, rate limit se bachao
    const chatMessages = allChatMessages.slice(-10);

    // Auto-detect long-form requests (textbook/ppt) → 8192 tokens; else use provided or default
    const maxTokens = body.maxTokens ?? detectMaxTokens(body.content);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullResponse = "";

    try {
      for await (const text of hybridStream(conversation.type, systemPrompt, chatMessages, body.model, req.log as typeof console, maxTokens)) {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    } catch (streamErr) {
      req.log.error(streamErr, "Stream error");
      const errMsg = "\n\n⚠️ AI key limit aa gayi. Doosra model select karein ya thodi der baad retry karein.";
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

// ─── Image generation — sirf HuggingFace ─────────────────────────────────────

router.post("/generate-image", async (req, res) => {
  try {
    const body = GenerateOpenaiImageBody.parse(req.body);
    const hfToken = process.env["HF_TOKEN"];
    if (!hfToken) return res.status(400).json({ error: "HF_TOKEN set nahi hai." });
    const b64 = await generateImageHuggingFace(body.prompt, hfToken);
    return res.json({ b64_json: b64, source: "huggingface" });
  } catch (err) {
    req.log.error(err, "Failed to generate image");
    res.status(500).json({ error: "Image generation failed." });
  }
});

// ─── Models list endpoint ─────────────────────────────────────────────────────

router.get("/models", (_req, res) => {
  const orModels = hasOpenRouter()
    ? Object.entries(OR_MODELS).map(([key, m]) => ({ key, ...m, provider_type: "openrouter" }))
    : [];
  const groqModels = hasKeys("GROQ_KEY")
    ? Object.entries(GROQ_MODELS).map(([key, m]) => ({ key, ...m, provider_type: "groq" }))
    : [];
  const geminiModels = hasKeys("GEMINI_KEY")
    ? Object.entries(GEMINI_MODELS).map(([key, m]) => ({ key, ...m, provider_type: "gemini" }))
    : [];
  res.json({ models: [...orModels, ...groqModels, ...geminiModels] });
});

// ─── Key status endpoint ──────────────────────────────────────────────────────

router.get("/keys/status", (_req, res) => {
  const geminiKeys: string[] = [];
  const groqKeys: string[] = [];
  for (let i = 1; i <= 3; i++) {
    if (process.env[`GEMINI_KEY_${i}`]) geminiKeys.push(`GEMINI_KEY_${i}`);
    if (process.env[`GROQ_KEY_${i}`]) groqKeys.push(`GROQ_KEY_${i}`);
  }
  res.json({
    openrouter: { configured: hasOpenRouter(), models: Object.keys(OR_MODELS).length },
    gemini: { count: geminiKeys.length, slots: geminiKeys, models: Object.keys(GEMINI_MODELS).length },
    groq: { count: groqKeys.length, slots: groqKeys, models: Object.keys(GROQ_MODELS).length },
    huggingface: { configured: !!process.env["HF_TOKEN"] },
    total_models: Object.keys(OR_MODELS).length + Object.keys(GROQ_MODELS).length + Object.keys(GEMINI_MODELS).length,
    mode: "user-keys-only",
  });
});

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
