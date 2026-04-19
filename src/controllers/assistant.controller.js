import * as assistantService from "../services/assistant.service.js";

function responseBodyForError(error) {
  const payload = { message: error.message || "Failed to process AI request." };

  if (process.env.NODE_ENV !== "production" && error.cause?.message) {
    payload.error = error.cause.message;
  }

  return payload;
}

export async function chat(req, res) {
  const { message, sessionId } = req.body;

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({
      message: "message is required and must be a non-empty string.",
    });
  }

  if (sessionId !== undefined && sessionId !== null && typeof sessionId !== "string") {
    return res.status(400).json({ message: "sessionId must be a string when provided." });
  }

  try {
    const result = await assistantService.sendChatMessage({
      userId: req.user.uid,
      userLabel: req.user.name ?? req.user.email ?? "Taskr user",
      message: message.trim(),
      sessionId: sessionId?.trim() || undefined,
    });

    res.json({
      sessionId: result.sessionId,
      model: result.model,
      message: {
        role: "assistant",
        content: result.content,
      },
    });
  } catch (error) {
    const statusCode = error.statusCode ?? 500;
    res.status(statusCode).json(responseBodyForError(error));
  }
}

export async function destroySession(req, res) {
  const { sessionId } = req.params;

  if (!sessionId?.trim()) {
    return res.status(400).json({ message: "sessionId is required." });
  }

  try {
    await assistantService.destroyChatSession({
      userId: req.user.uid,
      sessionId: sessionId.trim(),
    });
    res.status(204).send();
  } catch (error) {
    const statusCode = error.statusCode ?? 500;
    res.status(statusCode).json(responseBodyForError(error));
  }
}