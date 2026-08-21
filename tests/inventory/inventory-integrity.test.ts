import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const migration = fs.readFileSync(path.join(root, 'scripts/migrations/073_inventory_tenant_integrity.sql'), 'utf8');
const employeePage = fs.readFileSync(path.join(root, 'app/mitarbeiter/page.tsx'), 'utf8');
const counter = fs.readFileSync(path.join(root, 'app/mitarbeiter/inventur/[id]/counter.tsx'), 'utf8');
const sendRoute = fs.readFileSync(path.join(root, 'app/api/inventory/orders/[id]/send/route.ts'), 'utf8');
const sendButton = fs.readFileSync(path.join(root, 'app/(admin)/inventory/orders/send-button.tsx'), 'utf8');

describe('inventory tenant and workflow contract', () => {
  it('enables RLS for every inventory table that contains tenant-owned operational data', () => {
    for (const table of [
      'suppliers', 'inventory_shelves', 'inventory_receiving', 'inventory_waste',
      'inventory_sessions', 'inventory_counts', 'inventory_batches', 'item_suppliers',
      'stock_movements', 'order_lists',
    ]) {
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it('completes assigned blind counts atomically and records an audit movement', () => {
    expect(migration).toContain('function public.complete_inventory_session');
    expect(migration).toContain('for update;');
    expect(migration).toContain('every active inventory item must be counted exactly once');
    expect(migration).toContain("'inventory_session',v_session.id");
    expect(migration).toContain('update public.inventory_items set letzte_inventur=v_count');
    expect(migration).toContain('set abgeschlossen_am=now()');
  });

  it('shows only the signed-in employee’s open tasks and submits one atomic RPC', () => {
    expect(employeePage).toContain(".eq('assigned_to', employee.id)");
    expect(employeePage).toContain(".eq('area.location.tenant_id', employee.tenant_id)");
    expect(counter).toContain("rpc('complete_inventory_session'");
    expect(counter).not.toContain('letzte_inventur');
  });

  it('keeps order email sending local, tenant-scoped and idempotent', () => {
    expect(sendButton).toContain("fetch(`/api/inventory/orders/${orderId}/send`");
    expect(sendButton).not.toContain('/functions/v1/order-list-mail');
    expect(sendRoute).toContain(".eq('tenant_id', employee.tenant_id)");
    expect(sendRoute).toContain('idempotencyKey: `inventory-order-${order.id}`');
    expect(sendRoute).toContain(".eq('status', 'entwurf')");
  });
});
