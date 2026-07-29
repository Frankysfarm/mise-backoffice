# External Blockers

Updated: 2026-07-29

## Mobile and hardware

- Full Xcode, signing profiles, CocoaPods integration and physical iPhones are
  unavailable.
- Java/Android build toolchain and supported physical Android devices are
  unavailable.
- Foreground/background/lock/relaunch/reboot, permission transition, long-trip
  and battery lifecycle evidence therefore remains unexecuted.

## Hosted isolated staging

- No approved isolated Supabase/PostgREST/Realtime project or credentials were
  supplied.
- No sandbox payment, push or routing provider credentials were supplied.
- Real Realtime loss/reconnect, provider push receipt and hosted RLS behavior
  cannot be inferred from local substitutes.

## Networked web build

The Next production build attempted to fetch Google Fonts. The restricted
environment returned `ENOTFOUND fonts.googleapis.com` for every retry, so the
network-dependent build cannot complete here. Focused TypeScript compilation
is green.

## Required resolution

Use the staging, device and rollout runbooks with synthetic data and explicit
non-production credentials. Do not use production merely to clear a gate.
