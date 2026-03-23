import fs from "node:fs";
import process from "node:process";
import { configure } from "@trigger.dev/sdk";
import { nightlyDigest } from "../dist/trigger/nightlyDigest.js";

function argValue(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1 || idx + 1 >= process.argv.length) return "";
  return process.argv[idx + 1] || "";
}

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

const payloadPath = argValue("--payload");
const resultPath = argValue("--result");
const taskName = argValue("--task-name");

if (!payloadPath) fail("missing --payload");
if (!resultPath) fail("missing --result");
if (!taskName) fail("missing --task-name");
if (!process.env.TRIGGER_SECRET_KEY) fail("missing TRIGGER_SECRET_KEY");
if (!process.env.TRIGGER_API_URL) process.env.TRIGGER_API_URL = "https://api.trigger.dev";

configure({
  secretKey: process.env.TRIGGER_SECRET_KEY,
  baseURL: process.env.TRIGGER_API_URL,
});

const taskRegistry = {
  nightlyDigest,
  "gigabrain-nightly-digest": nightlyDigest,
};

const task = taskRegistry[taskName];
if (!task) fail(`unknown trigger task: ${taskName}`);

const raw = fs.readFileSync(payloadPath, "utf8");
const payload = JSON.parse(raw);

try {
  const handle = await task.trigger(payload);
  const result = {
    ok: true,
    taskName,
    handle,
    triggeredAt: new Date().toISOString(),
  };
  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ runId: handle.id, taskName }, null, 2));
} catch (error) {
  const result = {
    ok: false,
    taskName,
    triggeredAt: new Date().toISOString(),
    error: error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) },
  };
  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
  throw error;
}
