# Human acceptance runbook

Run only in the guarded test tenant with synthetic customers and a visible
test-run ID. Required people are a dispatcher, kitchen operator and two drivers
using recorded app/build versions. Stop immediately on a foreign tenant/order,
missing run ID, duplicate active assignment, unaccounted order, unsafe route or
provider escape; retain screens and logs and perform only run-owned cleanup.

Execute and sign separately: one order; two compatible orders; four orders with
only the safe subset bundled; kitchen delay; lost push and snapshot recovery;
offline/reconnect; consented mid-tour proposal; middle-order cancellation;
route replan; complete multi-drop delivery. For every step record expected UI,
actual UI, actor, timestamp, correlation/run ID and deviation. Dispatcher,
kitchen and both drivers sign usability and observed operational behavior.

Start requires TL-G0, prepared synthetic fixtures, safe provider sinks, charged
test devices and an abort owner. Completion requires all test rows cleaned by
the exact run ID and retained evidence. This runbook authorizes no production
action.
