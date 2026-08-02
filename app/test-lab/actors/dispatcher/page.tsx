import { notFound } from 'next/navigation';
import { DispatchBoard } from '@/app/(admin)/dispatch/client';
import { assertTestLabEnvironment } from '@/tests/driver-system-lab/support/environment';

export const dynamic = 'force-dynamic';

export default function TestLabDispatcherActorPage() {
  try { assertTestLabEnvironment(); } catch { notFound(); }
  return <DispatchBoard
    initialOrders={[{
      id: 'b5000000-0000-4000-8000-000000000001', bestellnummer: 'TL-X-1001', status: 'fertig', typ: 'lieferung',
      kunde_name: 'Testkunde Dispatch', kunde_adresse: 'Laborstraße 10', kunde_plz: '10115', kunde_lat: 52.521, kunde_lng: 13.406,
      gesamtbetrag: 24, zahlungsart: 'bar', fertig_am: '2026-08-02T10:00:00.000Z', external_source: null,
      location_id: 'b3000000-0000-4000-8000-000000000001', dispatch_score: 90, delivery_zone: 'mitte',
      eta_earliest: '2026-08-02T10:20:00.000Z', eta_latest: '2026-08-02T10:35:00.000Z',
      kunde_notiz: null, kunde_lieferhinweis: null,
    }]}
    initialDrivers={[{
      employee_id: 'b1000000-0000-4000-8000-000000000001', ist_online: true, fahrzeug: 'bike', aktueller_batch_id: null,
      last_lat: 52.52, last_lng: 13.405, last_update: '2026-08-02T10:00:00.000Z', online_seit: '2026-08-02T09:00:00.000Z',
      employee: { id: 'b1000000-0000-4000-8000-000000000001', vorname: 'Test', nachname: 'Dispatcherfahrer', avatar_url: null, telefon: null },
    }]}
    initialBatches={[]}
    locations={[{ id: 'b3000000-0000-4000-8000-000000000001', name: 'Testküche Dispatch', lat: 52.52, lng: 13.405 }]}
  />;
}
