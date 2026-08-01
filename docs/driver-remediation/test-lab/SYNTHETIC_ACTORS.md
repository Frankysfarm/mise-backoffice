# Synthetic actors

The lab defines deterministic, run/tenant-bound profiles for 15 customers,
15 kitchen conditions, 25 drivers and 10 dispatcher behaviors. The actor state
machine uses explicit expected-state transitions and records a monotonic event
sequence. UI actors operate through locator clicks/fills and server
preconditions; they do not receive a business-table writer.

The PostgreSQL factory materializes all 65 profiles with behavior, display
identity and metadata inside the run-owned schema. Binding them to canonical
application API/UI fixtures remains part of TL-G1/TL-G2.
