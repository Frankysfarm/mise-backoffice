import Link from 'next/link';
import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { redirect } from 'next/navigation';
import { MenuImportClient } from '@/app/(admin)/menu/import/client';
export const dynamic = 'force-dynamic';

export default async function NeoMenuImport() {
  const emp = await getCurrentEmployee();
  if (!emp?.location_id) redirect('/neo/app/menu');
  return (
    <div style={{ maxWidth: 1180 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <Link href="/neo/app/menu" style={{ width: 38, height: 38, borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', color: '#475569', fontSize: 18 }}>←</Link>
        <div>
          <h2 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 20, fontWeight: 700, color: '#0F172A' }}>Menü importieren</h2>
          <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>Excel/CSV hochladen, Speisekarte abfotografieren, Sprachnotiz aufnehmen oder Liste einfügen — die KI erkennt alle Positionen.</p>
        </div>
      </div>
      <MenuImportClient />
    </div>
  );
}
