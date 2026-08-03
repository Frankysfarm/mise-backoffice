# Dispatcher TL-G2 continuation baseline

Captured: 2026-08-03 (Europe/Berlin)

## Repository state

- Working directory: `/Users/eule/mise-driver-remediation`
- Branch: `codex/driver-remediation`
- HEAD: `551ff46f9951bb33221f313d9dbfd61546271920`
- Dirty-state SHA-256 (`git status --porcelain=v1`): `c5100c02c24a07b6b5946362294e22e56c536561bbdd03f5ae2e67231386ab52`
- Pre-existing modification: `artifacts/driver-system-lab/dispatcher-component/dispatcher-trace.zip`
- Pre-existing untracked files: none
- `git diff --check`: exit 0
- Free space on repository volume: 22 GiB
- Node: `v20.20.2`
- npm: `10.8.2`
- Playwright: `1.55.1`

The pre-existing trace modification is not owned by this continuation. Reproduction artifacts use separate run directories and must not overwrite or commit it.

## Last 25 commits at capture

```text
551ff46f fix(dispatch): stabilize forecast report hydration
619d277a fix(dispatch): stabilize efficiency and wait alarms
3022ad5c fix(dispatch): stabilize shift analytics startup
70507f34 fix(dispatch): harden risk and capacity widgets
2549bcc3 fix(dispatch): harden density and optimizer widgets
cb2d92e4 fix(dispatch): reject malformed live map data
e1fbbd3a test(dispatch): hold strict gate through async startup
c5b755f3 fix(dispatch): stabilize fleet startup metrics
5bbb972d fix(dispatch): validate legacy widget inputs
9790ccce fix(dispatch): remove more startup exceptions
967d9df3 fix(dispatch): harden next startup widgets
98ee6826 test(dispatch): enforce strict board startup gate
aabeccfa docs(lab): approve bounded dispatcher assignment gate
48446b82 fix(dispatch): typecheck production board graph
999e0131 fix(dispatch): propagate assignment outcomes
99ccb333 fix(dispatch): harden replay and failure propagation
c00effda fix(dispatch): close legacy writer bypasses
e584f8b7 fix(dispatch): enforce atomic manual assignment boundary
d551f6a9 docs(lab): record approved driver component gate
6489c4be test(driver): close reload and egress evidence gaps
eed5da61 test(driver): exercise production accept component
96708f41 docs(lab): record approved atomic storefront gate
2b4e2d9d fix(storefront): preserve exact money invariants
e276fdfb fix(storefront): lock orderability and expose checkout
a0955836 feat(storefront): create orders atomically and idempotently
```

## Safety boundary

Only the isolated local test lab is authorized. No production deployment, migration, secret change, real push, real order or production data access is permitted.
