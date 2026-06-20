'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Loyalty = { enabled?: boolean; target_stamps?: number; reward_title?: string; reward_text?: string };

export function LoyaltyEditor({ tenantId, current }: { tenantId: string; current: Loyalty }) {
  const [enabled, setEnabled] = useState<boolean>(current?.enabled !== false);
  const [threshold, setThreshold] = useState<number>(current?.target_stamps ?? 5);
  const [rewardText, setRewardText] = useState<string>(current?.reward_text ?? '1 Pasta gratis');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const valid = threshold >= 2 && threshold <= 20 && rewardText.trim().length >= 2;
  const title = `Jede ${threshold}. Bestellung`;

  async function save() {
    if (!valid || saving) return;
    setSaving(true); setErr(null);
    const sb = createClient();
    // aktuelle storefront_settings lesen → loyalty mergen → zurückschreiben (kein Clobber)
    const { data, error: readErr } = await sb.from('tenants').select('storefront_settings').eq('id', tenantId).maybeSingle();
    if (readErr) { setErr(readErr.message); setSaving(false); return; }
    const merged = { ...((data?.storefront_settings as any) || {}), loyalty: { enabled, target_stamps: threshold, reward_title: title, reward_text: rewardText.trim() } };
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
