# chip-gigabrain-trigger Operator Runbook

## Status
Scaffold only.
No production executor yet.

## Before enabling
- Trigger.dev project/environment exists
- webhook secret material exists
- Task Capsule `trigger_run` schema is configured
- support matrix clearly marks the adapter as proposed/implemented but not verified
- fallback behavior is defined

## Safe operator claims
Allowed:
- Trigger integration scaffold exists
- capsule schema planning exists
- runtime adapter is not production-ready yet

Forbidden:
- claiming Trigger executor is working end-to-end without live proof
- claiming runtime completion equals task completion

## Pilot order
1. nightly batch/digest pipeline
2. TG preview/publish pipeline

## Failure rule
If Trigger runtime truth is ambiguous, block fail-closed instead of auto-closing tasks.
