import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { createServiceClient } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';
const eur = (n: number) => Number(n ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

export default async function MenuPage() {
  const emp = await getCurrentEmployee();
  const supabase = createServiceClient();
  const locId = emp?.location_id ?? '';
  const [{ data: cats }, { data: items }] = await Promise.all([
    supabase.from('menu_categories').select('id, name, aktiv, sort_order').eq('location_id', locId).order('sort_order', { ascending: true }),
    supabase.from('menu_items').select('id, name, beschreibung, preis, mwst_satz, verfuegbar, category_id, beliebt').eq('location_id', locId).order('sort_order', { ascending: true }),
  ]);
  const cl = (cats ?? []) as any[];
  const il = (items ?? []) as any[];
  const groups = [...cl.map((c) => ({ id: c.id, name: c.name, items: il.filter((i) => i.category_id === c.id) })), { id: null, name: 'Ohne Kategorie', items: il.filter((i) => !i.category_id || !cl.find((c) => c.id === i.category_id)) }].filter((g) => g.items.length > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13.5, color: '#64748B' }}>{il.length} Artikel · {cl.length} Kategorien</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{ height: 38, padding: '0 14px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', fontSize: 13, fontWeight: 600, color: '#334155', cursor: 'pointer' }}>📄 Importieren (Excel/CSV)</button>
          <button style={{ height: 38, padding: '0 16px', borderRadius: 10, border: 'none', background: '#4F46E5', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 8px 20px rgba(79,70,229,.3)' }}>+ Artikel anlegen</button>
        </div>
      </div>
      {groups.length === 0 && <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 40, textAlign: 'center', color: '#94A3B8' }}>Noch keine Artikel. Lege deine Speisekarte an oder importiere sie.</div>}
      {groups.map((g) => (
        <div key={String(g.id)} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 2px rgba(15,23,42,.05)' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 10 }}>
            <h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 16, fontWeight: 700 }}>{g.name}</h3>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B', background: '#F1F5F9', borderRadius: 999, padding: '1px 8px' }}>{g.items.length}</span>
          </div>
          {g.items.map((it: any, i: number) => {
            const mwst = it.mwst_satz != null ? Math.round(Number(it.mwst_satz)) : 7;
            return (
              <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 20px', borderBottom: i < g.items.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 14.5, color: '#0F172A' }}>{it.name}</span>
                    {it.beliebt && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#B45309', background: '#FEF3C7', borderRadius: 999, padding: '1px 7px' }}>Beliebt</span>}
                  </div>
                  {it.beschreibung && <div style={{ fontSize: 12.5, color: '#94A3B8', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 520 }}>{it.beschreibung}</div>}
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: mwst >= 19 ? '#1D4ED8' : '#047857', background: mwst >= 19 ? '#EFF6FF' : '#ECFDF5', borderRadius: 6, padding: '3px 8px' }}>{mwst}% USt</span>
                <span style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 700, fontSize: 14.5, minWidth: 76, textAlign: 'right' }}>{eur(it.preis)}</span>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: it.verfuegbar ? '#10B981' : '#EF4444' }} title={it.verfuegbar ? 'verfügbar' : 'ausverkauft'} />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
