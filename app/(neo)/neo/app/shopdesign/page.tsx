import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { createServiceClient } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';
const TEMPLATES = [
  { key: 'current', name: 'Euer Shop (aktuell)', tag: 'Aktiv', accent: '#0F9C50' },
  { key: 'aurora', name: 'Bento', tag: 'Modern, hell', accent: '#C2F03A' },
  { key: 'noir', name: 'Fresco', tag: 'Italienisch, warm', accent: '#C2552F' },
  { key: 'mercato', name: 'Mercato', tag: 'Bold, foodie', accent: '#FF5436' },
];
export default async function ShopDesign() {
  const emp = await getCurrentEmployee();
  const supabase = createServiceClient();
  const { data: t } = await supabase.from('tenants').select('slug').eq('id', emp?.tenant_id ?? '').maybeSingle();
  const shopUrl = t?.slug ? `https://mise-gastro.de/biss-app/${t.slug}` : '';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 390px', gap: 20, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Shop-Template wählen</h3>
          <p style={{ fontSize: 12.5, color: '#94A3B8' }}>Wähle das Design deines Online-Shops. Die Bestell-Logik bleibt gleich.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
          {TEMPLATES.map((tp) => (
            <div key={tp.key} style={{ background: '#fff', border: tp.key === 'current' ? '2px solid #4F46E5' : '1px solid #E2E8F0', borderRadius: 14, padding: 16, boxShadow: '0 1px 2px rgba(15,23,42,.05)' }}>
              <div style={{ height: 70, borderRadius: 10, background: tp.accent, marginBottom: 12 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 700, fontSize: 15 }}>{tp.name}</span>
                {tp.key === 'current' && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#4338CA', background: '#EEF2FF', borderRadius: 999, padding: '2px 8px' }}>{tp.tag}</span>}
              </div>
              {tp.key !== 'current' && <div style={{ fontSize: 12.5, color: '#94A3B8', marginTop: 3 }}>{tp.tag}</div>}
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: '#94A3B8' }}>Hinweis: 3 neue Themes (Bento/Fresco/Mercato) sind in Arbeit — euer aktueller Shop ist das 4. Template.</p>
      </div>
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 18, padding: 14, boxShadow: '0 1px 2px rgba(15,23,42,.05)', position: 'sticky', top: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#64748B', marginBottom: 10, textAlign: 'center' }}>Live-Vorschau</div>
        <div style={{ borderRadius: 22, overflow: 'hidden', border: '8px solid #0F172A', height: 620 }}>
          {shopUrl ? <iframe src={shopUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="Shop-Vorschau" /> : <div style={{ padding: 20, color: '#94A3B8' }}>Kein Shop-Slug.</div>}
        </div>
      </div>
    </div>
  );
}
