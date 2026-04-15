import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import * as todoController from "../controllers/todo.controller.js";

const router = Router();

// All todo routes require a valid Firebase ID token
router.use(authenticate);

router.get("/", todoController.getAll);
router.post("/", todoController.create);
router.patch("/:id", todoController.update);
router.delete("/completed", todoController.clearCompleted);
router.delete("/:id", todoController.remove);

export default router;
