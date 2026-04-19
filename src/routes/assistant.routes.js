import { Router } from "express";

import * as assistantController from "../controllers/assistant.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.post("/chat", assistantController.chat);
router.delete("/sessions/:sessionId", assistantController.destroySession);

export default router;