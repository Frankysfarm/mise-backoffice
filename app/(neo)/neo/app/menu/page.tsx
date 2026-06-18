import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { createServiceClient } from '@/lib/supabase/server';
import { MenuView, Soon } from './client';
export const dynamic = 'force-dynamic';
export default async function MenuPage() {
  const emp = await getCurrentEmployee();
  const supabase = createServiceClient();
  const locId = emp?.location_id ?? '';
  const [{ data: cats }, { data: items }] = await Promise.all([
    supabase.from('menu_categories').select('id, name, aktiv, sort_order').eq('location_id', locId).order('sort_order', { ascending: true }),
    supabase.from('menu_items').select('id, name, beschreibung, preis, mwst_satz, verfuegbar, category_id, sort_order').eq('location_id', locId).order('sort_order', { ascending: true }),
  ]);
  return (
    <div style={{ maxWidth: 1180 }}>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 16, marginBottom: 22 }}>
        <Soon style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 16, background: '#fff', border: '2px dashed #CBD5E1', borderRadius: 16, padding: '18px 22px', cursor: 'pointer', textAlign: 'left' }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span dangerouslySetInnerHTML={{ __html: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>' }} /></div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>Menü hochladen <span style={{ fontSize: 11, fontWeight: 700, color: '#B45309', background: '#FEF3C7', padding: '2px 7px', borderRadius: 6, marginLeft: 6 }}>Bald</span></div><div style={{ fontSize: 13, color: '#64748B' }}>Kategorien, Artikel, Preise & Steuersätze werden automatisch erkannt</div></div>
          <div style={{ display: 'flex', gap: 7 }}><span style={{ fontSize: 12, fontWeight: 700, color: '#047857', background: '#ECFDF5', padding: '5px 10px', borderRadius: 7 }}>Excel</span><span style={{ fontSize: 12, fontWeight: 700, color: '#475569', background: '#F1F5F9', padding: '5px 10px', borderRadius: 7 }}>CSV</span><span style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', background: '#FEF2F2', padding: '5px 10px', borderRadius: 7 }}>PDF</span></div>
        </Soon>
        <Soon style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 22px', border: 'none', borderRadius: 16, background: 'linear-gradient(135deg,#4F46E5,#4338CA)', color: '#fff', fontSize: 14.5, fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 20px rgba(79,70,229,.28)' }}><span dangerouslySetInnerHTML={{ __html: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>' }} />Artikel manuell anlegen</Soon>
      </div>
      <MenuView cats={(cats ?? []) as any[]} items={(items ?? []) as any[]} />
    </div>
  );
}
