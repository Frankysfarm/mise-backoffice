import type { DriverV2Snapshot } from './driver-v2-contract';

export type PickOutcome =
  | 'present_confirmed'
  | 'substituted_approved'
  | 'cancelled_refunded'
  | 'resolved_missing'
  | 'unresolved';

export function buildAtomicPickupManifest(
  snapshot: DriverV2Snapshot,
  outcomes: Array<{ id: string; order_id: string; outcome: PickOutcome; evidence?: Record<string, unknown> }>,
) {
  if (!snapshot.trip) throw new Error('ACTIVE_TRIP_REQUIRED');
  const activeOrders = new Set(snapshot.orders.filter((order) => order.state === 'assigned'
    && snapshot.assignments.some((row) => row.order_id === order.id && row.state === 'assigned'))
    .map((order) => order.id));
  const activeItems = snapshot.items.filter((item) => activeOrders.has(item.order_id));
  const activeOutcomes = outcomes.filter((item) => activeOrders.has(item.order_id));
  const byId = new Map(activeOutcomes.map((item) => [item.id, item]));
  if (byId.size !== activeOutcomes.length || activeItems.some((item) => !byId.has(item.id))
    || activeOutcomes.some((item) => !activeItems.some((serverItem) =>
      serverItem.id === item.id && serverItem.order_id === item.order_id))) {
    throw new Error('REQUIRED_ITEM_SET_MISMATCH');
  }
  return snapshot.orders.filter((order) => activeOrders.has(order.id))
    .sort((a, b) => a.id.localeCompare(b.id)).map((order) => {
      const stop = snapshot.stops.find((row) => row.type === 'pickup' && row.order_id === order.id);
      const assignment = snapshot.assignments.find((row) => row.order_id === order.id);
      if (!stop || !assignment) throw new Error('ASSIGNED_ORDER_SET_MISMATCH');
      return {
        order_id: order.id, order_version: order.version,
        assignment_id: assignment.id, assignment_version: assignment.version,
        stop_id: stop.id, stop_version: stop.version,
        items: snapshot.items.filter((item) => item.order_id === order.id)
          .sort((a, b) => a.id.localeCompare(b.id)).map((item) => {
            const resolved = byId.get(item.id)!;
            return { id: item.id, outcome: resolved.outcome, evidence: resolved.evidence ?? {} };
          }),
      };
    });
}
