#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
import subprocess
from pathlib import Path
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

MODULE_DIR = Path(__file__).resolve().parents[1]
LAUNCH_SCRIPT = MODULE_DIR / 'scripts' / 'launch_trigger_run.mjs'
RECONCILE_SCRIPT = MODULE_DIR / 'scripts' / 'reconcile_trigger_run.mjs'


def _compact_text(value: Any, limit: int = 800) -> str:
    text = '' if value is None else str(value).strip()
    return text[:limit]


def _load_json(path: str | Path) -> Any:
    return json.loads(Path(path).read_text(encoding='utf-8'))


def _write_json(path: str | Path, payload: Dict[str, Any]) -> None:
    Path(path).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')


def validate_trigger_resume_payload(payload: Dict[str, Any]) -> Tuple[bool, str | None]:
    if not isinstance(payload, dict):
        return False, 'payload_not_object'
    for field in REQUIRED_PAYLOAD_FIELDS:
        if field not in payload or payload.get(field) in (None, ''):
            return False, f'missing_{field}'
    if not isinstance(payload.get('input'), dict):
        return False, 'input_not_object'
    return True, None


def build_executor_ref(*, run_id: str, environment: str | None = None, latest_step: str | None = None,
                       dashboard_url: str | None = None, public_access_token: str | None = None,
                       last_status: str | None = None) -> Dict[str, Any]:
    ref: Dict[str, Any] = {
        'provider': 'trigger.dev',
        'run_id': run_id,
        'kind': 'trigger_run',
    }
    if environment:
        ref['environment'] = environment
    if latest_step:
        ref['latest_step'] = latest_step
    if dashboard_url:
        ref['dashboard_url'] = dashboard_url
    if public_access_token:
        ref['public_access_token'] = public_access_token
    if last_status:
        ref['last_status'] = last_status
    return ref


def map_runtime_status(status: str) -> str:
    normalized = (status or '').strip().lower()
    return {
        'queued': 'trigger_queued',
        'pending': 'trigger_queued',
        'pending_version': 'trigger_queued',
        'dequeued': 'trigger_queued',
        'delayed': 'trigger_queued',
        'running': 'trigger_running',
        'executing': 'trigger_running',
        'waiting': 'trigger_waiting_signal',
        'paused': 'trigger_waiting_signal',
        'retrying': 'trigger_retrying',
        'completed': 'trigger_done_pending_verification',
        'failed': 'trigger_failed',
        'canceled': 'trigger_failed',
        'cancelled': 'trigger_failed',
        'timed_out': 'trigger_failed',
        'crashed': 'trigger_failed',
        'system_failure': 'trigger_failed',
    }.get(normalized, 'trigger_unknown')


def verify_webhook_signature(*, raw_body: bytes, secret: str, signature: str) -> bool:
    if not secret or not signature:
        return False
    digest = hmac.new(secret.encode('utf-8'), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, signature)


