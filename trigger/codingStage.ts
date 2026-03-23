import { task } from "@trigger.dev/sdk";
import type { CodingStagePayload, CodingStageResult } from "./bridge-types.js";

export const codingStage = task({
  id: "gigabrain-coding-stage",
  retry: {
    maxAttempts: 5,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 30000,
    randomize: true,
  },
  run: async (payload: CodingStagePayload): Promise<CodingStageResult> => {
    const repo = payload.input.repo ?? "unknown";
    const stageGoal = payload.input.stageGoal ?? "unspecified";
    const cwd = payload.input.cwd ?? payload.metadata?.cwd ?? "/opt/clawd-workspace";
    const deliverables = payload.input.deliverables ?? [];

    return {
      capsuleTaskId: payload.taskId,
      accepted: true,
      receivedAt: new Date().toISOString(),
      nextCheckpoint: `trigger:${payload.checkpoint}:coding-stage-accepted`,
      stage: {
        repo,
        cwd,
        stageGoal,
        deliverables,
        mode: payload.input.mode ?? "implementation",
      },
      verificationHint: "await_artifact_verification",
    };
  },
});
