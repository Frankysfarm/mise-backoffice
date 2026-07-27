# T06 GPS transport and native lifecycle

The canonical v2 endpoint is `POST /api/driver/v2/gps/events`. Driver identity
comes only from the bearer session. Every event carries a stable action ID,
tracking session, sequence, captured time, coordinates/accuracy, app/build,
platform, app lifecycle, permission/network state and capability flags. The
server supplies receipt time and correlation ID.

`mise_gps_transport_config.tracking_enabled` and
`background_tracking_enabled` are default-off. Tracking is accepted only for
`available`, `assigned`, `at_pickup`, `delivering`, or `returning`; shift end
must stop native updates. Exact driver/session/sequence replay is idempotent.
Older valid packets are retained as history but cannot replace current.
Invalid bounds/skew are rejected. Inaccuracy, permission/network state,
delayed delivery and implausible jumps are explicit quality flags. Dispatch
must consume the current row through `gpsEligibleForNewAssignment`; stale or
untrusted rows must not receive a new assignment, while active work is
escalated rather than abandoned. The adapter exists and is tested, but its
call in `lib/frank.ts` is intentionally not wired because that protected file
is owned by another task. T07 must call it immediately after loading each
candidate's `mise_driver_position_current` row and tenant GPS thresholds,
before scoring or assignment. Until that integration test passes, active
dispatch exclusion and G5 remain red.

Offline clients retain at most 100 events, ordered by session/sequence, and
replay serially. A successful or exact-replay response removes the head.
HTTP 409 and other terminal client errors quarantine only reason metadata,
discard the immutable stale envelope, reload canonical authorization and
continue. Transient failures use bounded retry/backoff; after six attempts the
bad head is quarantined so later points are not blocked. Shift/state or driver
authority-version changes rotate the native tracking session; shift end
retires it and visibly stops tracking.

Retention is configuration-driven and separately default-off. Cleanup is
tenant-scoped and bounded; enabling it requires an approved privacy policy and
an operator-owned scheduler. Roll back runtime by disabling both tracking
flags; do not drop history/current tables during incident response.

Platform limits: iOS background/locked updates require Always permission and
the location background mode, but force-quit prevents relaunch for location;
reboot behavior is OS-controlled. Android background tracking requires a
visible foreground-service notification and background permission on relevant
versions; force-stop prevents restart until the user launches the app.
Battery optimization, approximate permission and vendor policies can reduce
frequency. These limits require real-device evidence before G5 can be green.
The iOS bearer token is migrated from the Capacitor handoff into device-only
Keychain storage. Its bounded GPS queue is an AES-GCM encrypted file protected
until first device unlock; the encryption key is device-only Keychain
material. A legacy plaintext preferences queue is deleted only after a
successful encrypted round-trip, and corrupt ciphertext fails closed without
retaining coordinates. Android moves the handoff token and GPS queue into
Keystore-backed `EncryptedSharedPreferences`; the plaintext handoff is removed.
Local generated-project compilation is also environment-dependent: the T06
verification host had no Java runtime and only Xcode Command Line Tools, so
Android Gradle and iOS simulator compilation remain unverified even though
disposable project generation and manifest/target integration were checked.
