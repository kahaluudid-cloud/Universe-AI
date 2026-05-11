import { parse } from "dotenv";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// .env se keys load karo — sirf non-empty values override hongi (Replit Secrets fallback rehta hai)
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const envPath = resolve(__dirname, "../.env");
  const envContent = readFileSync(envPath, "utf8");
  const parsed = parse(envContent);
  let loaded = 0;
  for (const [key, value] of Object.entries(parsed)) {
    if (value && value.trim() !== "") {
      process.env[key] = value;
      loaded++;
    }
  }
  if (loaded > 0) console.log(`◇ .env se ${loaded} keys load hui`);
} catch {
  // .env nahi mili — Replit Secrets use hongi
}

import app from "./app";
import { logger } from "./lib/logger";

// ── 24/7 Crash Protection ─────────────────────────────────────────────────────
// Unhandled promise rejections ko gracefully handle karo — server crash nahi hoga
process.on("unhandledRejection", (reason, promise) => {
  logger.error({ reason, promise }, "Unhandled promise rejection — server continues");
});

// Uncaught exceptions ko log karo — critical errors pe bhi server chalta rahe
process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception — server continues");
});

// SIGTERM pe graceful shutdown (Replit restart ke liye)
process.on("SIGTERM", () => {
  logger.info("SIGTERM received — graceful shutdown");
  process.exit(0);
});
// ─────────────────────────────────────────────────────────────────────────────

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
