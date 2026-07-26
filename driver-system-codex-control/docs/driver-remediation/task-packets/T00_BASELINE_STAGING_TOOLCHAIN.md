# T00 — Baseline, Staging and Toolchain

## Objective

Create a safe, reproducible remediation baseline without changing product behavior.

## Required actions

1. Record branch, commit, `git status --short`, staged diff, unstaged diff and untracked files in `docs/driver-remediation/status/BASELINE.md`.
2. Create a non-destructive binary diff snapshot and inventory of untracked source files. Do not reset, clean or stash.
3. Create an isolated branch/worktree for remediation. Preserve intended dirty source/test/docs changes; exclude generated artifacts such as `*.tsbuildinfo` from the baseline commit unless explicitly required.
4. Merge the proposed remediation AGENTS instructions with any existing `AGENTS.md`, preserving stricter rules.
5. Resolve package-manager/lockfile ambiguity by documenting the chosen command path. Do not delete alternative lockfiles merely to simplify the task.
6. Make lint non-interactive and repair only tool configuration needed to execute it.
7. Diagnose the hanging build and invalid `turbopack` option. Fix configuration only if it does not alter product behavior.
8. Repair the native `verify-fast.sh` scaffold so it validates the intended source tree and does not parse invalid dependency files.
9. Establish an isolated schema-compatible database test approach: local Supabase/Postgres container, disposable schema or equivalent. Never point tests at production.
10. Create `PROGRAM_STATUS.md`, `FILE_OWNERSHIP.md`, `MIGRATION_MATRIX.md` and a commands table.

## Protected files

Do not change business logic in `lib/frank.ts`, dispatch algorithms, lifecycle APIs or driver UI during T00.

## Acceptance

Gate G0 in `ACCEPTANCE_GATES.md` is fully green. Report any environment blocker with exact reproduction.
