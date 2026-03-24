import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { ApiClient } from "@trigger.dev/core/v3";

function normalizeEnvironment(raw) {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return "prod";
  if (["prod", "production", "managed", "managed-prod", "managed_production"].includes(value)) return "prod";
  if (["staging", "stage", "stg"].includes(value)) return "staging";
  if (["dev", "development", "local"].includes(value)) {
    throw new Error(`unsupported Trigger environment for Shaw capsule launches: ${raw}`);
  }
  throw new Error(`unknown Trigger environment: ${raw}`);
}

function getTriggerConfigPath() {
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg) return path.join(xdg, "trigger", "config.json");
  return path.join(os.homedir(), ".config", "trigger", "config.json");
}

function readStoredCliAuth() {
  const configPath = getTriggerConfigPath();
  if (!fs.existsSync(configPath)) return null;
  const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const currentProfile = parsed?.currentProfile || "default";
  const profile = parsed?.profiles?.[currentProfile] || parsed?.profiles?.default;
  if (!profile?.accessToken || !profile?.apiUrl) return null;
  return {
    source: `trigger-cli:${currentProfile}`,
    accessToken: profile.accessToken,
    apiUrl: profile.apiUrl,
  };
}

function getManagementAuth() {
  if (process.env.TRIGGER_ACCESS_TOKEN) {
    return {
      source: "TRIGGER_ACCESS_TOKEN",
      accessToken: process.env.TRIGGER_ACCESS_TOKEN,
      apiUrl: process.env.TRIGGER_API_URL || "https://api.trigger.dev",
    };
  }
  return readStoredCliAuth();
}

async function fetchProjectEnvironment({ projectRef, environment, auth }) {
  const url = new URL(`/api/v1/projects/${projectRef}/${environment}`, auth.apiUrl).href;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`failed to resolve Trigger ${environment} environment (${response.status} ${response.statusText}): ${text.slice(0, 300)}`);
  }
  return await response.json();
}

export async function resolveTriggerRuntimeClient({ projectRef, requestedEnvironment, fallbackSecretKey, fallbackApiUrl }) {
  const environment = normalizeEnvironment(requestedEnvironment);
  if (!projectRef) throw new Error("missing TRIGGER_PROJECT_REF");

  const fallbackPrefix = String(fallbackSecretKey || "").slice(0, 8);
  if (environment === "prod" && fallbackPrefix.startsWith("tr_prod_")) {
    return {
      environment,
      apiUrl: fallbackApiUrl || "https://api.trigger.dev",
      apiKeySource: "TRIGGER_SECRET_KEY",
      apiKeyPrefix: fallbackPrefix,
      client: new ApiClient(fallbackApiUrl || "https://api.trigger.dev", fallbackSecretKey),
    };
  }

  const auth = getManagementAuth();
  if (!auth) {
    throw new Error(`Trigger ${environment} launch requires Trigger CLI login or TRIGGER_ACCESS_TOKEN because TRIGGER_SECRET_KEY is not ${environment}-scoped`);
  }

  const projectEnv = await fetchProjectEnvironment({ projectRef, environment, auth });
  const apiKey = projectEnv?.apiKey;
  const apiUrl = projectEnv?.apiUrl || fallbackApiUrl || "https://api.trigger.dev";
  if (!apiKey) throw new Error(`Trigger ${environment} environment did not return an apiKey`);

  return {
    environment,
    apiUrl,
    apiKeySource: `${auth.source}->${environment}`,
    apiKeyPrefix: String(apiKey).slice(0, 8),
    projectId: projectEnv?.projectId || null,
    projectName: projectEnv?.name || null,
    client: new ApiClient(apiUrl, apiKey),
  };
}
