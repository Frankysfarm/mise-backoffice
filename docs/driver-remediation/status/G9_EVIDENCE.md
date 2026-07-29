# G9 Evidence — Complete E2E and Release Readiness

Status: **BLOCKED_EXTERNAL**
Confidence: **HIGH for local database/source contracts; NONE for unrun hardware/live services**

| Requirement | Evidence | Command | Exit/result | Limitation |
|---|---|---|---|---|
| Full retained local system | Eight canonical suites in disposable PostgreSQL | `scripts/tests/run-t10-local-release-readiness.sh` | 0 PASS | Local service substitutes |
| Races/failure injection | Writer 100-overlap, API/pick/append/override races, rollback/replay tests | included above | PASS | Test-scale load |
| Static TypeScript | focused P0 typecheck | `tsc -p tsconfig.p0.json --noEmit` | 0 PASS | Focused config |
| Web build | Hermetic Next production build, 446 static pages | `npm run build` | 0 PASS | Requires configured 8 GiB heap |
| Native source | native `verify-full.sh` | native worktree | 0 PASS with warning | No project-specific compiled/device suite |
| Hosted E2E | Supabase/PostgREST/Realtime, push/payment/routing sandboxes | not available | BLOCKED_EXTERNAL | Credentials/services absent |
| Physical apps | signed iOS/Android and device lifecycle | not available | BLOCKED_EXTERNAL | Xcode/Java/devices/signing absent |

G9 cannot be GREEN without the blocked evidence and no claim is inferred from
unit/source tests.
