import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import * as userController from "../controllers/user.controller.js";

const router = Router();

router.use(authenticate);

router.post("/me", userController.upsertMe);
router.get("/me", userController.getMe);

export default router;
