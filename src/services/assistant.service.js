import { randomUUID } from "node:crypto";

import { CopilotClient, approveAll } from "@github/copilot-sdk";

import * as todoService from "./todo.service.js";

const CHAT_MODEL = process.env.COPILOT_MODEL || "gpt-4o";
const CHAT_SESSION_PREFIX = "taskr-chat";
const MAX_CONTEXT_TODOS = 25;
const RESPONSE_TIMEOUT_MS = Number(process.env.COPILOT_TIMEOUT_MS || 45000);

let clientPromise;

class AssistantServiceError extends Error {
  constructor(message, statusCode = 500, cause) {
    super(message);
    this.name = "AssistantServiceError";
    this.statusCode = statusCode;
    this.cause = cause;
  }
}

function sessionPrefixForUser(userId) {
  return `${CHAT_SESSION_PREFIX}-${userId}-`;
}

function createSessionId(userId) {
  return `${sessionPrefixForUser(userId)}${randomUUID()}`;
}

function assertSessionOwnership(sessionId, userId) {
  if (!sessionId.startsWith(sessionPrefixForUser(userId))) {
    throw new AssistantServiceError("That chat session does not belong to the current user.", 403);
  }
}

function buildProviderConfig() {
  const baseUrl = process.env.COPILOT_PROVIDER_BASE_URL;

  if (!baseUrl) {
    return undefined;
  }

  const provider = {
    type: process.env.COPILOT_PROVIDER_TYPE || "openai",
    baseUrl,
  };

  if (process.env.COPILOT_PROVIDER_API_KEY) {
    provider.apiKey = process.env.COPILOT_PROVIDER_API_KEY;
  }

  if (process.env.COPILOT_PROVIDER_BEARER_TOKEN) {
    provider.bearerToken = process.env.COPILOT_PROVIDER_BEARER_TOKEN;
  }

  if (process.env.COPILOT_PROVIDER_WIRE_API) {
    provider.wireApi = process.env.COPILOT_PROVIDER_WIRE_API;
  }

  if (provider.type === "azure") {
    provider.azure = {
      apiVersion: process.env.COPILOT_AZURE_API_VERSION || "2024-10-21",
    };
  }

  return provider;
}

function createClientOptions() {
  const githubToken =
    process.env.COPILOT_GITHUB_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_TOKEN;

  return {
    ...(process.env.COPILOT_CLI_PATH && { cliPath: process.env.COPILOT_CLI_PATH }),
    ...(githubToken && { githubToken }),
  };
}

async function getClient() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const client = new CopilotClient(createClientOptions());
      await client.start();
      return client;
    })().catch((error) => {
      clientPromise = undefined;
      throw error;
    });
  }

  return clientPromise;
}

function getBaseSessionConfig() {
  const provider = buildProviderConfig();

  return {
    model: CHAT_MODEL,
    onPermissionRequest: approveAll,
    availableTools: [],
    ...(provider && { provider }),
  };
}

function getCreateSessionConfig(sessionId) {
  return {
    ...getBaseSessionConfig(),
    sessionId,
    clientName: "taskr-ai-chat",
    infiniteSessions: {
      enabled: true,
      backgroundCompactionThreshold: 0.8,
      bufferExhaustionThreshold: 0.95,
    },
    systemMessage: {
      content: [
        "You are the embedded assistant for a todo application.",
        "Keep answers concise, practical, and grounded in the task context provided with each turn.",
        "Help the user prioritize work, break tasks into steps, rewrite tasks clearly, and plan realistic next actions.",
        "Do not claim you changed any tasks unless the user explicitly confirms that action happened in the app.",
      ].join("\n"),
    },
  };
}

function getResumeSessionConfig() {
  return {
    ...getBaseSessionConfig(),
    clientName: "taskr-ai-chat",
  };
}

function formatTodoContext(todos) {
  const activeCount = todos.filter((todo) => !todo.completed).length;
  const completedCount = todos.length - activeCount;
  const visibleTodos = todos.slice(0, MAX_CONTEXT_TODOS);
  const hiddenCount = todos.length - visibleTodos.length;

  const lines = visibleTodos.map((todo, index) => {
    const status = todo.completed ? "done" : "open";
    return `${index + 1}. [${status}] ${todo.text}`;
  });

  return [
    "<task_snapshot>",
    `total_tasks: ${todos.length}`,
    `open_tasks: ${activeCount}`,
    `completed_tasks: ${completedCount}`,
    visibleTodos.length > 0 ? lines.join("\n") : "No tasks exist right now.",
    hiddenCount > 0 ? `${hiddenCount} more task(s) omitted for brevity.` : "",
    "</task_snapshot>",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildPrompt({ message, todos, userLabel }) {
  return [
    "Use the current task snapshot when it is relevant.",
    formatTodoContext(todos),
    `<user>${userLabel}</user>`,
    `<user_request>${message}</user_request>`,
  ].join("\n\n");
}

function normalizeError(error) {
  if (error instanceof AssistantServiceError) {
    return error;
  }

  const message = error?.message || "Unknown Copilot SDK error.";

  if (/enoent|spawn .*copilot|not found|could not find/i.test(message)) {
    return new AssistantServiceError(
      "GitHub Copilot SDK is not ready on the server. Install the Copilot CLI or set COPILOT_CLI_PATH.",
      503,
      error
    );
  }

  if (/unauthorized|forbidden|api key|auth|token|401|403/i.test(message)) {
    return new AssistantServiceError(
      "The AI backend is missing valid Copilot or provider credentials.",
      503,
      error
    );
  }

  if (/model/i.test(message)) {
    return new AssistantServiceError(
      `The configured model \"${CHAT_MODEL}\" is not available to the Copilot SDK runtime.`,
      503,
      error
    );
  }

  return new AssistantServiceError("Failed to generate an AI response.", 502, error);
}

async function getOrCreateSession({ client, sessionId, userId }) {
  if (sessionId) {
    assertSessionOwnership(sessionId, userId);

    try {
      const session = await client.resumeSession(sessionId, getResumeSessionConfig());
      return { session, sessionId };
    } catch {
      const nextSessionId = createSessionId(userId);
      const session = await client.createSession(getCreateSessionConfig(nextSessionId));
      return { session, sessionId: nextSessionId };
    }
  }

  const nextSessionId = createSessionId(userId);
  const session = await client.createSession(getCreateSessionConfig(nextSessionId));
  return { session, sessionId: nextSessionId };
}

export async function sendChatMessage({ userId, userLabel, message, sessionId }) {
  const client = await getClient();
  const todos = await todoService.getTodos(userId);

  let session;

  try {
    const activeSession = await getOrCreateSession({ client, sessionId, userId });
    session = activeSession.session;

    const response = await session.sendAndWait(
      { prompt: buildPrompt({ message, todos, userLabel }) },
      RESPONSE_TIMEOUT_MS
    );

    const content = response?.data?.content?.trim();

    if (!content) {
      throw new AssistantServiceError("The AI response was empty.", 502);
    }

    return {
      sessionId: activeSession.sessionId,
      model: CHAT_MODEL,
      content,
    };
  } catch (error) {
    throw normalizeError(error);
  } finally {
    if (session) {
      await session.disconnect().catch(() => undefined);
    }
  }
}

export async function destroyChatSession({ userId, sessionId }) {
  assertSessionOwnership(sessionId, userId);

  try {
    const client = await getClient();
    await client.deleteSession(sessionId);
  } catch (error) {
    const message = error?.message || "";

    if (/not found|unknown session/i.test(message)) {
      return;
    }

    throw normalizeError(error);
  }
}