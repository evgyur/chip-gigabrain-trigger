export type TriggerRunLaunchPayload = {
  taskId: string;
  checkpoint: string;
  definitionOfDone: string;
  artifacts: string[];
  input: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type TriggerRunLaunchResult = {
  capsuleTaskId: string;
  accepted: true;
  receivedAt: string;
  nextCheckpoint: string;
};

export type CodingStagePayload = TriggerRunLaunchPayload & {
  input: {
    repo?: string;
    cwd?: string;
    stageGoal?: string;
    deliverables?: string[];
    mode?: "implementation" | "verification" | "repair" | string;
    [key: string]: unknown;
  };
  metadata?: TriggerRunLaunchPayload["metadata"] & {
    cwd?: string;
  };
};

export type CodingStageResult = TriggerRunLaunchResult & {
  stage: {
    repo: string;
    cwd: string;
    stageGoal: string;
    deliverables: string[];
    mode: string;
  };
  verificationHint: "await_artifact_verification";
};
