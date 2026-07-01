# CLAUDE_OPS.md — Ops Bridge Protocol

Load this file at every session start, after CLAUDE.md and CLAUDE_LOG.md.

---

## Purpose

The ops project (`cbvbixizegkbjwgsqzuh`) is the context bridge between Chat
Claude and Claude Code. It provides queued tasks via `dispatch_queue` and
persistent context docs via `context_documents`.

Claude Code does not connect to the Jokenia DB (`oiyazguuiqjyrljraodd`) —
all backend work is done by Chat Claude. Claude Code inherits the Supabase
MCP from the Claude Desktop session. No separate MCP config or PAT needed.
Specify `project_id: cbvbixizegkbjwgsqzuh` on every ops call.

---

## Session Start — Ops Check

Run after loading native context files (CLAUDE.md, CLAUDE_LOG.md).

### Step 1 — Check for queued work

execute_sql — project_id: cbvbixizegkbjwgsqzuh
```sql
SELECT * FROM get_pending_dispatch(
  p_project_id   := '7f945045-e145-436f-a882-5de8129276a0',
  p_session_type := 'Desktop App'
);
```

Returns items ordered priority ASC (1=critical, 5=normal, 7=low), then
created_at ASC. If empty — use CLAUDE_LOG.md context and proceed with
no further ops DB interaction.

### Step 2 — Claim the first item

execute_sql — project_id: cbvbixizegkbjwgsqzuh
```sql
SELECT claim_dispatch_item('<id>'::uuid, 'claude_code/<EAT_ISO8601>');
```

Claim before reading context or executing. Prevents double-claiming.

### Step 3 — Read referenced context docs (if context_refs is non-empty)

execute_sql — project_id: cbvbixizegkbjwgsqzuh
```sql
SELECT doc_key, content
FROM context_documents
WHERE doc_key = ANY(ARRAY['JOKENIA_GLOBAL', '<component_key>']);
```

Available doc_keys:
- JOKENIA_GLOBAL — shared business rules and conventions (always read)
- CLAUDE_BACKEND — backend SQL conventions
- CLAUDE_ADMIN — admin app conventions
- CLAUDE_STAFF — staff app conventions
- CLAUDE_DESKTOP — desktop app conventions (once Chat Claude creates this context_document entry)

Read every key listed in context_refs. Skip this step if context_refs is
empty.

### Step 4 — Execute

Follow the prompt in dispatch_queue.prompt exactly.
One concern, explicit scope, typecheck before done.

### Step 5 — Complete or fail

execute_sql — project_id: cbvbixizegkbjwgsqzuh
```sql
-- On success:
SELECT complete_dispatch_item('<id>'::uuid, '<one-line result summary>');

-- On failure:
SELECT fail_dispatch_item('<id>'::uuid, '<what failed and where it stopped>');
```

### Step 6 — Update CLAUDE_LOG.md

Always append a log entry after execution, regardless of outcome:
Timestamp | Session type | Files touched | What was done and why | Follow-up items

---

## Priority Scale

| Value | Meaning                        |
|-------|--------------------------------|
| 1     | Critical — blocking live system|
| 3     | High — blocking next release   |
| 5     | Normal (default)               |
| 7     | Low — non-urgent               |

---

## Status Lifecycle

pending → [claim_dispatch_item] → claimed → [complete_dispatch_item] → done
                                           → [fail_dispatch_item]     → failed

---

## Ops Project Reference

| Field                          | Value                                |
|--------------------------------|--------------------------------------|
| Ops project ID                 | cbvbixizegkbjwgsqzuh                 |
| Jokenia project_id (filter)    | 7f945045-e145-436f-a882-5de8129276a0 |
| session_type                   | Desktop App                          |
| MCP source                     | Inherited from Claude Desktop session|
