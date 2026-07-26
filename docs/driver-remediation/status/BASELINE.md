# T00 Baseline

Recorded: 2026-07-26 (Europe/Berlin)

## Source repository before isolation

- Repository: `/Users/eule/mise-backoffice-work`
- Branch: `codex/p0-single-writer-atomic-offer`
- Commit: `f14afea523f766603fe49c8cba716086abe72b37`
- Staged diff: empty (`staged.patch`, 0 bytes)
- Unstaged binary diff: 11,057 bytes
- Untracked archive: 112,034 bytes
- Generated `tsconfig.p0.tsbuildinfo` was inventoried but excluded from the preserved baseline commit.

Exact original `git status --short --branch`:

```text
## codex/p0-single-writer-atomic-offer...origin/codex/p0-single-writer-atomic-offer
 M docs/task-packets/P1-INTELLIGENT-15KM-ELIGIBILITY.md
 M lib/delivery/intelligent-dispatch.ts
 M lib/frank.ts
 M scripts/tests/intelligent-dispatch.test.ts
 M tsconfig.p0.json
?? DRIVER_SYSTEM_AUDIT.md
?? DRIVER_SYSTEM_FACTS.json
?? docs/task-packets/P1-LONG-DISTANCE-SMART-BATCHING.md
?? lib/delivery/long-distance-batching.ts
?? scripts/migrations/275_gps_history_security_retention.sql
?? scripts/tests/long-distance-batching.test.ts
?? tsconfig.p0.tsbuildinfo
```

Exact untracked inventory:

```text
DRIVER_SYSTEM_AUDIT.md
DRIVER_SYSTEM_FACTS.json
docs/task-packets/P1-LONG-DISTANCE-SMART-BATCHING.md
lib/delivery/long-distance-batching.ts
scripts/migrations/275_gps_history_security_retention.sql
scripts/tests/long-distance-batching.test.ts
tsconfig.p0.tsbuildinfo
```

## Reproducible safety snapshot

The non-repository snapshot is:

`/Users/eule/mise-remediation-snapshots/20260726-t00-baseline`

It contains:

- `head.txt`
- `branch.txt`
- `status-short-branch.txt`
- `status-porcelain.txt`
- `staged.patch`
- `unstaged.patch`
- `untracked-files.txt`
- `untracked-files.tar.gz`
- `SHA256SUMS`

The original worktree was not reset, cleaned, stashed, or modified by isolation.

## Isolated remediation worktree

- Worktree: `/Users/eule/mise-driver-remediation`
- Branch: `codex/driver-remediation`
- Base commit: `f14afea523f766603fe49c8cba716086abe72b37`
- Preservation commit: `dc7385ed`

The preservation commit records the pre-T00 intended source/test/documentation
state separately from the T00 task commit. It is not evidence that those
pre-existing business changes are correct.

## AGENTS merge

No root `AGENTS.md` or `AGENTS.override.md` existed in the source repository.
The only discovered `AGENTS.md` was dependency-owned under
`node_modules/recharts` and does not govern repository work. Therefore the
semantic merge has no conflicting existing clauses: the proposed remediation
file is promoted unchanged to root `AGENTS.md`. The diff is a pure file
addition; no stricter repository rule was removed.

## Package manager decision

T00 selects `npm` for reproducible commands:

- `package-lock.json` was updated at commit `70d7acc5` on 2026-07-24.
- `pnpm-lock.yaml` was last updated at commit `027a2c21` on 2026-07-09.
- Existing scripts use npm-compatible `package.json` commands.
- `package-lock.json` is therefore the newer lock record for the current
  manifest.

`pnpm-lock.yaml` is retained as evidence. Removing or rewriting either lockfile
is outside T00.

## Native verification baseline

The separate native repository was also preserved without touching its dirty
main worktree:

- Source: `/Users/eule/mise-driver-app`
- Source branch/commit: `main` / `afc25f88deac18658316f9db531e878f14c73442`
- Snapshot: `/Users/eule/mise-remediation-snapshots/20260726-t00-native-baseline`
- Isolated worktree: `/Users/eule/mise-driver-native-t00`
- Branch: `codex/t00-native-verify`
- Preservation commit: `021f2a9`

The generated nested `.claude/worktrees/` directory was inventoried but not
copied into the isolated native worktree.
