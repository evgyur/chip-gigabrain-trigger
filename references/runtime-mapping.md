# Trigger.dev Runtime Mapping (Draft)

## Goal
Map Trigger.dev runtime events into conservative Task Capsule reconcile states.

## Suggested mapping

| Trigger runtime signal | Capsule reconcile result | Notes |
|---|---|---|
| queued | `trigger_queued` | informational |
| running | `trigger_running` | not proof of meaningful progress by itself |
| waiting / paused for signal | `trigger_waiting_signal` | should usually imply blocked/waiting semantics |
| retry scheduled | `trigger_retrying` | runtime-level retry evidence |
| completed | `trigger_done_pending_verification` | never auto-close task |
| failed | `trigger_failed` | capture reason, keep truthful |
| unknown/untrusted payload | `trigger_unknown` | fail closed |

## Rule
Runtime state may update `executor_ref`, notes, and candidate checkpoint movement.
It must not bypass artifact or definition-of-done verification.

## Current implementation note
The current Gigabrain v1 rail uses SDK-based retrieval (`runs.retrieve`) for post-launch runtime reconciliation.
This gives us real runtime status mapping without yet depending on a public webhook receiver.

Completion rule in v1:
- `COMPLETED` + verification pass => capsule may be marked `done`
- otherwise remain in `trigger_run_awaiting_verification`

Operational caveat:
- completion proof requires an available Trigger worker or deployed version that can actually execute the run
- without that, runtime status may remain `QUEUED` even if launch succeeded
