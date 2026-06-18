'use client';
import { useState } from 'react';
import { advanceOrder, rejectOrder } from './actions';
const eur = (n: number) => Number(n ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €';
const COLS = [
  { title: 'Neu', dot: '#F59E0B', match: ['neu', 'bestätigt'], next: 'in_zubereitung', btn: 'Annehmen', btnBg: '#4F46E5', btnColor: '#fff', canReject: true },
  { title: 'In Vorbereitung', dot: '#4F46E5', match: ['in_zubereitung'], next: 'fertig', btn: 'Fertig', btnBg: '#12B85C', btnColor: '#fff', canReject: false },
  { title: 'Bereit', dot: '#10B981', match: ['fertig'], next: 'unterwegs', btn: 'An Fahrer', btnBg: '#1D4ED8', btnColor: '#fff', canReject: false },
  { title: 'Unterwegs', dot: '#1D4ED8', match: ['unterwegs'], next: 'geliefert', btn: 'Geliefert', btnBg: '#0F172A', btnColor: '#fff', canReject: false },
];
export function CopyBtn({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return <button onClick={() => { navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }); }} style={{ height: 40, padding: '0 16px', border: '1px solid rgba(255,255,255,.2)', borderRadius: 10, background: 'rgba(255,255,255,.08)', color: '#E0E7FF', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>{copied ? 'Kopiert ✓' : 'Link kopieren'}</button>;
}
export function Kanban({ orders }: { orders: any[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const act = async (fn: () => Promise<void>, id: string) => { setBusy(id); try { await fn(); } catch (e: any) { alert('Fehler: ' + (e?.message || e)); } finally { setBusy(null); } };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, alignItems: 'start' }}>
      {COLS.map((col) => {
        const cards = orders.filter((o) => col.match.includes(o.status));
        return (
          <div key={col.title} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 14, padding: 12, minHeight: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: col.dot }} /><span style={{ fontSize: 14, fontWeight: 700, color: '#334155' }}>{col.title}</span></div>
              <span style={{ background: '#fff', border: '1px solid #E2E8F0', fontSize: 12, fontWeight: 700, color: '#64748B', borderRadius: 999, minWidth: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}>{cards.length}</span>
            </div>
            {cards.map((o) => {
              const liefer = o.typ === 'lieferung';
              const paid = !!o.bezahlt;
              return (
                <div key={o.id} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 13, marginBottom: 10, boxShadow: '0 1px 2px rgba(15,23,42,.04)', opacity: busy === o.id ? .5 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
                    <span style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 700, fontSize: 13, color: '#0F172A' }}>#{String(o.bestellnummer || '').slice(-4) || '----'}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: liefer ? '#1D4ED8' : '#047857', background: liefer ? '#EFF6FF' : '#ECFDF5', borderRadius: 6, padding: '2px 7px' }}>{liefer ? 'Lieferung' : 'Abholung'}</span>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    {(o.items ?? []).slice(0, 4).map((li: any, i: number) => (<div key={i} style={{ display: 'flex', gap: 7, fontSize: 13, color: '#475569', marginBottom: 2 }}><span style={{ fontWeight: 700, color: '#4F46E5' }}>{li.menge}×</span><span>{li.name}</span></div>))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 9, borderTop: '1px solid #F1F5F9', marginBottom: 11 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: paid ? '#10B981' : '#F59E0B' }} /><span style={{ fontSize: 12, color: '#64748B' }}>{paid ? 'Bezahlt' : 'Offen'}</span></div>
                    <span style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 700, fontSize: 14, color: '#0F172A' }}>{eur(o.gesamtbetrag)}</span>
                  </div>
                  {o.kunde_name && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, fontSize: 12, color: '#94A3B8' }}><span>{o.kunde_name}</span></div>}
                  <div style={{ display: 'flex', gap: 7 }}>
                    {col.canReject && <button disabled={busy === o.id} onClick={() => act(() => rejectOrder(o.id), o.id)} style={{ width: 38, height: 36, border: '1px solid #FECACA', background: '#FEF2F2', borderRadius: 9, color: '#DC2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span dangerouslySetInnerHTML={{ __html: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>' }} /></button>}
                    <button disabled={busy === o.id} onClick={() => act(() => advanceOrder(o.id, col.next), o.id)} style={{ flex: 1, height: 36, border: 'none', borderRadius: 9, background: col.btnBg, color: col.btnColor, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{col.btn}</button>
                  </div>
                </div>
              );
            })}
            {cards.length === 0 && <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: '#CBD5E1' }}>Keine Bestellungen</div>}
          </div>
        );
      })}
    </div>
  );
}
