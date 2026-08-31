# Coordination rules — Vollausbau parallel packets (2026-08-31)

All Codex packets run in PARALLEL on the factory server, each in its own git
worktree and branch, off the same base commit. Claude (read-only reviewer)
integrates and reviews; Codex-Integrator merges. Follow these rules or your
work will not merge.

## Where you are

- Base clone: `/home/openclaw/factory/workspaces/codex-builder/runs/mise-neo/vollausbau-20260831`
  (branch `codex/neo-module-integration-20260826`).
- Your worktree: `…/mise-neo/wt-<packet>` on branch `vollausbau/<packet>`.
  Work ONLY there. Never touch the base clone or another worktree.
- Node deps are installed in the base clone; use `../vollausbau-20260831/node_modules`
  via the symlink `node_modules` in your worktree (already present).
- Binary paths: `./node_modules/.bin/vitest`, `./node_modules/.bin/tsc`,
  `./node_modules/.bin/next`, `./node_modules/.bin/playwright`.
- There is NO `.env` on this machine and NO database. Unit tests + typecheck +
  `next build` must be green. Playwright: write the specs and run them if they
  work without a live backend (mock/route-intercept like existing specs do);
  otherwise leave them ready and say so honestly in your report.

## Owner truth

Read, in this order: `2026-08-31-owner-order-verbatim.md` (binding wording),
`2026-08-31-vollausbau-master.md` (standing rules), your packet file.

## Conflict avoidance (hard rules)

1. **Migrations**: additive only; filename prefix reserved per packet so ordering
   is deterministic and never collides:
   - C-A `202608311[0-1]…` (already has `20260831100944_…`)
   - C-C `20260831120000`–`20260831129999`
   - C-D `20260831130000`–`20260831139999`
   - C-E `20260831140000`–`20260831149999`
   - C-F `20260831150000`–`20260831159999`
   Each file: explicit `begin; … commit;`, `create table if not exists`,
   `alter table … add column if not exists`, RLS pattern identical to
   `save_shift_operational_template` (tenant + location scope in SQL,
   service-role RPC for privileged writes, `security definer` + `set search_path`).
2. **Navigation / shell**: do NOT rewrite `app/(neo)/neo/app/shell.tsx` or
   layout. If you must add a nav entry, add exactly ONE line to the existing
   nav array in the alphabetically correct spot and nothing else in that file.
3. **Shared libs**: do not reformat or reorganize files you did not need to
   change. Minimal diffs. No renames of existing exports.
4. **New code lives in your area**: new components under your route folder,
   new API routes under `app/api/<your-area>/…`, new lib under
   `lib/<your-area>/…`, tests under `tests/<your-area>/…`.
5. **No parallel systems**: reuse existing tables/routes/components found in
   your audit. If something exists but is hidden, surface it instead of
   rebuilding it.
6. **UI language**: German, owner-friendly, honest empty states, mobile-first
   where staff use it, never JSON/technical data in normal UI.

## Definition of done per packet

- `./node_modules/.bin/tsc --noEmit -p .` exit 0
- `./node_modules/.bin/vitest run` all green (existing 222 + yours)
- `./node_modules/.bin/next build` exit 0 (see note on env: if build needs env
  vars, use the `.env.local.example` values that are non-secret; report gaps)
- Commits on your branch, conventional messages, no unrelated files.
- Report file `docs/agents/reports/2026-08-31-<packet>.md` containing:
  AUDIT (existed / hidden / missing), CHANGES (files), DB CHANGES (tables,
  columns, RPCs, RLS), TESTS RUN (exact commands + counts), OPEN ITEMS,
  HOW TO VERIFY MANUALLY (click path for owner, desktop + mobile).
- Final message: one paragraph summary + the report path. Nothing else.

Do not stop early. Do not ask questions — decide like a senior engineer, note
the decision in the report.
