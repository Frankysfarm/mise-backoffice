# T04 — Pick and Pickup Correctness

## Objective

A driver may not depart with missing, unresolved or partially picked assigned orders.

## Required implementation

1. Define server-side item outcomes: present/confirmed, substituted-approved, cancelled/refunded/resolved-missing, and unresolved.
2. Do not treat “missing” as confirmation.
3. Create atomic batch/trip pickup validation covering every assigned order and required item.
4. Prevent partial multi-order departure when one order remains unresolved.
5. Make pickup/departure idempotent and versioned.
6. Update driver UI to display exact unresolved reason and required next action.
7. Handle order cancellation or item change during picking.
8. Record actor/time/evidence/audit events.

## Mandatory tests

- one order complete;
- multi-order complete;
- one item missing unresolved;
- approved substitution;
- cancellation during pick;
- duplicate pickup request;
- two devices picking same order;
- offline replay after pickup already committed.

## Acceptance

Relevant G4 pick/pickup clauses green.
