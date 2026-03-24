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

const runId = argValue("--run-id");
const resultPath = argValue("--result");

if (!runId) fail("missing --run-id");
if (!resultPath) fail("missing --result");
if (!process.env.TRIGGER_PROJECT_REF) fail("missing TRIGGER_PROJECT_REF");
if (!process.env.TRIGGER_API_URL) process.env.TRIGGER_API_URL = "https://api.trigger.dev";

function mapRuntimeStatus(status) {
  const normalized = String(status || "").trim().toUpperCase();
  if (["PENDING_VERSION", "QUEUED", "DEQUEUED", "DELAYED"].includes(normalized)) return "trigger_queued";
  if (["EXECUTING", "RUNNING"].includes(normalized)) return "trigger_running";
  if (["WAITING", "PAUSED"].includes(normalized)) return "trigger_waiting_signal";
  if (["COMPLETED"].includes(normalized)) return "trigger_done_pending_verification";
  if (["FAILED", "CANCELED", "CANCELLED", "TIMED_OUT", "CRASHED", "SYSTEM_FAILURE", "EXPIRED"].includes(normalized)) return "trigger_failed";
  return "trigger_unknown";
}

try {
  const runtime = await resolveTriggerRuntimeClient({
    projectRef: process.env.TRIGGER_PROJECT_REF,
    requestedEnvironment: "prod",
    fallbackSecretKey: process.env.TRIGGER_SECRET_KEY,
    fallbackApiUrl: process.env.TRIGGER_API_URL,
  });
  const run = await runtime.client.retrieveRun(runId);
  const result = {
    ok: true,
    runId,
    retrievedAt: new Date().toISOString(),
    resolvedEnvironment: runtime.environment,
    resolvedApiUrl: runtime.apiUrl,
    apiKeySource: runtime.apiKeySource,
    apiKeyPrefix: runtime.apiKeyPrefix,
    mappedStatus: mapRuntimeStatus(run.status),
    dashboardUrl: run.dashboardUrl || null,
    run,
  };
  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ runId, status: run.status, environment: runtime.environment }, null, 2));
} catch (error) {
  const result = {
    ok: false,
    runId,
    retrievedAt: new Date().toISOString(),
    error: error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) },
  };
  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
  throw error;
}
