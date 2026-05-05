/**
 * Failover Key Pool Manager
 * 3 Gemini keys + 3 Groq keys — auto-rotates on 429/500 errors
 * Resets to key[0] every 24 hours automatically
 */

function getKeys(prefix: string): string[] {
  const keys: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const k = process.env[`${prefix}_${i}`];
    if (k && k.trim()) keys.push(k.trim());
  }
  return keys;
}

interface KeyPool {
  keys: string[];
  currentIndex: number;
  lastResetAt: number;
}

const pools: Record<string, KeyPool> = {};

function getPool(prefix: string): KeyPool {
  if (!pools[prefix]) {
    pools[prefix] = {
      keys: getKeys(prefix),
      currentIndex: 0,
      lastResetAt: Date.now(),
    };
  }
  const pool = pools[prefix];
  // Auto-reset every 24 hours
  if (Date.now() - pool.lastResetAt > 24 * 60 * 60 * 1000) {
    pool.currentIndex = 0;
    pool.lastResetAt = Date.now();
    pool.keys = getKeys(prefix); // re-read from env in case updated
  }
  return pool;
}

export function getAvailableKeys(prefix: string): string[] {
  return getPool(prefix).keys;
}

export function hasKeys(prefix: string): boolean {
  return getPool(prefix).keys.length > 0;
}

/**
 * Tries each key in the pool in order.
 * Rotates on 429 / network errors. Returns null if all keys fail.
 */
export async function withKeyRotation<T>(
  prefix: string,
  fn: (key: string) => Promise<T>
): Promise<T> {
  const pool = getPool(prefix);
  if (pool.keys.length === 0) {
    throw new Error(`No ${prefix} keys configured`);
  }

  let lastErr: unknown;
  for (let attempt = 0; attempt < pool.keys.length; attempt++) {
    const idx = (pool.currentIndex + attempt) % pool.keys.length;
    const key = pool.keys[idx];
    try {
      const result = await fn(key);
      pool.currentIndex = idx; // Stick with working key
      return result;
    } catch (err: unknown) {
      lastErr = err;
      const status = (err as { status?: number; response?: { status: number } })?.status
        ?? (err as { response?: { status: number } })?.response?.status;
      if (status === 429 || status === 500 || status === 503) {
        // Rotate to next key
        pool.currentIndex = (idx + 1) % pool.keys.length;
        continue;
      }
      throw err; // Non-rate-limit error — don't rotate
    }
  }
  throw lastErr;
}

/** Health check: test each key with a minimal ping */
export async function checkKey(
  prefix: string,
  key: string
): Promise<{ ok: boolean; latency: number; error?: string }> {
  const start = Date.now();
  try {
    if (prefix === "GEMINI_KEY") {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "Hi" }] }],
            generationConfig: { maxOutputTokens: 5 },
          }),
          signal: AbortSignal.timeout(8000),
        }
      );
      if (!res.ok) {
        const txt = await res.text();
        return { ok: false, latency: Date.now() - start, error: `HTTP ${res.status}: ${txt.slice(0, 100)}` };
      }
      return { ok: true, latency: Date.now() - start };
    }

    if (prefix === "GROQ_KEY") {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: "llama3-8b-8192",
          messages: [{ role: "user", content: "Hi" }],
          max_tokens: 5,
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        const txt = await res.text();
        return { ok: false, latency: Date.now() - start, error: `HTTP ${res.status}: ${txt.slice(0, 100)}` };
      }
      return { ok: true, latency: Date.now() - start };
    }

    if (prefix === "HF_TOKEN") {
      const res = await fetch(
        "https://huggingface.co/api/whoami-v2",
        {
          headers: { Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(8000),
        }
      );
      if (!res.ok) {
        return { ok: false, latency: Date.now() - start, error: `HTTP ${res.status}` };
      }
      return { ok: true, latency: Date.now() - start };
    }

    return { ok: false, latency: 0, error: "Unknown prefix" };
  } catch (err) {
    return { ok: false, latency: Date.now() - start, error: String(err) };
  }
}