def _run_node_script(script_path: Path, *, args: list[str], env: Dict[str, str]) -> Dict[str, Any]:
    proc = subprocess.run(
        ['node', str(script_path), *args],
        cwd=str(MODULE_DIR),
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    return {
        'exit_code': proc.returncode,
        'stdout': proc.stdout,
        'stderr': proc.stderr,
        'command': ['node', str(script_path), *args],
    }


def launch_trigger_run(payload: Dict[str, Any]) -> Dict[str, Any]:
    valid, reason = validate_trigger_resume_payload(payload)
    if not valid:
        raise TriggerAdapterNotImplemented(f'invalid_trigger_payload:{reason}')
    if not LAUNCH_SCRIPT.exists():
        raise TriggerAdapterNotImplemented(f'trigger_launcher_missing:{LAUNCH_SCRIPT}')

    task_name = _compact_text(payload.get('task_name'), 240)
    payload_path = _compact_text(payload.get('payload_path'), 1000)
    result_path = _compact_text(payload.get('result_path'), 1000)
    if not payload_path:
        raise TriggerAdapterNotImplemented('missing_payload_path')
    if not result_path:
        raise TriggerAdapterNotImplemented('missing_result_path')
    webhook_secret_ref = _compact_text(payload.get('webhook_secret_ref'), 240)
    secret_present = bool(webhook_secret_ref and os.environ.get(webhook_secret_ref))
    if not secret_present:
        raise TriggerAdapterNotImplemented(f'missing_webhook_secret_value:{webhook_secret_ref}')

    proc = _run_node_script(
        LAUNCH_SCRIPT,
        args=['--payload', payload_path, '--result', result_path, '--task-name', task_name],
        env=os.environ.copy(),
    )
    result_payload = _load_json(result_path) if Path(result_path).exists() else None
    if proc['exit_code'] != 0:
        error_message = _compact_text(
            ((result_payload or {}).get('error') or {}).get('message') if isinstance(result_payload, dict) else ''
            or proc['stderr']
            or proc['stdout']
            or f'trigger launcher exited with {proc["exit_code"]}',
            1200,
        )
        raise TriggerAdapterNotImplemented(error_message or 'trigger_launcher_failed')

    handle = (result_payload or {}).get('handle') if isinstance(result_payload, dict) else None
    if not isinstance(handle, dict) or not _compact_text(handle.get('id'), 240):
        raise TriggerAdapterNotImplemented('trigger_launch_missing_handle_id')

    run_id = _compact_text(handle.get('id'), 240)
    resolved_environment = _compact_text((result_payload or {}).get('resolvedEnvironment'), 120) or _compact_text(payload.get('environment'), 120) or 'prod'
    output = {
        'ok': True,
        'task_name': task_name,
        'run_id': run_id,
        'handle': handle,
        'triggered_at': (result_payload or {}).get('triggeredAt'),
        'result_path': result_path,
        'resolved_environment': resolved_environment,
        'runtime_status': 'trigger_queued',
        'executor_ref': build_executor_ref(
            run_id=run_id,
            environment=resolved_environment,
            public_access_token=_compact_text(handle.get('publicAccessToken'), 4000) or None,
            last_status='trigger_queued',
        ),
    }
    return output


def reconcile_trigger_event(event: Dict[str, Any]) -> Dict[str, Any]:
    event_type = _compact_text(event.get('type'), 240)
    obj = event.get('object') if isinstance(event.get('object'), dict) else {}
    run = obj.get('run') if isinstance(obj.get('run'), dict) else event.get('run') if isinstance(event.get('run'), dict) else {}
    task = obj.get('task') if isinstance(obj.get('task'), dict) else event.get('task') if isinstance(event.get('task'), dict) else {}
    status = _compact_text(run.get('status') or event.get('status'), 80)
    mapped_status = map_runtime_status(status)
    error_payload = run.get('error') if isinstance(run.get('error'), dict) else {}
    error_message = _compact_text(
        error_payload.get('message')
        or error_payload.get('raw')
        or error_payload.get('code')
        or event.get('error')
        or '',
        1200,
    ) or None
    return {
        'event_type': event_type or 'unknown',
        'mapped_status': mapped_status,
        'run_id': _compact_text(run.get('id'), 240) or None,
        'task_identifier': _compact_text(task.get('id') or task.get('filePath'), 240) or None,
        'dashboard_url': _compact_text(run.get('dashboardUrl'), 1200) or None,
        'latest_step': _compact_text(run.get('latestAttempt', {}).get('status'), 240) if isinstance(run.get('latestAttempt'), dict) else None,
        'last_event_at': _compact_text(run.get('completedAt') or run.get('startedAt') or run.get('createdAt') or event.get('timestamp'), 120) or None,
        'error_message': error_message,
        'event': event,
    }


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Gigabrain Trigger.dev adapter')
    sub = parser.add_subparsers(dest='command', required=True)

    p_launch = sub.add_parser('launch')
    p_launch.add_argument('--payload', required=True)
    p_launch.add_argument('--result', required=True)
    p_launch.add_argument('--task-name', required=True)
    p_launch.add_argument('--environment')

    p_webhook = sub.add_parser('reconcile-webhook')
    p_webhook.add_argument('--body-file', required=True)
    p_webhook.add_argument('--signature', required=True)
    p_webhook.add_argument('--secret', required=True)
    p_webhook.add_argument('--result', required=True)

    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    try:
        if args.command == 'launch':
            launch_payload = _load_json(args.payload)
            if not isinstance(launch_payload, dict):
                raise TriggerAdapterNotImplemented('launch_payload_not_object')
            launch_payload = dict(launch_payload)
            launch_payload['payload_path'] = args.payload
            launch_payload['result_path'] = args.result
            launch_payload['task_name'] = args.task_name
            if args.environment:
                launch_payload['environment'] = args.environment
            result = launch_trigger_run(launch_payload)
            _write_json(args.result, result)
            print(json.dumps({'ok': True, 'runId': result.get('run_id'), 'taskName': args.task_name}, ensure_ascii=False))
            return 0

        if args.command == 'reconcile-webhook':
            raw_body = Path(args.body_file).read_bytes()
            verified = verify_webhook_signature(raw_body=raw_body, secret=args.secret, signature=args.signature)
            if not verified:
                raise TriggerAdapterNotImplemented('invalid_webhook_signature')
            event = json.loads(raw_body.decode('utf-8'))
            if not isinstance(event, dict):
                raise TriggerAdapterNotImplemented('webhook_payload_not_object')
            reconciled = reconcile_trigger_event(event)
            payload = {
                'ok': True,
                'verified': True,
                'signature': 'verified',
                'reconciled': reconciled,
            }
            _write_json(args.result, payload)
            print(json.dumps({'ok': True, 'mappedStatus': reconciled.get('mapped_status'), 'runId': reconciled.get('run_id')}, ensure_ascii=False))
            return 0
    except Exception as exc:  # noqa: BLE001
        if getattr(args, 'result', None):
            _write_json(args.result, {
                'ok': False,
                'error': {
                    'message': _compact_text(str(exc), 2000) or exc.__class__.__name__,
                    'type': exc.__class__.__name__,
                },
            })
        print(_compact_text(str(exc), 2000), file=os.sys.stderr)
        return 1
    return 1


if __name__ == '__main__':
    raise SystemExit(main())
