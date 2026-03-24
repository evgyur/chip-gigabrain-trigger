import fs from "node:fs";
import process from "node:process";
import { resolveTriggerRuntimeClient } from "./resolve_trigger_runtime_client.mjs";

function argValue(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1 || idx + 1 >= process.argv.length) return "";
  return process.argv[idx + 1] || "";
}

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

process.loadEnvFile?.(".env");

const payloadPath = argValue("--payload");
const resultPath = argValue("--result");
const taskName = argValue("--task-name");

if (!payloadPath) fail("missing --payload");
if (!resultPath) fail("missing --result");
if (!taskName) fail("missing --task-name");
if (!process.env.TRIGGER_PROJECT_REF) fail("missing TRIGGER_PROJECT_REF");
if (!process.env.TRIGGER_API_URL) process.env.TRIGGER_API_URL = "https://api.trigger.dev";

const raw = fs.readFileSync(payloadPath, "utf8");
const payload = JSON.parse(raw);
const requestedEnvironment = argValue("--env") || payload.environment || process.env.TRIGGER_ENV || "prod";

const triggerOptions = {
  idempotencyKey: typeof payload.idempotency_key === "string" ? payload.idempotency_key : undefined,
  tags: [
    "gigabrain",
    "task-capsule",
    typeof payload.taskId === "string" ? `capsule:${payload.taskId}` : "",
    typeof taskName === "string" ? `trigger-task:${taskName}` : "",
  ].filter(Boolean),
  metadata: {
    capsuleTaskId: payload.taskId,
    checkpoint: payload.checkpoint,
    definitionOfDone: payload.definitionOfDone,
  },
};

try {
  const runtime = await resolveTriggerRuntimeClient({
    projectRef: process.env.TRIGGER_PROJECT_REF,
    requestedEnvironment,
    fallbackSecretKey: process.env.TRIGGER_SECRET_KEY,
    fallbackApiUrl: process.env.TRIGGER_API_URL,
  });

  const handle = await runtime.client.triggerTask(taskName, {
    payload,
    context: {},
    options: triggerOptions,
  });

  const result = {
    ok: true,
    taskName,
    handle,
    triggerOptions,
    requestedEnvironment,
    resolvedEnvironment: runtime.environment,
    resolvedApiUrl: runtime.apiUrl,
    apiKeySource: runtime.apiKeySource,
    apiKeyPrefix: runtime.apiKeyPrefix,
    triggeredAt: new Date().toISOString(),
  };
  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ runId: handle.id, taskName, environment: runtime.environment }, null, 2));
} catch (error) {
  const result = {
    ok: false,
    taskName,
    requestedEnvironment,
    triggeredAt: new Date().toISOString(),
    error: error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) },
  };
  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
  throw error;
}
