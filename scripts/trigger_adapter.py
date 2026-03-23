#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import hmac
import json
from typing import Any, Dict, Tuple


class TriggerAdapterNotImplemented(RuntimeError):
    pass


REQUIRED_PAYLOAD_FIELDS = (
    'project_ref',
    'task_name',
    'input',
    'idempotency_key',
    'webhook_secret_ref',
)


def validate_trigger_resume_payload(payload: Dict[str, Any]) -> Tuple[bool, str | None]:
    if not isinstance(payload, dict):
        return False, 'payload_not_object'
    for field in REQUIRED_PAYLOAD_FIELDS:
        if field not in payload or payload.get(field) in (None, ''):
            return False, f'missing_{field}'
    if not isinstance(payload.get('input'), dict):
        return False, 'input_not_object'
    return True, None


def build_executor_ref(*, run_id: str, environment: str | None = None, latest_step: str | None = None) -> Dict[str, Any]:
    ref: Dict[str, Any] = {
        'provider': 'trigger.dev',
        'run_id': run_id,
        'kind': 'trigger_run',
    }
    if environment:
        ref['environment'] = environment
    if latest_step:
        ref['latest_step'] = latest_step
    return ref


def map_runtime_status(status: str) -> str:
    normalized = (status or '').strip().lower()
    return {
        'queued': 'trigger_queued',
        'pending': 'trigger_queued',
        'running': 'trigger_running',
        'waiting': 'trigger_waiting_signal',
        'paused': 'trigger_waiting_signal',
        'retrying': 'trigger_retrying',
        'completed': 'trigger_done_pending_verification',
        'failed': 'trigger_failed',
    }.get(normalized, 'trigger_unknown')


def verify_webhook_signature(*, raw_body: bytes, secret: str, signature: str) -> bool:
    if not secret or not signature:
        return False
    digest = hmac.new(secret.encode('utf-8'), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, signature)


def launch_trigger_run(payload: Dict[str, Any]) -> Dict[str, Any]:
    valid, reason = validate_trigger_resume_payload(payload)
    if not valid:
        raise TriggerAdapterNotImplemented(f'invalid_trigger_payload:{reason}')
    raise TriggerAdapterNotImplemented('trigger_run_launch_not_implemented')


def reconcile_trigger_event(event: Dict[str, Any]) -> Dict[str, Any]:
    status = map_runtime_status(str(event.get('status') or ''))
    return {
        'mapped_status': status,
        'event': event,
    }


if __name__ == '__main__':
    raise SystemExit('This is a library scaffold, not a standalone command yet.')
