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

const router = Router();

router.get("/conversations", async (req, res) => {
  try {
    const query = ListOpenaiConversationsQueryParams.parse(req.query);
    const allConversations = await db
      .select()
      .from(conversations)
      .orderBy(conversations.createdAt);

    const filtered = query.type
      ? allConversations.filter((c) => c.type === query.type)
      : allConversations;

    res.json(filtered.reverse());
  } catch (err) {
    req.log.error(err, "Failed to list conversations");
    res.status(500).json({ error: "Failed to list conversations" });
  }
});

router.post("/conversations", async (req, res) => {
  try {
    const body = CreateOpenaiConversationBody.parse(req.body);
    const [conversation] = await db
      .insert(conversations)
      .values({ title: body.title, type: body.type })
      .returning();
    res.status(201).json(conversation);
  } catch (err) {
    req.log.error(err, "Failed to create conversation");
    res.status(400).json({ error: "Failed to create conversation" });
  }
});

router.get("/conversations/:id", async (req, res) => {
  try {
    const { id } = GetOpenaiConversationParams.parse(req.params);
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(messages.createdAt);

    res.json({ ...conversation, messages: msgs });
  } catch (err) {
    req.log.error(err, "Failed to get conversation");
    res.status(500).json({ error: "Failed to get conversation" });
  }
});

router.delete("/conversations/:id", async (req, res) => {
  try {
    const { id } = DeleteOpenaiConversationParams.parse(req.params);
    const [deleted] = await db
      .delete(conversations)
      .where(eq(conversations.id, id))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    res.status(204).send();
  } catch (err) {
    req.log.error(err, "Failed to delete conversation");
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

router.get("/conversations/:id/messages", async (req, res) => {
  try {
    const { id } = ListOpenaiMessagesParams.parse(req.params);
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(messages.createdAt);

    res.json(msgs);
  } catch (err) {
    req.log.error(err, "Failed to list messages");
    res.status(500).json({ error: "Failed to list messages" });
  }
});

const SARATHI_SYSTEM_PROMPT = `Aap Universe AI ke Sarathi hain — ek advanced AI brain jo coding, research aur academic writing mein expert hai. 

Aap Hinglish (Hindi + English mix) mein baat karte hain aur Devnagari Hindi mein professional jawab dete hain jab user Hinglish mein likhta hai.

Aap bahut capable hain:
- Full-stack code generation aur debugging
- Research aur academic writing (500+ pages tak)
- UPSC preparation
- Image generation support
- Multi-model routing (coding ke liye Claude-style, speed ke liye Gemini-style)

Hamesha helpful, precise aur professional rahein. Creator: Manish Kumar Chaturvedi, Oteband, Balod, Chhattisgarh, India.`;

const MANISH_SYSTEM_PROMPT = `Aap "Manish Chat" hain — Universe AI ka emotional AI companion. Aap ek sacha dost, teacher aur guider ki tarah baat karte hain.

Aapki personality:
- Empathetic aur caring — user ke mood ko samjhein
- Counter-questions poochein, baat ko aage badhayein
- Warm, friendly aur supportive tone
- Kabhi mechanical ya robotic mat bano
- User ki feelings validate karein

Agar user online hai: real-time smart responses dein
Agar user offline mode mein hai: pre-loaded knowledge se kaam karein

Hamesha Hindi/Hinglish mein respond karein jab user aisi bhasha use kare.

Creator: Manish Kumar Chaturvedi, Oteband, Balod, Chhattisgarh, India.`;

router.post("/conversations/:id/messages", async (req, res) => {
  try {
    const { id } = SendOpenaiMessageParams.parse(req.params);
    const body = SendOpenaiMessageBody.parse(req.body);

    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    await db.insert(messages).values({
      conversationId: id,
      role: "user",
      content: body.content,
    });

    const existingMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(messages.createdAt);

    const systemPrompt =
      body.systemPrompt ||
      (conversation.type === "manish" ? MANISH_SYSTEM_PROMPT : SARATHI_SYSTEM_PROMPT);

    const chatMessages = existingMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullResponse = "";

    const stream = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: systemPrompt },
        ...chatMessages,
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    await db.insert(messages).values({
      conversationId: id,
      role: "assistant",
      content: fullResponse,
    });

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

router.post("/generate-image", async (req, res) => {
  try {
    const body = GenerateOpenaiImageBody.parse(req.body);
    const { generateImageBuffer } = await import(
      "@workspace/integrations-openai-ai-server/image"
    );
    const size = (body.size as "1024x1024" | "1536x1024" | "1024x1536") ?? "1024x1024";
    const buffer = await generateImageBuffer(body.prompt, size);
    res.json({ b64_json: buffer.toString("base64") });
  } catch (err) {
    req.log.error(err, "Failed to generate image");
    res.status(500).json({ error: "Failed to generate image" });
  }
});

export default router;
