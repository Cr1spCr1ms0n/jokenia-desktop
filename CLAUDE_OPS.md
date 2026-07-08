# CLAUDE_OPS.md — Jokenia Operations Desktop
session_type: "Desktop App"
project_id:   7f945045-e145-436f-a882-5de8129276a0
ops_project:  cbvbixizegkbjwgsqzuh

CANONICAL PROCEDURE — at every dispatch run start, load and follow exactly:
  SELECT content FROM context_documents WHERE doc_key = 'DISPATCH_PROTOCOL';
  (execute_sql on project cbvbixizegkbjwgsqzuh)

Standing authorization: "execute pending dispatches" (or equivalent) = fetch via
get_pending_dispatches('7f945045-e145-436f-a882-5de8129276a0', 'Desktop App'),
then claim → execute → complete sequentially. No confirmation questions.

## Repo deltas
- typecheck: run the repo typecheck script per package.json (npm run typecheck
  or tsc --noEmit equivalent)
- Renderer never writes tables directly — Supabase JS client calls RPCs only.
- release dispatches: after npm run release, verify exactly ONE draft release
  exists via gh api; delete duplicates by numeric ID before un-drafting
  (CLAUDE.md section 15 — electron-builder issue 6676).
- GitHub publish uses a fine-grained PAT scoped to this repo, Contents
  read/write only. Never echo or log the PAT.
