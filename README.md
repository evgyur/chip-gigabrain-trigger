# chip-gigabrain-trigger

Trigger.dev integration module for Gigabrain.

## Role
This module isolates Trigger.dev-specific execution code from Task Capsule core.

It is intended to own:
- Trigger.dev client wrapper
- run launch/resume primitives
- webhook verification
- status/event mapping
- payload normalization
- operator runbooks

## Boundary
- `chip-gigabrain-task-capsule` remains the canonical durable task contract
- `chip-gigabrain-trigger` is an optional executor integration
- Trigger.dev runtime is execution infrastructure, not promised-work truth

## Current status
Scaffold with real git-ready module structure.
A minimal Trigger.dev task project exists (`trigger.config.ts`, `trigger/` tasks, package manifest), but no live Gigabrain launch/webhook executor is implemented yet.

## Planned integration point
Task Capsule adapter:
- `resume_kind=trigger_run`

## References
- `references/architecture.md`
- `references/operator-runbook.md`
- `references/runtime-mapping.md`
- `../chip-gigabrain-task-capsule/references/trigger-run-adapter.md`
