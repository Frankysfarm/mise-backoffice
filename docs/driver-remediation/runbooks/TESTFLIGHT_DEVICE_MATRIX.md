# TestFlight and Device Matrix

Status: **NOT EXECUTED — devices/signing unavailable**

Required before G5/G9 can be green end-to-end:

| Platform | Minimum evidence |
|---|---|
| iPhone current iOS | foreground/background/lock/relaunch/reboot, permission changes, offline queue, stale-session fencing, long trip |
| iPhone previous supported iOS | same lifecycle plus upgrade from previous app |
| Android supported current | foreground/background/Doze/relaunch/reboot, permission changes, offline queue, long trip |
| Android low-memory device | process death/recovery and bounded encrypted queue |

For every device record model, OS, app build, installation/session IDs,
permission state, timestamps, battery mode, network transitions, server
accept/reject reasons and final canonical snapshot. Use synthetic orders and a
non-production push/routing project. No live upload is authorized by this
runbook.
