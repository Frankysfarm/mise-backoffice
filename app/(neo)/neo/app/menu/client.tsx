'use client';
import { useState } from 'react';
const soon = () => alert('Bald verfügbar — diese Funktion kommt in Kürze.');
export function Soon({ children, style, primary }: { children: React.ReactNode; style?: any; primary?: boolean }) {
  return <button onClick={soon} title="Bald verfügbar" style={{ ...style, position: 'relative', opacity: 0.92 }}>{children}</button>;
}
const PBG = ['#FEF3C7', '#ECFDF5', '#EEF2FF', '#DCFCE7', '#FCE7F3', '#EFF6FF'];
const eur = (n: number) => Number(n ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €';
export function MenuView({ cats, items }: { cats: any[]; items: any[] }) {
  const groups = cats.map((c) => ({ ...c, items: items.filter((i) => i.category_id === c.id) }));
  const withoutCat = items.filter((i) => !i.category_id || !cats.find((c) => c.id === i.category_id));
  if (withoutCat.length) groups.push({ id: null, name: 'Ohne Kategorie', items: withoutCat });
  const [sel, setSel] = useState<string | null>(groups[0]?.id ?? null);
  const active = groups.find((g) => g.id === sel) || groups[0];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20 }}>
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', letterSpacing: '.3px', padding: '8px 10px 10px' }}>KATEGORIEN</div>
        {groups.map((c, i) => { const on = c.id === (active?.id ?? null); return (
          <div key={String(c.id)} onClick={() => setSel(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 11px', borderRadius: 10, marginBottom: 2, cursor: 'pointer', fontSize: 14, fontWeight: 600, background: on ? '#EEF2FF' : 'transparent', color: on ? '#4338CA' : '#475569' }}>
            <span style={{ width: 26, height: 26, borderRadius: 7, background: PBG[i % PBG.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{(c.name || '?').slice(0, 1).toUpperCase()}</span>
            <div style={{ flex: 1 }}>{c.name}</div><span style={{ fontSize: 11.5, color: '#94A3B8', fontWeight: 600 }}>{c.items.length}</span>
          </div>
        ); })}
        <Soon style={{ width: '100%', marginTop: 8, height: 40, border: '1.5px dashed #CBD5E1', borderRadius: 10, background: 'transparent', color: '#64748B', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>+ Kategorie</Soon>
      </div>
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px', borderBottom: '1px solid #F1F5F9' }}><h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: '#0F172A' }}>{active?.name || 'Artikel'}</h3><span style={{ fontSize: 13, color: '#94A3B8' }}>Steuersatz pro Artikel gespeichert</span></div>
        {(active?.items ?? []).length === 0 && <div style={{ padding: '28px 22px', color: '#94A3B8', fontSize: 13 }}>Keine Artikel in dieser Kategorie.</div>}
        {(active?.items ?? []).map((it: any, idx: number) => { const m = it.mwst_satz != null ? Math.round(Number(it.mwst_satz)) : 7; return (
          <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 22px', borderBottom: '1px solid #F8FAFC' }}>
            <div style={{ width: 48, height: 48, borderRadius: 11, background: PBG[idx % PBG.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#0F172A', flexShrink: 0 }}>{(it.name || '?').slice(0, 1).toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><span style={{ fontSize: 14.5, fontWeight: 700, color: '#0F172A' }}>{it.name}</span><span style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 11, fontWeight: 600, color: '#94A3B8', background: '#F1F5F9', padding: '2px 7px', borderRadius: 6 }}>ART-{String(1001 + idx)}</span>{!it.verfuegbar && <span style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', background: '#FEF2F2', padding: '2px 7px', borderRadius: 6 }}>Ausverkauft</span>}</div>{it.beschreibung && <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 460 }}>{it.beschreibung}</div>}</div>
            <span style={{ background: m >= 19 ? '#EFF6FF' : '#ECFDF5', color: m >= 19 ? '#1D4ED8' : '#047857', fontSize: 12, fontWeight: 700, padding: '5px 10px', borderRadius: 8 }}>{m}% USt</span>
            <span style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 700, fontSize: 15, color: '#0F172A', width: 70, textAlign: 'right' }}>{eur(it.preis)}</span>
            <Soon style={{ width: 34, height: 34, border: '1px solid #E2E8F0', borderRadius: 9, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span dangerouslySetInnerHTML={{ __html: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4z"/></svg>' }} /></Soon>
          </div>
        ); })}
      </div>
    </div>
  );
}
