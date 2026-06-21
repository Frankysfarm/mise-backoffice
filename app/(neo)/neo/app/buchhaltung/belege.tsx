'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { saveBeleg } from './actions';

type Beleg = { id: string; datum: string | null; haendler: string | null; betrag_brutto: number; mwst_satz: number; mwst_betrag: number; netto: number; kategorie: string; status: string; beleg_url: string | null };
const KATEGORIEN = ['Wareneinsatz', 'Getränke', 'Personal', 'Miete', 'Energie', 'Marketing', 'Reparatur', 'Büro', 'Sonstiges'];
const KAT_C: Record<string, string> = { Wareneinsatz: '#16A34A', Getränke: '#0891B2', Personal: '#7C3AED', Miete: '#DC2626', Energie: '#D97706', Marketing: '#DB2777', Reparatur: '#64748B', Büro: '#4F46E5', Sonstiges: '#94A3B8' };
const eur = (n: number) => Number(n ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

type Draft = { haendler: string; datum: string | null; betrag_brutto: number; mwst_satz: number; mwst_betrag: number; netto: number; kategorie: string; confidence: number; beleg_url: string | null };

export function BelegeManager({ belege, monat }: { belege: Beleg[]; monat: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const expense = belege.reduce((s, b) => s + Number(b.betrag_brutto || 0), 0);
  const expVat = belege.reduce((s, b) => s + Number(b.mwst_betrag || 0), 0);
  const byKat = new Map<string, number>();
  for (const b of belege) byKat.set(b.kategorie, (byKat.get(b.kategorie) || 0) + Number(b.betrag_brutto || 0));
  const kats = [...byKat.entries()].sort((a, b) => b[1] - a[1]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true); setErr('');
    try {
      const fd = new FormData(); fd.append('file', f);
      const res = await fetch('/api/buchhaltung/beleg-extract', { method: 'POST', body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'KI-Auslesen fehlgeschlagen');
      setDraft(j);
    } catch (e: any) { setErr(e?.message || 'Fehler'); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  function setD(patch: Partial<Draft>) {
    setDraft((d) => {
      if (!d) return d;
      const next = { ...d, ...patch };
      const satz = Number(next.mwst_satz) || 0;
      next.mwst_betrag = satz > 0 ? Math.round((next.betrag_brutto - next.betrag_brutto / (1 + satz / 100)) * 100) / 100 : 0;
      next.netto = Math.round((next.betrag_brutto - next.mwst_betrag) * 100) / 100;
      return next;
    });
  }

  async function save() {
    if (!draft) return;
    setSaving(true); setErr('');
    const r = await saveBeleg({
      datum: draft.datum, haendler: draft.haendler, betrag_brutto: draft.betrag_brutto,
      mwst_satz: draft.mwst_satz, mwst_betrag: draft.mwst_betrag, netto: draft.netto,
      kategorie: draft.kategorie, beleg_url: draft.beleg_url, ki_confidence: draft.confidence,
    });
    setSaving(false);
    if (!r.ok) { setErr(r.error || 'Fehler'); return; }
    setDraft(null); router.refresh();
  }

  function exportCsv() {
    const head = ['Datum', 'Händler', 'Kategorie', 'Brutto', 'MwSt-Satz', 'MwSt-Betrag', 'Netto'];
    const rows = belege.map((b) => [b.datum ?? '', (b.haendler ?? '').replace(/;/g, ','), b.kategorie, String(b.betrag_brutto).replace('.', ','), `${b.mwst_satz}%`, String(b.mwst_betrag).replace('.', ','), String(b.netto).replace('.', ',')]);
    const csv = [head, ...rows].map((r) => r.join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `belege-${monat}.csv`; a.click();
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 22, marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Belege & Ausgaben <span style={{ color: '#94A3B8', fontWeight: 500 }}>· {belege.length}</span></h3>
          <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>Beleg fotografieren — die KI liest Händler, Betrag, MwSt & Kategorie automatisch aus.</p>
        </div>
        <div style={{ display: 'flex', gap: 9 }}>
          {belege.length > 0 && <button onClick={exportCsv} style={{ height: 42, padding: '0 15px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', color: '#334155', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>CSV-Export</button>}
          <button onClick={() => setDraft({ haendler: '', datum: null, betrag_brutto: 0, mwst_satz: 19, mwst_betrag: 0, netto: 0, kategorie: 'Wareneinsatz', confidence: 1, beleg_url: null })} style={{ height: 42, padding: '0 15px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', color: '#334155', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>Manuell</button>
          <button onClick={() => fileRef.current?.click()} disabled={busy} style={{ height: 42, padding: '0 18px', borderRadius: 10, border: 'none', background: busy ? '#C7D2FE' : '#4F46E5', color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: busy ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            {busy ? 'KI liest…' : '📷 Beleg scannen'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} style={{ display: 'none' }} />
        </div>
      </div>

      {err && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: 10, padding: '9px 13px', fontSize: 13, marginBottom: 12 }}>{err}</div>}

      {/* Ausgaben-Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 16 }}>
        <div style={{ background: '#FEF2F2', borderRadius: 12, padding: '13px 16px' }}><div style={{ fontSize: 12, color: '#B91C1C', fontWeight: 600 }}>Ausgaben {monat}</div><div style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 22, fontWeight: 700, color: '#DC2626' }}>{eur(expense)}</div></div>
        <div style={{ background: '#FFFBEB', borderRadius: 12, padding: '13px 16px' }}><div style={{ fontSize: 12, color: '#92400E', fontWeight: 600 }}>enthaltene Vorsteuer</div><div style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 22, fontWeight: 700, color: '#B45309' }}>{eur(expVat)}</div></div>
      </div>
      {kats.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 16 }}>
          {kats.map(([k, v]) => <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: '#334155', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 999, padding: '5px 11px' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: KAT_C[k] || '#94A3B8' }} />{k} · {eur(v)}</span>)}
        </div>
      )}

      {/* Belege-Liste */}
      {belege.length === 0 && <div style={{ padding: '24px', textAlign: 'center', color: '#94A3B8', fontSize: 13.5 }}>Noch keine Belege erfasst. Scanne deinen ersten Kassenbon oben.</div>}
      {belege.map((b, i) => (
        <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 4px', borderTop: i ? '1px solid #F1F5F9' : 'none' }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: KAT_C[b.kategorie] || '#94A3B8', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.haendler || 'Beleg'}</div>
            <div style={{ fontSize: 12, color: '#94A3B8' }}>{b.datum ? new Date(b.datum).toLocaleDateString('de-DE') : '—'} · {b.kategorie} · {b.mwst_satz}% MwSt</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 700, fontSize: 14.5, color: '#0F172A' }}>{eur(b.betrag_brutto)}</div>
            <div style={{ fontSize: 11.5, color: '#94A3B8' }}>VSt {eur(b.mwst_betrag)}</div>
          </div>
        </div>
      ))}

      {/* Review-Modal */}
      {draft && (
        <div onClick={() => !saving && setDraft(null)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15,23,42,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 460, maxWidth: '100%', background: '#fff', borderRadius: 18, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
              <h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 18, fontWeight: 700, color: '#0F172A' }}>Beleg prüfen</h3>
              <span style={{ fontSize: 11, fontWeight: 700, color: draft.confidence >= 0.7 ? '#047857' : '#B45309', background: draft.confidence >= 0.7 ? '#ECFDF5' : '#FEF3C7', padding: '3px 8px', borderRadius: 999 }}>KI {Math.round(draft.confidence * 100)}%</span>
            </div>
            <p style={{ fontSize: 12.5, color: '#94A3B8', marginBottom: 16 }}>Von der KI ausgelesen — bei Bedarf korrigieren, dann speichern.</p>
            {(() => { const L: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 5, display: 'block' }; const I: React.CSSProperties = { width: '100%', height: 42, border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '0 12px', fontSize: 14, color: '#0F172A', marginBottom: 12 }; return (<>
              <label style={L}>Händler / Lieferant</label>
              <input value={draft.haendler} onChange={(e) => setD({ haendler: e.target.value })} style={I} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={L}>Datum</label><input type="date" value={draft.datum ?? ''} onChange={(e) => setD({ datum: e.target.value || null })} style={I} /></div>
                <div><label style={L}>Brutto (€)</label><input value={String(draft.betrag_brutto)} onChange={(e) => setD({ betrag_brutto: Number(String(e.target.value).replace(',', '.')) || 0 })} inputMode="decimal" style={I} /></div>
              </div>
              <label style={L}>MwSt-Satz</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {[19, 7, 0].map((v) => <button key={v} onClick={() => setD({ mwst_satz: v })} style={{ flex: 1, height: 40, borderRadius: 10, border: `1.5px solid ${draft.mwst_satz === v ? '#4F46E5' : '#E2E8F0'}`, background: draft.mwst_satz === v ? '#EEF2FF' : '#fff', color: draft.mwst_satz === v ? '#4338CA' : '#475569', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>{v}%</button>)}
              </div>
              <label style={L}>Kategorie</label>
              <select value={draft.kategorie} onChange={(e) => setD({ kategorie: e.target.value })} style={{ ...I, padding: '0 10px' }}>{KATEGORIEN.map((k) => <option key={k} value={k}>{k}</option>)}</select>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#64748B', padding: '6px 2px 14px' }}><span>Netto {eur(draft.netto)}</span><span>enthaltene MwSt {eur(draft.mwst_betrag)}</span></div>
            </>); })()}
            {err && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: 10, padding: '8px 12px', fontSize: 13, marginBottom: 12 }}>{err}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDraft(null)} disabled={saving} style={{ flex: 1, height: 46, borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', color: '#475569', fontWeight: 700, cursor: 'pointer' }}>Verwerfen</button>
              <button onClick={save} disabled={saving} style={{ flex: 2, height: 46, borderRadius: 10, border: 'none', background: saving ? '#C7D2FE' : '#4F46E5', color: '#fff', fontWeight: 700, cursor: saving ? 'default' : 'pointer' }}>{saving ? 'Speichert…' : 'Beleg speichern'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
