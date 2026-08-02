import { NextRequest, NextResponse } from 'next/server';
import { getAdminContext, isAdminContext } from '@/app/api/admin/_lib/tenant-from-session';
import { createServiceClient } from '@/lib/supabase/server';
import {
  claimAtomicWriterV2,
  createAtomicAssignmentV2,
  selectedDispatchWriter,
} from '@/lib/delivery/atomic-offer';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ASSIGN_ROLES = new Set(['admin', 'owner', 'manager', 'dispatcher', 'inhaber']);

type ManualAssignBody = {
  employee_id?: unknown;
  order_ids?: unknown;
  location_id?: unknown;
  action_id?: unknown;
};

function reject(reason: string, status: number) {
  return NextResponse.json({ ok: false, reason_code: reason }, { status });
}

export async function POST(request: NextRequest) {
  const context = await getAdminContext();
  if (!isAdminContext(context)) return context;
  if (!ASSIGN_ROLES.has(context.role.toLowerCase())) return reject('DISPATCH_ROLE_REQUIRED', 403);

  let body: ManualAssignBody;
  try { body = await request.json() as ManualAssignBody; } catch { return reject('INVALID_JSON', 400); }
  const employeeId = typeof body.employee_id === 'string' ? body.employee_id : '';
  const locationId = typeof body.location_id === 'string' ? body.location_id : '';
  const actionId = typeof body.action_id === 'string' ? body.action_id : '';
  const orderIds = Array.isArray(body.order_ids) ? body.order_ids : [];
  if (!UUID.test(employeeId) || !UUID.test(locationId) || !UUID.test(actionId)
      || orderIds.length < 1 || orderIds.length > 4
      || orderIds.some((id) => typeof id !== 'string' || !UUID.test(id))
      || new Set(orderIds).size !== orderIds.length) {
    return reject('INVALID_ASSIGNMENT_REQUEST', 400);
  }

  const writerId = process.env.DISPATCH_MANUAL_WRITER_ID ?? '';
  if (!UUID.test(writerId)) return reject('MANUAL_WRITER_NOT_CONFIGURED', 503);
  const service = createServiceClient();

  try {
    if (await selectedDispatchWriter(service, context.tenant_id) !== 'atomic_v2') {
      return reject('ATOMIC_WRITER_NOT_ACTIVE', 409);
    }
    const lease = await claimAtomicWriterV2(service, context.tenant_id, writerId);
    if (!lease.ok || lease.writer_epoch == null) return reject(lease.reason_code ?? 'WRITER_LEASE_REJECTED', 409);

    const [{ data: driver }, { data: location }, { data: orders, error: ordersError }] = await Promise.all([
      service.from('mise_drivers').select('id,state_version,employee_id').eq('employee_id', employeeId).maybeSingle(),
      service.from('locations').select('id,tenant_id,name,lat,lng,adresse,plz,stadt').eq('id', locationId).eq('tenant_id', context.tenant_id).maybeSingle(),
      service.from('customer_orders')
        .select('id,location_id,dispatch_version,kunde_lat,kunde_lng,kunde_adresse,eta_earliest,eta_latest')
        .in('id', orderIds),
    ]);
    if (!driver) return reject('DRIVER_NOT_FOUND', 404);
    if (!location || location.lat == null || location.lng == null) return reject('LOCATION_NOT_ROUTABLE', 409);
    if (ordersError || !orders || orders.length !== orderIds.length) return reject('ORDER_SET_NOT_FOUND', 404);
    if (orders.some((order) => order.location_id !== locationId)) return reject('MULTI_LOCATION_ASSIGNMENT_FORBIDDEN', 409);
    if (orders.some((order) => order.kunde_lat == null || order.kunde_lng == null
      || !order.eta_earliest || !order.eta_latest || order.dispatch_version == null)) {
      return reject('ORDER_NOT_ROUTABLE', 409);
    }

    const result = await createAtomicAssignmentV2(service, {
      tenantId: context.tenant_id,
      writerId,
      writerEpoch: lease.writer_epoch,
      driverId: driver.id,
      expectedDriverVersion: Number(driver.state_version),
      actionId,
      orders: orders.map((order) => ({
        orderId: order.id,
        expectedOrderVersion: Number(order.dispatch_version),
        pickup: {
          lat: Number(location.lat), lng: Number(location.lng),
          address: [location.adresse, location.plz, location.stadt].filter(Boolean).join(', ') || location.name,
        },
        dropoff: { lat: Number(order.kunde_lat), lng: Number(order.kunde_lng), address: order.kunde_adresse ?? '' },
        pickupDeadlineAt: order.eta_earliest,
        deliveryDeadlineAt: order.eta_latest,
      })),
      push: { title: `Neue Tour: ${location.name}`, body: 'Eine neue Lieferung ist dir zugewiesen.' },
    });
    if (!result.ok) return reject(result.reason_code ?? 'ATOMIC_ASSIGNMENT_REJECTED', 409);
    return NextResponse.json(result);
  } catch (error) {
    const correlationId = crypto.randomUUID();
    console.error('manual dispatch assignment failed', { correlationId, error });
    return NextResponse.json({ ok: false, reason_code: 'MANUAL_ASSIGNMENT_FAILED', correlation_id: correlationId }, { status: 500 });
  }
}
