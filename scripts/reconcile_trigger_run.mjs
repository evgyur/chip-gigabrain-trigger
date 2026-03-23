import fs from "node:fs";
import process from "node:process";
import { configure, runs } from "@trigger.dev/sdk";

function argValue(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1 || idx + 1 >= process.argv.length) return "";
  return process.argv[idx + 1] || "";
}

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

const runId = argValue("--run-id");
const resultPath = argValue("--result");

if (!runId) fail("missing --run-id");
if (!resultPath) fail("missing --result");
if (!process.env.TRIGGER_SECRET_KEY) fail("missing TRIGGER_SECRET_KEY");
if (!process.env.TRIGGER_API_URL) process.env.TRIGGER_API_URL = "https://api.trigger.dev";

configure({
  secretKey: process.env.TRIGGER_SECRET_KEY,
  baseURL: process.env.TRIGGER_API_URL,
});

try {
  const run = await runs.retrieve(runId);
  const result = {
    ok: true,
    runId,
    retrievedAt: new Date().toISOString(),
    run,
  };
  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ runId, status: run.status }, null, 2));
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
