# chip-gigabrain-trigger Architecture

## Purpose

Provide a dedicated Trigger.dev integration module for Gigabrain without pushing vendor-specific logic into Task Capsule core.

## Placement

Layering:
- `chip-gigabrain` — orchestrator shell and policy
- `chip-gigabrain-task-capsule` — durable task truth and resume contract
- `chip-gigabrain-trigger` — Trigger.dev adapter/integration module
- Trigger.dev runtime — managed execution backend

## Responsibilities

This module should own:
1. outbound Trigger.dev run launch calls
2. run idempotency and payload shaping
3. webhook signature verification
4. run event/status mapping
5. runtime-specific diagnostics and operator docs

## Non-goals

This module must not own:
- task truth
- definition of done
- final completion authority
- memory-layer responsibilities

## Truth rule

Trigger.dev run state is evidence, not final task truth.
The capsule remains authoritative until artifact/DoD verification passes.

## v1 execution flow

1. Orchestrator opens a Task Capsule with `resume_kind=trigger_run`
2. Trigger adapter launches a run in Trigger.dev
3. Runtime evidence is written into `executor_ref`
4. Trigger events are verified and mapped into capsule reconcile states
5. Final completion still requires Task Capsule verification before `done`
