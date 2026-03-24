# chip-gigabrain-trigger Operator Runbook

## Status
**IMPLEMENTED** — prod worker deployed, dev/local worker operational, end-to-end path verified.

## Architecture

```
task_promises.py
  └── launch_trigger_run.mjs → @trigger.dev/sdk → Trigger.cloud (dev or prod env)
  └── reconcile_trigger_run.mjs → @trigger.dev/sdk → check run status
  └── trigger dev worker (local) ← picks up dev runs
  └── Trigger.cloud prod worker ← deployed version 20260323.2
```

## Quick Reference

### Start dev worker (local)
```bash
/opt/clawd-workspace/scripts/trigger-worker-watchdog.sh start
```

### Check worker status
```bash
/opt/clawd-workspace/scripts/trigger-worker-watchdog.sh status
cat /tmp/trigger-worker.log
```

### Restart worker
```bash
/opt/clawd-workspace/scripts/trigger-worker-watchdog.sh restart
```

### Trigger a run manually
```bash
cd /opt/clawd-workspace/.repo-sync/chip-gigabrain/modules/chip-gigabrain-trigger && \
TRIGGER_SECRET_KEY=tr_dev_O225kdTkOlkFBi4OQAdW \
TRIGGER_API_URL=https://api.trigger.dev \
node scripts/launch_trigger_run.mjs \
  --task-name nightlyDigest \
  --payload /tmp/payload.json \
  --result /tmp/result.json \
  --env dev
```

### Reconcile run status
```bash
TRIGGER_SECRET_KEY=tr_dev_O225kdTkOlkFBi4OQAdW \
TRIGGER_API_URL=https://api.trigger.dev \
node scripts/reconcile_trigger_run.mjs \
  --run-id <run_id> \
  --result /tmp/result.json
```

### Deploy production worker
```bash
cd /opt/clawd-workspace/.repo-sync/chip-gigabrain/modules/chip-gigabrain-trigger && \
npm install && \
npx tsc -p tsconfig.json && \
npx trigger.dev deploy --env-file .env
```

## Environments

| Environment | Worker | Use case |
|---|---|---|
| `dev` | Local `trigger dev` | Development, testing, Gigabrain internal tasks |
| `prod` | Trigger.cloud deployed worker | Production workloads |

## Credentials

- **Location**: `/opt/clawd-workspace/skills/secret/chip-gigabrain/modules/chip-gigabrain-trigger/.env`
- **Project ref**: `proj_wmxednpiiwuzbdmiksps`
- **Account**: `e.yurchenko@gmail.com`
- **Dev worker**: started via watchdog script, survives session end via nohup + cron
- **Prod worker**: deployed to Trigger.cloud (version 20260323.2, 2 tasks)

## Task Registry

| Task name | File | Purpose |
|---|---|---|
| `nightlyDigest` | `trigger/nightlyDigest.ts` | Nightly digest generation |
| `codingStage` | `trigger/codingStage.ts` | Gigabrain coding stage execution |

## Pilot Capsule Example

Use a temporary `trigger_run` capsule when you want a real end-to-end proof without wiring a user-facing flow yet:

```bash
cd /opt/clawd-workspace
set -a
source /opt/clawd-workspace/skills/secret/chip-gigabrain/modules/chip-gigabrain-trigger/.env
set +a
python3 scripts/task_promises.py add   --title "Pilot rollout: Trigger nightly digest capsule"   --resume-kind trigger_run   --trigger-project-ref "$TRIGGER_PROJECT_REF"   --trigger-task-name gigabrain-nightly-digest   --trigger-input-json '{"scope":"pilot-rollout"}'   --trigger-idempotency-key "pilot-nightly-digest-<date>"   --webhook-secret-ref <configured-trigger-secret-env-var>   --trigger-environment prod   --definition-of-done "Record live Trigger run evidence and reconcile conservatively without false done claim"   --checkpoint "pilot-start"
python3 scripts/task_promises.py resume --id <task_id> --owner shaw-pilot
python3 scripts/task_promises.py reconcile
python3 scripts/task_promises.py inspect --id <task_id> --format json
python3 scripts/task_promises.py doctor --id <task_id> --format json
python3 scripts/task_promises.py cancel --id <task_id> --note "pilot proof captured"
```

Expected truth for this pilot:
- launch stores real `run_id` in `executor_ref`
- reconcile records runtime evidence without pretending webhook completion exists
- the temporary capsule is cancelled after proof capture so it does not pollute the queue

## Failure Handling

### Dev worker not picking up jobs
1. Check: `bash /opt/clawd-workspace/scripts/trigger-worker-watchdog.sh status`
2. If not running: `bash /opt/clawd-workspace/scripts/trigger-worker-watchdog.sh start`
3. Check log: `tail /tmp/trigger-worker.log`

### Runs stuck in QUEUED (prod)
- Prod worker may be inactive in Trigger.cloud dashboard
- Redeploy: `cd <module_dir> && npx trigger.dev deploy --env-file .env`
- Or switch to dev environment for jobs

### Webhook receiver
- Signed webhook replay is implemented via `python3 /opt/clawd-workspace/scripts/task_promises.py trigger-webhook --id <task_id> --body-file <event.json> --signature <hex>`
- Fresh live proof exists in this workspace: temporary proof task `T0223` accepted a signed `run.completed` event for a real Trigger run id
- A public HTTP webhook receiver is still not implemented; CLI/file replay is the verified path today
- See: `references/runtime-mapping.md`

## Health Check

```bash
# Check worker is alive
bash /opt/clawd-workspace/scripts/trigger-worker-watchdog.sh status

# Check recent runs
cd /opt/clawd-workspace/.repo-sync/chip-gigabrain/modules/chip-gigabrain-trigger && \
node -e "
const { configure, runs } = require('@trigger.dev/sdk');
configure({ secretKey: 'tr_dev_O225kdTkOlkFBi4OQAdW', baseURL: 'https://api.trigger.dev' });
runs.list({ projectRef: 'proj_wmxednpiiwuzbdmiksps', limit: 5 }).then(r => {
  r.data.forEach(run => console.log(run.id.slice(-12), run.status, run.env?.name, run.taskIdentifier));
}).catch(e => console.error(e.message));
"
```
