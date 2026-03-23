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
