import { task } from "@trigger.dev/sdk";
import type { TriggerRunLaunchPayload, TriggerRunLaunchResult } from "./bridge-types.js";

export const nightlyDigest = task({
  id: "gigabrain-nightly-digest",
  retry: {
    maxAttempts: 5,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 30000,
    randomize: true,
  },
  run: async (payload: TriggerRunLaunchPayload): Promise<TriggerRunLaunchResult> => {
    return {
      capsuleTaskId: payload.taskId,
      accepted: true,
      receivedAt: new Date().toISOString(),
      nextCheckpoint: `trigger:${payload.checkpoint}:accepted`,
    };
  },
});
