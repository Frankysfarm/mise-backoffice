import { notFound } from 'next/navigation';
import { MisePOSv5Wrapper } from '@/app/(admin)/pos/terminal-v5/client';

export const dynamic = 'force-dynamic';

const ids = {
  tenant: '00000000-0000-4000-8000-000000000001',
  location: '00000000-0000-4000-8000-000000000002',
  employee: '00000000-0000-4000-8000-000000000003',
  register: '00000000-0000-4000-8000-000000000004',
  shift: '00000000-0000-4000-8000-000000000005',
  table: '00000000-0000-4000-8000-000000000012',
};

function safeJSON(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

export default function PosQaPreviewPage() {
  if (process.env.MISE_E2E_POS !== '1') notFound();
  const employeeName = 'QA Service';
  const data = {
    areas: [{ id: 'innen', name: 'Innenraum' }],
    roomLayout: { innen: [{ id: ids.table, label: '12', x: 90, y: 90, w: 88, h: 88, shape: 'round', seats: 4 }] },
    categories: [
      { id: 'bestseller', name: 'Top', icon: 'Star', color: '#E68A2C', special: true },
      { id: 'food', name: 'Food', icon: 'Salad', color: '#7A8C4A', taxRate: 7 },
      { id: 'drinks', name: 'Getränke', icon: 'Coffee', color: '#4A3429', taxRate: 19 },
    ],
    products: {
      food: [{
        id: '00000000-0000-4000-8000-000000000101', name: 'Açaí Power Bowl', price: 1150, featured: true,
        modGroups: [{
          id: 'size', name: 'Größe', type: 'single', required: true,
          options: [{ id: 'regular', name: 'Normal', price: 0 }, { id: 'large', name: 'Groß', price: 200 }],
        }],
      }],
      drinks: [{ id: '00000000-0000-4000-8000-000000000102', name: 'Iced Matcha', price: 690, featured: true }],
    },
    bestsellerIds: ['00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000102'],
    soldOut: [], initialOrders: {}, coupons: [], activePagers: [], nextPager: 1,
    summary: { revenueCents: 0, guests: 0 },
    runtime: { tenantId: ids.tenant, locationId: ids.location, employeeId: ids.employee, employeeName, registerId: ids.register, shiftId: ids.shift },
  };

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: `globalThis.MISE_POS_DATA = ${safeJSON(data)};` }} />
      <MisePOSv5Wrapper
        tenantId={ids.tenant} locationId={ids.location} employeeId={ids.employee}
        employeeName={employeeName} registerId={ids.register}
        initialShift={{ id: ids.shift, employee_id: ids.employee, start_at: new Date().toISOString(), status: 'offen' }}
      />
    </>
  );
}
