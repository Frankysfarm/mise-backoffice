'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { createVoucher, toggleVoucher, deleteVoucher } from '@/app/(admin)/vouchers/actions';

type Loyalty = { enabled?: boolean; target_stamps?: number; reward_title?: string; reward_text?: string; reward_product_ids?: string[]; reward_min_order?: number };
type RewardProduct = { id: string; name: string; preis: number };

export function LoyaltyEditor({ tenantId, current, products = [] }: { tenantId: string; current: Loyalty; products?: RewardProduct[] }) {
  const [enabled, setEnabled] = useState<boolean>(current?.enabled !== false);
  const [threshold, setThreshold] = useState<number>(current?.target_stamps ?? 5);
  const [rewardText, setRewardText] = useState<string>(current?.reward_text ?? '1 Pasta gratis');
  const [rewardIds, setRewardIds] = useState<string[]>(Array.isArray(current?.reward_product_ids) ? current!.reward_product_ids! : []);
  const [minOrder, setMinOrder] = useState<string>(current?.reward_min_order ? String(current.reward_min_order) : '');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const valid = threshold >= 2 && threshold <= 20 && rewardText.trim().length >= 2;
  const title = `Jede ${threshold}. Bestellung`;
  const toggleProduct = (id: string) => setRewardIds((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));
  const shown = products.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()));

  async function save() {
    if (!valid || saving) return;
    setSaving(true); setErr(null);
    const sb = createClient();
    // aktuelle storefront_settings lesen → loyalty mergen → zurückschreiben (kein Clobber)
    const { data, error: readErr } = await sb.from('tenants').select('storefront_settings').eq('id', tenantId).maybeSingle();
    if (readErr) { setErr(readErr.message); setSaving(false); return; }
    const mo = Number(String(minOrder).replace(',', '.'));
    const merged = { ...((data?.storefront_settings as any) || {}), loyalty: { enabled, target_stamps: threshold, reward_title: title, reward_text: rewardText.trim(), reward_product_ids: rewardIds, reward_min_order: minOrder && mo > 0 ? mo : 0 } };
    const { error } = await sb.from('tenants').update({ storefront_settings: merged }).eq('id', tenantId);
    setSaving(false);
    if (error) { setErr(error.message); } else { setSavedAt(Date.now()); }
  }

  const L: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6, display: 'block' };
  const I: React.CSSProperties = { height: 42, border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '0 12px', fontSize: 14, color: '#0F172A', width: '100%' };

  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19 }}>⭐</div>
          <h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Treueprogramm</h3>
        </div>
        {/* enabled toggle */}
        <button onClick={() => setEnabled((v) => !v)} title={enabled ? 'Aktiv — tippen zum Deaktivieren' : 'Inaktiv'} style={{ width: 46, height: 26, borderRadius: 999, background: enabled ? '#10B981' : '#CBD5E1', position: 'relative', cursor: 'pointer', border: 'none', flexShrink: 0 }}>
          <span style={{ position: 'absolute', top: 3, left: enabled ? 23 : 3, width: 20, height: 20, borderRadius: 999, background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
        </button>
      </div>

      <p style={{ fontSize: 13, color: '#64748B', marginBottom: 14 }}>Du entscheidest: ab welcher Bestellung gibt es welche Belohnung. Wirkt sofort im Shop.</p>

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 12 }}>
        <div style={{ width: 130 }}>
          <label style={L}>Jede … Bestellung</label>
          <input type="number" min={2} max={20} value={threshold} onChange={(e) => setThreshold(Math.max(2, Math.min(20, parseInt(e.target.value) || 2)))} style={I} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={L}>Belohnung</label>
          <input value={rewardText} onChange={(e) => setRewardText(e.target.value)} placeholder="z. B. 1 Pasta gratis" style={I} />
        </div>
      </div>

      {/* Gratis-Produkte zur Einlösung */}
      <div style={{ marginBottom: 14 }}>
        <label style={L}>Gratis-Produkte zur Auswahl <span style={{ color: '#94A3B8', fontWeight: 500 }}>· {rewardIds.length} gewählt</span></label>
        <p style={{ fontSize: 12, color: '#94A3B8', margin: '-2px 0 8px' }}>Aus diesen Produkten wählt der Kunde sein Gratis-Produkt, sobald er die {threshold} Bestellungen erreicht hat. Leer = alle Produkte erlaubt.</p>
        {products.length > 8 && <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Produkt suchen…" style={{ ...I, height: 38, marginBottom: 8 }} />}
        <div style={{ maxHeight: 196, overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: 10, padding: 6 }}>
          {products.length === 0 && <div style={{ padding: 14, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>Noch keine Produkte im Menü.</div>}
          {shown.map((p) => {
            const on = rewardIds.includes(p.id);
            return (
              <button key={p.id} onClick={() => toggleProduct(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 8, border: 'none', background: on ? '#EEF2FF' : 'transparent', cursor: 'pointer', marginBottom: 2 }}>
                <span style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${on ? '#4F46E5' : '#CBD5E1'}`, background: on ? '#4F46E5' : '#fff', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>{on ? '✓' : ''}</span>
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: '#0F172A', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                <span style={{ fontSize: 12.5, color: '#94A3B8', flexShrink: 0 }}>{eur(p.preis)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mindestbestellwert für Einlösung (Anti-Missbrauch, optional) */}
      <div style={{ marginBottom: 14 }}>
        <label style={L}>Mindestbestellwert für Einlösung <span style={{ color: '#94A3B8', fontWeight: 500 }}>· optional</span></label>
        <input value={minOrder} onChange={(e) => setMinOrder(e.target.value)} inputMode="decimal" placeholder="z. B. 15 (leer = kein Mindestwert)" style={I} />
        <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 6 }}>Verhindert, dass jemand nur das Gratis-Produkt bestellt. Bezieht sich auf den Warenkorb ohne das Gratis-Produkt.</p>
      </div>

      {/* Live-Vorschau */}
      <div style={{ background: enabled ? '#F8FAFC' : '#FEF2F2', border: `1px solid ${enabled ? '#E2E8F0' : '#FECACA'}`, borderRadius: 12, padding: '12px 16px', marginBottom: 14 }}>
        <div style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 15, fontWeight: 700, color: enabled ? '#0F172A' : '#B91C1C' }}>
          {enabled ? `${title} = ${rewardText || '…'}` : 'Treueprogramm deaktiviert'}
        </div>
      </div>

      {err && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: 10, padding: '8px 12px', fontSize: 13, marginBottom: 10 }}>Konnte nicht speichern: {err}</div>}

      <button onClick={save} disabled={!valid || saving} style={{ width: '100%', height: 44, borderRadius: 10, border: 'none', background: valid && !saving ? '#4F46E5' : '#CBD5E1', color: '#fff', fontWeight: 700, fontSize: 14, cursor: valid && !saving ? 'pointer' : 'not-allowed', boxShadow: valid && !saving ? '0 8px 20px rgba(79,70,229,.25)' : 'none' }}>
        {saving ? 'Speichert…' : savedAt ? '✓ Gespeichert' : 'Speichern'}
      </button>
    </div>
  );
}

/* ============================ RABATTCODES (Gutscheine) ============================ */
type Voucher = { id: string; code: string; typ: 'prozent' | 'fix' | 'gratis_lieferung'; wert: number; min_bestellwert?: number | null; beschreibung?: string | null; gueltig_bis?: string | null; aktiv: boolean; nutzungen_aktuell?: number | null; nutzungen_max?: number | null };
const eur = (n: number) => Number(n ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €';
function voucherValue(v: Voucher) { return v.typ === 'prozent' ? `${v.wert} %` : v.typ === 'gratis_lieferung' ? 'Gratis Lieferung' : eur(v.wert); }

export function VoucherManager({ vouchers }: { vouchers: Voucher[] }) {
  const router = useRouter();
  const [list, setList] = useState<Voucher[]>(vouchers);
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function onToggle(v: Voucher) {
    setBusy(v.id);
    setList((xs) => xs.map((x) => (x.id === v.id ? { ...x, aktiv: !x.aktiv } : x)));
    await toggleVoucher(v.id, !v.aktiv);
    setBusy(null);
  }
  async function onDelete(v: Voucher) {
    if (!confirm(`Code „${v.code}" wirklich löschen?`)) return;
    setBusy(v.id);
    setList((xs) => xs.filter((x) => x.id !== v.id));
    await deleteVoucher(v.id);
    setBusy(null);
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden', marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid #F1F5F9' }}>
        <h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Rabattcodes <span style={{ color: '#94A3B8', fontWeight: 500 }}>· {list.length}</span></h3>
        <button onClick={() => setModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, height: 38, padding: '0 14px', border: 'none', borderRadius: 10, background: '#0F172A', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>+ Code erstellen</button>
      </div>
      {list.length === 0 && <div style={{ padding: '24px 22px', textAlign: 'center', color: '#94A3B8', fontSize: 13.5 }}>Noch keine Rabattcodes angelegt.</div>}
      {list.map((v) => (
        <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 22px', borderTop: '1px solid #F8FAFC', opacity: v.aktiv ? 1 : 0.55 }}>
          <span style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 700, fontSize: 14, color: '#4338CA', background: '#EEF2FF', padding: '6px 12px', borderRadius: 8, letterSpacing: '.5px' }}>{v.code}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{voucherValue(v)} Rabatt{v.min_bestellwert ? ` · ab ${eur(v.min_bestellwert)}` : ''}</div>
            {v.beschreibung && <div style={{ fontSize: 12.5, color: '#94A3B8', marginTop: 2 }}>{v.beschreibung}</div>}
          </div>
          {v.nutzungen_max != null && <span style={{ fontSize: 12, color: '#94A3B8' }}>{v.nutzungen_aktuell ?? 0}/{v.nutzungen_max}</span>}
          <button onClick={() => onToggle(v)} disabled={busy === v.id} title={v.aktiv ? 'Aktiv' : 'Inaktiv'} style={{ width: 46, height: 26, borderRadius: 999, background: v.aktiv ? '#10B981' : '#CBD5E1', position: 'relative', cursor: 'pointer', border: 'none', flexShrink: 0 }}>
            <span style={{ position: 'absolute', top: 3, left: v.aktiv ? 23 : 3, width: 20, height: 20, borderRadius: 999, background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
          </button>
          <button onClick={() => onDelete(v)} disabled={busy === v.id} title="Löschen" style={{ width: 34, height: 34, border: '1px solid #FECACA', borderRadius: 9, background: '#fff', cursor: 'pointer', color: '#DC2626', fontSize: 16, flexShrink: 0 }}>×</button>
        </div>
      ))}
      {modal && <VoucherModal onClose={() => setModal(false)} onSaved={() => { setModal(false); router.refresh(); }} />}
    </div>
  );
}

function VoucherModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [code, setCode] = useState('');
  const [typ, setTyp] = useState<'prozent' | 'fix' | 'gratis_lieferung'>('prozent');
  const [wert, setWert] = useState('10');
  const [minBest, setMinBest] = useState('');
  const [desc, setDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const needsWert = typ !== 'gratis_lieferung';
  const valid = code.trim().length >= 3 && (!needsWert || Number(String(wert).replace(',', '.')) > 0);

  async function save() {
    if (!valid) return; setSaving(true); setErr('');
    const r = await createVoucher({ code: code.trim(), typ, wert: needsWert ? Number(String(wert).replace(',', '.')) : 0, min_bestellwert: minBest ? Number(String(minBest).replace(',', '.')) : 0, beschreibung: desc.trim() || undefined });
    if (r.ok) onSaved(); else { setErr(r.error || 'Fehler'); setSaving(false); }
  }
  const L: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6, display: 'block' };
  const I: React.CSSProperties = { width: '100%', height: 42, border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '0 13px', fontSize: 14, color: '#0F172A', marginBottom: 14 };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15,23,42,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 440, maxWidth: '100%', background: '#fff', borderRadius: 18, padding: 24 }}>
        <h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 18, fontWeight: 700, color: '#0F172A', marginBottom: 16 }}>Rabattcode erstellen</h3>
        <label style={L}>Code</label><input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="z. B. WILLKOMMEN10" style={{ ...I, fontFamily: "'Space Grotesk', system-ui, sans-serif", letterSpacing: '.5px' }} />
        <label style={L}>Art</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {([['prozent', '% Prozent'], ['fix', '€ Fix'], ['gratis_lieferung', 'Gratis Lieferung']] as const).map(([v, lbl]) => (
            <button key={v} onClick={() => setTyp(v)} style={{ flex: 1, height: 40, borderRadius: 10, border: `1.5px solid ${typ === v ? '#4F46E5' : '#E2E8F0'}`, background: typ === v ? '#EEF2FF' : '#fff', color: typ === v ? '#4338CA' : '#475569', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>{lbl}</button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {needsWert && <div><label style={L}>{typ === 'prozent' ? 'Prozent (%)' : 'Betrag (€)'}</label><input value={wert} onChange={(e) => setWert(e.target.value)} inputMode="decimal" style={I} /></div>}
          <div><label style={L}>Mindestbestellwert (€, optional)</label><input value={minBest} onChange={(e) => setMinBest(e.target.value)} placeholder="0" inputMode="decimal" style={I} /></div>
        </div>
        <label style={L}>Beschreibung (optional)</label><input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="z. B. 10 % für Neukunden" style={I} />
        {err && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: 10, padding: '8px 12px', fontSize: 13, marginBottom: 12 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, height: 44, borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', color: '#475569', fontWeight: 700, cursor: 'pointer' }}>Abbrechen</button>
          <button onClick={save} disabled={!valid || saving} style={{ flex: 2, height: 44, borderRadius: 10, border: 'none', background: valid && !saving ? '#4F46E5' : '#CBD5E1', color: '#fff', fontWeight: 700, cursor: valid && !saving ? 'pointer' : 'not-allowed' }}>{saving ? 'Speichert…' : 'Erstellen'}</button>
        </div>
      </div>
    </div>
  );
}
