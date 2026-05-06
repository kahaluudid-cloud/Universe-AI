import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { checkKey } from "../lib/failover.js";

const router: IRouter = Router();

// Mounted at /api/health — so /healthz becomes /api/health/healthz
// Also keep a root alias for backwards compatibility via main index
router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Full key health check — tests all configured keys
router.get("/keys/health", async (_req, res) => {
  const results: Record<string, { configured: boolean; ok?: boolean; latency?: number; error?: string }> = {};

  const checks: Promise<void>[] = [];

  for (let i = 1; i <= 3; i++) {
    const k = `GEMINI_KEY_${i}`;
    const val = process.env[k];
    if (val) {
      checks.push(
        checkKey("GEMINI_KEY", val).then((r) => { results[k] = { configured: true, ...r }; })
      );
    } else {
      results[k] = { configured: false };
    }
  }

  for (let i = 1; i <= 3; i++) {
    const k = `GROQ_KEY_${i}`;
    const val = process.env[k];
    if (val) {
      checks.push(
        checkKey("GROQ_KEY", val).then((r) => { results[k] = { configured: true, ...r }; })
      );
    } else {
      results[k] = { configured: false };
    }
  }

  const hfToken = process.env["HF_TOKEN"];
  if (hfToken) {
    checks.push(
      checkKey("HF_TOKEN", hfToken).then((r) => { results["HF_TOKEN"] = { configured: true, ...r }; })
    );
  } else {
    results["HF_TOKEN"] = { configured: false };
  }

  await Promise.allSettled(checks);

  const allConfigured = Object.values(results).filter((r) => r.configured);
  const allOk = allConfigured.filter((r) => r.ok);

  res.json({
    keys: results,
    summary: {
      total: allConfigured.length,
      healthy: allOk.length,
      mode: allConfigured.length > 0 ? "hybrid" : "primary-only",
    },
  });
});

export default router;
