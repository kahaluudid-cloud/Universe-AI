import { Router, type IRouter } from "express";
import healthRouter from "./health";
import openaiRouter from "./openai/conversations";

const router: IRouter = Router();

// Direct /api/healthz for deployment health checks (artifact.toml probe path)
router.get("/healthz", (_req, res) => res.json({ status: "ok" }));

router.use("/health", healthRouter);
router.use("/openai", openaiRouter);

export default router;
