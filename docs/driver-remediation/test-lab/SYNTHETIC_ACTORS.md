# Synthetic actors

The lab defines deterministic, run/tenant-bound profiles for 15 customers,
15 kitchen conditions, 25 drivers and 10 dispatcher behaviors. The actor state
machine uses explicit expected-state transitions and records a monotonic event
sequence. UI actors operate through locator clicks/fills and server
preconditions; they do not receive a business-table writer.

The PostgreSQL factory currently materializes a minimal customer, kitchen,
driver, dispatcher and order set inside the run-owned schema. Expanding all
profiles into canonical API/UI fixtures remains part of TL-G1/TL-G2.
