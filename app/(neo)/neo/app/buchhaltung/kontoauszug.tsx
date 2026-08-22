'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { saveBankTx, autoMatchBank } from './actions';

type Tx = { id?: string; buchungstag: string | null; betrag: number; richtung: string; verwendungszweck: string | null; gegenpartei: string | null; beleg_id?: string | null; matched_auto?: boolean; import_hash?: string };
const eur = (n: number) => Number(n ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

export function KontoauszugManager({ transactions, unmatchedBelege }: { transactions: Tx[]; unmatchedBelege: number }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [matching, setMatching] = useState(false);
  const [preview, setPreview] = useState<{ txs: Tx[]; name: string } | null>(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const einnahmen = transactions.filter((t) => t.richtung === 'einnahme').reduce((s, t) => s + Number(t.betrag || 0), 0);
  const ausgaben = transactions.filter((t) => t.richtung === 'ausgabe').reduce((s, t) => s + Number(t.betrag || 0), 0);
  const matchedCount = transactions.filter((t) => t.beleg_id).length;
  const unmatchedAusgaben = transactions.filter((t) => t.richtung === 'ausgabe' && !t.beleg_id).length;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setBusy(true); setErr(''); setMsg('');
    try {
      const fd = new FormData(); fd.append('file', f);
      const res = await fetch('/api/buchhaltung/kontoauszug', { method: 'POST', body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Konnte Datei nicht lesen');
      setPreview({ txs: j.transactions, name: f.name });
    } catch (e: any) { setErr(e?.message || 'Fehler'); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  async function doImport() {
    if (!preview) return;
    setBusy(true); setErr('');
    const r = await saveBankTx(preview.txs as any, preview.name);
    setBusy(false);
    if (!r.ok) { setErr(r.error || 'Fehler'); return; }
    setMsg(`${r.inserted} Buchungen importiert${r.dup ? `, ${r.dup} Duplikate übersprungen` : ''}.`);
    setPreview(null); router.refresh();
  }
  async function doMatch() {
    setMatching(true); setErr(''); setMsg('');
    const r = await autoMatchBank();
    setMatching(false);
    if (!r.ok) { setErr(r.error || 'Fehler'); return; }
    setMsg(`${r.matched} Buchungen automatisch einem Beleg zugeordnet.`);
    router.refresh();
  }

  const pEin = preview ? preview.txs.filter((t) => t.richtung === 'einnahme').reduce((s, t) => s + t.betrag, 0) : 0;
  const pAus = preview ? preview.txs.filter((t) => t.richtung === 'ausgabe').reduce((s, t) => s + t.betrag, 0) : 0;

  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 22, marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Kontoauszug & Abgleich <span style={{ color: '#94A3B8', fontWeight: 500 }}>· {transactions.length} Buchungen</span></h3>
          <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>Kontoauszug hochladen (CSV von Sparkasse/Volksbank/N26/… oder CAMT.053-XML) — Ausgaben werden automatisch mit Belegen abgeglichen.</p>
        </div>
        <div style={{ display: 'flex', gap: 9 }}>
          {transactions.length > 0 && <button onClick={doMatch} disabled={matching} style={{ height: 42, padding: '0 15px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', color: '#334155', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>{matching ? 'Gleicht ab…' : '🔗 Auto-Abgleich'}</button>}
          <button onClick={() => fileRef.current?.click()} disabled={busy} style={{ height: 42, padding: '0 18px', borderRadius: 10, border: 'none', background: busy ? '#C7D2FE' : '#4F46E5', color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: busy ? 'default' : 'pointer' }}>{busy ? 'Liest…' : '⬆ Kontoauszug hochladen'}</button>
          <input ref={fileRef} type="file" accept=".csv,.xml,.txt,text/csv,text/xml" onChange={onFile} style={{ display: 'none' }} />
        </div>
      </div>

      {err && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: 10, padding: '9px 13px', fontSize: 13, marginBottom: 12 }}>{err}</div>}
      {msg && <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#047857', borderRadius: 10, padding: '9px 13px', fontSize: 13, marginBottom: 12 }}>{msg}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
        <div style={{ background: '#ECFDF5', borderRadius: 12, padding: '13px 16px' }}><div style={{ fontSize: 12, color: '#047857', fontWeight: 600 }}>Einnahmen (Konto)</div><div style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 20, fontWeight: 700, color: '#047857' }}>{eur(einnahmen)}</div></div>
        <div style={{ background: '#FEF2F2', borderRadius: 12, padding: '13px 16px' }}><div style={{ fontSize: 12, color: '#B91C1C', fontWeight: 600 }}>Ausgaben (Konto)</div><div style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 20, fontWeight: 700, color: '#DC2626' }}>{eur(ausgaben)}</div></div>
        <div style={{ background: unmatchedAusgaben ? '#FFFBEB' : '#F0FDF4', borderRadius: 12, padding: '13px 16px' }}><div style={{ fontSize: 12, color: unmatchedAusgaben ? '#92400E' : '#047857', fontWeight: 600 }}>Beleg-Abgleich</div><div style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 20, fontWeight: 700, color: unmatchedAusgaben ? '#B45309' : '#047857' }}>{matchedCount} ✓ · {unmatchedAusgaben} offen</div></div>
      </div>
      {unmatchedBelege > 0 && <div style={{ fontSize: 12.5, color: '#94A3B8', marginBottom: 12 }}>ℹ {unmatchedBelege} erfasste Belege haben noch keine Konto-Buchung — lade den passenden Kontoauszug hoch.</div>}

      {transactions.length === 0 && <div style={{ padding: '24px', textAlign: 'center', color: '#94A3B8', fontSize: 13.5 }}>Noch kein Kontoauszug importiert.</div>}
      {transactions.slice(0, 40).map((t, i) => (
        <div key={t.id || i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 4px', borderTop: i ? '1px solid #F1F5F9' : 'none' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.richtung === 'einnahme' ? '#10B981' : '#EF4444', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.gegenpartei || t.verwendungszweck || 'Buchung'}</div>
            <div style={{ fontSize: 12, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.buchungstag ? new Date(t.buchungstag).toLocaleDateString('de-DE') : '—'}{t.verwendungszweck && t.gegenpartei ? ` · ${t.verwendungszweck}` : ''}</div>
          </div>
          {t.richtung === 'ausgabe' && (t.beleg_id
            ? <span style={{ fontSize: 11, fontWeight: 700, color: '#047857', background: '#ECFDF5', padding: '3px 8px', borderRadius: 999, flexShrink: 0 }}>Beleg ✓</span>
            : <span style={{ fontSize: 11, fontWeight: 700, color: '#B45309', background: '#FEF3C7', padding: '3px 8px', borderRadius: 999, flexShrink: 0 }}>kein Beleg</span>)}
          <div style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 700, fontSize: 14, color: t.richtung === 'einnahme' ? '#047857' : '#0F172A', width: 95, textAlign: 'right', flexShrink: 0 }}>{t.richtung === 'einnahme' ? '+' : '−'}{eur(t.betrag)}</div>
        </div>
      ))}

      {preview && (
        <div onClick={() => !busy && setPreview(null)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15,23,42,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 480, maxWidth: '100%', background: '#fff', borderRadius: 18, padding: 24 }}>
            <h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 18, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>Import prüfen</h3>
            <p style={{ fontSize: 13, color: '#94A3B8', marginBottom: 16 }}>{preview.name} · {preview.txs.length} Buchungen erkannt</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ background: '#ECFDF5', borderRadius: 10, padding: '11px 14px' }}><div style={{ fontSize: 12, color: '#047857' }}>Einnahmen</div><div style={{ fontWeight: 700, color: '#047857', fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 17 }}>{eur(pEin)}</div></div>
              <div style={{ background: '#FEF2F2', borderRadius: 10, padding: '11px 14px' }}><div style={{ fontSize: 12, color: '#B91C1C' }}>Ausgaben</div><div style={{ fontWeight: 700, color: '#DC2626', fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 17 }}>{eur(pAus)}</div></div>
            </div>
            <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #F1F5F9', borderRadius: 10, padding: 6, marginBottom: 16 }}>
              {preview.txs.slice(0, 60).map((t, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '5px 8px', color: '#475569' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>{t.buchungstag || '—'} · {t.gegenpartei || t.verwendungszweck || 'Buchung'}</span>
                  <span style={{ fontWeight: 700, color: t.richtung === 'einnahme' ? '#047857' : '#DC2626' }}>{t.richtung === 'einnahme' ? '+' : '−'}{eur(t.betrag)}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setPreview(null)} disabled={busy} style={{ flex: 1, height: 46, borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', color: '#475569', fontWeight: 700, cursor: 'pointer' }}>Abbrechen</button>
              <button onClick={doImport} disabled={busy} style={{ flex: 2, height: 46, borderRadius: 10, border: 'none', background: busy ? '#C7D2FE' : '#4F46E5', color: '#fff', fontWeight: 700, cursor: busy ? 'default' : 'pointer' }}>{busy ? 'Importiert…' : `${preview.txs.length} Buchungen importieren`}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
