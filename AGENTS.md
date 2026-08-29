# Mais Gastro Neo agent contract

This repository uses one integration lead and two independent specialist roles.
These rules apply to Codex, Claude, Kimi, and humans working through them.

## Product invariant

Mais Gastro Neo is the only active product surface. Former Mise OS features must
use the same Supabase Auth identity, tenants, locations, employees, navigation,
notifications, tasks, and reporting data. Do not introduce a second login,
parallel employee model, or duplicate operational module. See
`docs/NEO_MISE_OS_FUSION.md` before changing identity or module boundaries.

## Roles

- **Codex — integration lead:** owns task decomposition, cross-module/backend
  work, final integration, release evidence, database operations, and deploys.
- **Kimi — implementation specialist:** implements a narrowly scoped UI or
  feature packet in its own worktree. It does not merge or deploy its own work.
- **Claude — independent reviewer:** reviews the integrated diff for architecture,
  security, tenant/location isolation, regressions, and missing acceptance
  criteria. Review is read-only unless a separate fix packet is assigned.

No agent may approve its own work. A blocker or major finding from the reviewer
must be resolved or explicitly accepted by the human owner before deployment.

## Task and file ownership

1. Start from a recorded base commit and a completed `docs/agents/TASK_PACKET.md`.
2. Give every implementation packet an exclusive file list or directory boundary.
3. Use one worktree per writing agent and a branch named `agent/<agent>-<scope>`.
4. Never let two agents edit the same file concurrently. Reassign ownership in
   the task packet before crossing a boundary.
5. The integration lead cherry-picks or merges reviewed commits, then runs the
   repository gates on the combined tree.
6. Record durable progress and evidence in `docs/agents/HANDOFF.md`; chat history
   is not a source of truth.

Suggested worktree creation from the repository parent:

```bash
git worktree add ../neo-kimi-<scope> -b agent/kimi-<scope> <base-commit>
git worktree add ../neo-claude-review -b agent/claude-review-<scope> <base-commit>
```

## Security and production boundaries

- Never copy global CLI configuration into this repository. Secrets, passwords,
  service-role keys, production cookies, and private prompts must not be committed.
- Browser input is never trusted for tenant, location, role, employee, or price.
- Service-role reads must be server-only, minimally selected, tenant-scoped, and
  location-scoped where the actor is not company-wide.
- Schema/RLS changes require a migration, rollback notes, isolated database tests,
  and Supabase security review. Do not mutate production data as a shortcut.
- Only the integration lead may deploy or run production/database operations, and
  only when the active task authorizes it.
- Preserve user changes in a dirty worktree. Never use destructive Git cleanup.

## Required gates

Use the repository's declared Node 22 and pnpm versions. Before handoff:

```bash
git diff --check
corepack pnpm test
corepack pnpm typecheck:delivery
corepack pnpm build
corepack pnpm exec playwright test
```

Run targeted tests while developing. Add isolated RLS tests for schema/security
changes and authenticated desktop/mobile browser evidence for user-facing flows.
Build success alone is not proof that an authenticated workflow works.

## Definition of done

- Task-packet acceptance criteria are mapped to code and evidence.
- Empty, loading, error, permission-denied, and mobile states are intentional.
- Tenant/location and sensitive employee-data boundaries are tested.
- No duplicate Mise OS/Neo data source or navigation path was introduced.
- Reviewer findings are closed, the combined release gate is green, and
  `docs/agents/HANDOFF.md` contains the final commit, tests, risks, and rollback.

