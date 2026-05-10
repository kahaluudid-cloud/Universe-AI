/**
 * Failover Key Pool Manager — 24/7 Auto-Rotation
 *
 * - Up to 5 keys per provider (GEMINI_KEY_1 … GEMINI_KEY_5)
 * - 429 rate-limited key → 60s cooldown, then auto-retry
 * - All keys exhausted → wait for earliest recovery, then retry
 * - Keys re-read from env every 6 hours (hot-reload support)
 */

const RATE_LIMIT_COOLDOWN_MS = 60_000;        // 60s cooldown after 429
const DAILY_LIMIT_COOLDOWN_MS = 60 * 60 * 1000; // 1h cooldown after daily quota (403/429-daily)
const KEY_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000; // re-read env every 6h
const MAX_WAIT_MS = 90_000;                   // max 90s wait if all keys exhausted

function readKeys(prefix: string): string[] {
  const keys: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const k = process.env[`${prefix}_${i}`];
    if (k && k.trim()) keys.push(k.trim());
  }
  return keys;
}

interface KeyPool {
  keys: string[];
  currentIndex: number;
  lastRefreshedAt: number;
  rateLimitedUntil: Map<string, number>;
}

const pools: Record<string, KeyPool> = {};

function getPool(prefix: string): KeyPool {
  if (!pools[prefix]) {
    pools[prefix] = {
      keys: readKeys(prefix),
      currentIndex: 0,
      lastRefreshedAt: Date.now(),
      rateLimitedUntil: new Map(),
    };
  }
  const pool = pools[prefix];
  if (Date.now() - pool.lastRefreshedAt > KEY_REFRESH_INTERVAL_MS) {
    pool.keys = readKeys(prefix);
    pool.lastRefreshedAt = Date.now();
  }
  return pool;
}

export function getAvailableKeys(prefix: string): string[] {
  return getPool(prefix).keys;
}

export function hasKeys(prefix: string): boolean {
  return getPool(prefix).keys.length > 0;
}

/** Returns how long (ms) until the earliest blocked key recovers. 0 = at least one key is free now. */
function msUntilAnyKeyFree(pool: KeyPool): number {
  const now = Date.now();
  let minWait = Infinity;
  for (const key of pool.keys) {
    const until = pool.rateLimitedUntil.get(key) ?? 0;
    const wait = until - now;
    if (wait <= 0) return 0;
    if (wait < minWait) minWait = wait;
  }
  return minWait === Infinity ? 0 : minWait;
}

/**
 * Tries every key in the pool. On 429/503, marks the key with a cooldown
 * and moves to the next one. If ALL keys are rate-limited, waits until
 * the earliest one recovers (up to MAX_WAIT_MS), then retries once more.
 */
export async function withKeyRotation<T>(
  prefix: string,
  fn: (key: string) => Promise<T>
): Promise<T> {
  const pool = getPool(prefix);
  if (pool.keys.length === 0) {
    throw new Error(`No ${prefix} keys configured`);
  }

  const tryOnce = async (): Promise<T | null> => {
    const now = Date.now();
    for (let attempt = 0; attempt < pool.keys.length; attempt++) {
      const idx = (pool.currentIndex + attempt) % pool.keys.length;
      const key = pool.keys[idx];

      const blockedUntil = pool.rateLimitedUntil.get(key) ?? 0;
      if (now < blockedUntil) continue;

      try {
        const result = await fn(key);
        pool.currentIndex = idx;
        return result;
      } catch (err: unknown) {
        const status =
          (err as { status?: number })?.status ??
          (err as { response?: { status: number } })?.response?.status;

        if (status === 429 || status === 503) {
          // Check if it's a daily/quota limit (longer cooldown) or per-minute (short cooldown)
          const errMsg = String((err as { message?: string })?.message ?? "");
          const isDaily = errMsg.includes("tokens per day") || errMsg.includes("per day") || errMsg.includes("quota") || errMsg.includes("exceeded");
          const cooldown = isDaily ? DAILY_LIMIT_COOLDOWN_MS : RATE_LIMIT_COOLDOWN_MS;
          pool.rateLimitedUntil.set(key, Date.now() + cooldown);
          pool.currentIndex = (idx + 1) % pool.keys.length;
          continue;
        }
        if (status === 500 || status === 404) {
          // 404 = model removed/unavailable; 500 = server error — skip this key
          pool.currentIndex = (idx + 1) % pool.keys.length;
          continue;
        }
        throw err;
      }
    }
    return null;
  };

  const result = await tryOnce();
  if (result !== null) return result;

  const waitMs = Math.min(msUntilAnyKeyFree(pool), MAX_WAIT_MS);
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs + 500));
    const retried = await tryOnce();
    if (retried !== null) return retried;
  }

  throw new Error(`All ${prefix} keys are rate-limited. Provider will be skipped.`);
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
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
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
      if (res.status === 429) {
        return { ok: true, latency: Date.now() - start, error: "rate_limited" };
      }
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
          model: "llama-3.1-8b-instant",
          messages: [{ role: "user", content: "Hi" }],
          max_tokens: 5,
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (res.status === 429) {
        return { ok: true, latency: Date.now() - start, error: "rate_limited" };
      }
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
