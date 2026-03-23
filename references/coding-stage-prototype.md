# Coding Stage Prototype

## Purpose

Provide a Trigger.dev task shaped for long coding-stage execution contracts in Gigabrain.

This prototype does **not** claim to fully execute arbitrary coding work inside Trigger.dev Cloud.
Instead it proves the contract shape for long implementation stages while preserving Task Capsule truth.

## Trigger task
- task id: `gigabrain-coding-stage`
- launcher alias: `codingStage`

## Intended input

```json
{
  "repo": "chip-gigabrain",
  "cwd": "/opt/clawd-workspace/.repo-sync/chip-gigabrain",
  "stageGoal": "implement trigger_run adapter v2",
  "deliverables": [
    "code changes",
    "verification artifact",
    "summary"
  ],
  "mode": "implementation"
}
```

## Contract meaning

The prototype proves:
- Task Capsule can launch a Trigger.dev coding-stage run
- run identity is captured in `executor_ref`
- capsule can conservatively stop in `trigger_run_awaiting_verification`
- coding-stage metadata survives the launch path

It does **not** yet prove:
- remote code editing in Trigger.dev Cloud
- webhook-driven completion
- automatic artifact verification
- full long-lived human-in-the-loop coding loops

## Why this still matters

This is the correct next abstraction boundary for long coding tasks:
- Trigger.dev can be the execution/orchestration rail
- Task Capsule remains the contract and truth model
- local/ACP/subagent execution can later be attached behind the same stage contract
