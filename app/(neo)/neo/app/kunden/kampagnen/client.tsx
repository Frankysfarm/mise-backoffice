'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type Campaign = { id: string; name: string; betreff: string; status: string; audience_typ: string; versendet_count?: number | null; created_at: string };
type Voucher = { id: string; code: string; typ: string; wert: number; beschreibung?: string | null };
type Counts = { all_customers: number; last_30d: number; voucher_unused: number };

const AUDIENCES: { id: keyof Counts; label: string; desc: string }[] = [
  { id: 'all_customers', label: 'Alle Bestandskunden', desc: 'Jeder mit E-Mail + Marketing-Opt-in' },
  { id: 'last_30d', label: 'Aktiv (30 Tage)', desc: 'Hat in den letzten 30 Tagen bestellt' },
  { id: 'voucher_unused', label: 'Gutschein offen', desc: 'Gutschein erhalten, noch nicht eingelöst' },
];
const STATUS_C: Record<string, { c: string; b: string; t: string }> = {
  entwurf: { c: '#64748B', b: '#F1F5F9', t: 'Entwurf' },
  versendet: { c: '#047857', b: '#ECFDF5', t: 'Versendet' },
  sendet: { c: '#B45309', b: '#FEF3C7', t: 'Wird gesendet' },
  fehler: { c: '#DC2626', b: '#FEF2F2', t: 'Fehler' },
};

function bodyToHtml(text: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const paras = text.trim().split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px;line-height:1.6">${esc(p).replace(/\n/g, '<br/>')}</p>`).join('');
  return `<div style="font-family:system-ui,sans-serif;font-size:15px;color:#1f2937">${paras}</div>`;
}

export function KampagnenView({ resendReady, campaigns, vouchers, counts }: { resendReady: boolean; campaigns: Campaign[]; vouchers: Voucher[]; counts: Counts }) {
  const [composer, setComposer] = useState(false);
  return (
    <>
      {!resendReady && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: '14px 16px', marginBottom: 18 }}>
          <span style={{ fontSize: 18 }}>✉️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: '#92400E', fontSize: 14 }}>Erst E-Mail-Versand verbinden</div>
            <div style={{ fontSize: 13, color: '#B45309', marginTop: 2 }}>Zum Versenden brauchst du einen Resend-Account mit verifizierter Absender-Domain. Du kannst Kampagnen trotzdem schon als Entwurf vorbereiten.</div>
            <Link href="/settings/email" style={{ display: 'inline-block', marginTop: 9, background: '#92400E', color: '#fff', padding: '7px 14px', borderRadius: 9, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>E-Mail-Versand einrichten →</Link>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 18, fontWeight: 700, color: '#0F172A' }}>Kampagnen</h3>
          <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>{counts.all_customers} Empfänger · {campaigns.length} Kampagnen</p>
        </div>
        <button onClick={() => setComposer(true)} style={{ height: 42, padding: '0 20px', borderRadius: 11, border: 'none', background: '#4F46E5', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 8px 20px rgba(79,70,229,.25)' }}>+ Neue Kampagne</button>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden' }}>
        {campaigns.length === 0 && <div style={{ padding: '28px 22px', color: '#94A3B8', fontSize: 13.5, textAlign: 'center' }}>Noch keine Kampagnen. Erstelle deine erste, um Stammkunden mit Angeboten zurückzuholen.</div>}
        {campaigns.map((c, i) => { const s = STATUS_C[c.status] ?? STATUS_C.entwurf; const aud = AUDIENCES.find((a) => a.id === c.audience_typ as any)?.label ?? c.audience_typ; return (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '15px 22px', borderTop: i ? '1px solid #F1F5F9' : 'none' }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 17 }}>✉️</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name || c.betreff || 'Kampagne'}</div>
              <div style={{ fontSize: 12.5, color: '#94A3B8', marginTop: 2 }}>{aud}{c.versendet_count ? ` · ${c.versendet_count} versendet` : ''}</div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: s.c, background: s.b, padding: '4px 10px', borderRadius: 999 }}>{s.t}</span>
          </div>
        ); })}
      </div>

      {composer && <Composer resendReady={resendReady} vouchers={vouchers} counts={counts} onClose={() => setComposer(false)} />}
    </>
  );
}

function Composer({ resendReady, vouchers, counts, onClose }: { resendReady: boolean; vouchers: Voucher[]; counts: Counts; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [betreff, setBetreff] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<keyof Counts>('all_customers');
  const [voucherCode, setVoucherCode] = useState('');
  const [pending, start] = useTransition();
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const audCount = counts[audience] ?? 0;
  const valid = name.trim().length >= 2 && betreff.trim().length >= 2 && body.trim().length >= 5;

  async function createDraft(): Promise<string | null> {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { setErr('Nicht eingeloggt'); return null; }
    const { data: emp } = await sb.from('employees').select('id, tenant_id').eq('auth_user_id', user.id).maybeSingle();
    if (!emp?.tenant_id) { setErr('Nicht autorisiert'); return null; }
    const { data: c, error } = await sb.from('email_campaigns').insert({
      tenant_id: emp.tenant_id, name: name.trim(), betreff: betreff.trim(), preheader: null,
      body_html: bodyToHtml(body), audience_typ: audience, voucher_code: voucherCode || null,
      cta_label: voucherCode ? 'Jetzt einlösen' : 'Zum Shop', status: 'entwurf', created_by: emp.id,
    }).select('id').single();
    if (error || !c) { setErr(error?.message ?? 'Konnte nicht speichern'); return null; }
    return c.id as string;
  }

  function saveDraft() {
    setErr(''); setOk('');
    start(async () => { const id = await createDraft(); if (id) { setOk('Als Entwurf gespeichert.'); setTimeout(() => { onClose(); router.refresh(); }, 800); } });
  }
  async function sendNow() {
    setErr(''); setOk('');
    if (!resendReady) { setErr('Bitte zuerst E-Mail-Versand (Resend) verbinden.'); return; }
    if (!confirm(`Kampagne jetzt an ${audCount} Empfänger senden?`)) return;
    setSending(true);
    const id = await createDraft();
    if (!id) { setSending(false); return; }
    try {
      const res = await fetch(`/api/campaigns/${id}/send`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(json.error ?? 'Versand fehlgeschlagen'); setSending(false); return; }
      setOk(`An ${json.sent ?? audCount} Empfänger gesendet.`);
      setTimeout(() => { onClose(); router.refresh(); }, 1000);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Fehler'); setSending(false); }
  }

  const L: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6, display: 'block' };
  const I: React.CSSProperties = { width: '100%', height: 42, border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '0 13px', fontSize: 14, color: '#0F172A', marginBottom: 14 };
  const busy = pending || sending;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15,23,42,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 520, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', background: '#fff', borderRadius: 18, padding: 24 }}>
        <h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 18, fontWeight: 700, color: '#0F172A', marginBottom: 16 }}>Neue Kampagne</h3>

        <label style={L}>Interner Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Oktober-Angebot" style={I} />

        <label style={L}>Empfänger</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {AUDIENCES.map((a) => { const on = audience === a.id; return (
            <button key={a.id} onClick={() => setAudience(a.id)} style={{ display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left', padding: '11px 13px', borderRadius: 11, border: `1.5px solid ${on ? '#4F46E5' : '#E2E8F0'}`, background: on ? '#EEF2FF' : '#fff', cursor: 'pointer' }}>
              <span style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${on ? '#4F46E5' : '#CBD5E1'}`, background: on ? '#4F46E5' : '#fff', flexShrink: 0 }} />
              <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A' }}>{a.label}</div><div style={{ fontSize: 12, color: '#94A3B8' }}>{a.desc}</div></div>
              <span style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 700, fontSize: 15, color: on ? '#4338CA' : '#94A3B8' }}>{counts[a.id] ?? 0}</span>
            </button>
          ); })}
        </div>

        <label style={L}>Betreff</label>
        <input value={betreff} onChange={(e) => setBetreff(e.target.value)} placeholder="z. B. 🍕 Diese Woche: 2 für 1 auf alle Pizzen" style={I} />

        <label style={L}>Nachricht</label>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} placeholder={'Hallo,\n\nschön dass du da bist! Diese Woche gibt es bei uns…'} style={{ ...I, height: 130, padding: '11px 13px', resize: 'vertical' }} />

        {vouchers.length > 0 && (
          <>
            <label style={L}>Gutschein anhängen (optional)</label>
            <select value={voucherCode} onChange={(e) => setVoucherCode(e.target.value)} style={{ ...I, padding: '0 10px' }}>
              <option value="">— keiner —</option>
              {vouchers.map((v) => <option key={v.id} value={v.code}>{v.code} — {v.beschreibung || v.typ}</option>)}
            </select>
          </>
        )}

        {err && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: 10, padding: '8px 12px', fontSize: 13, marginBottom: 12 }}>{err}</div>}
        {ok && <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#047857', borderRadius: 10, padding: '8px 12px', fontSize: 13, marginBottom: 12 }}>{ok}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} disabled={busy} style={{ flex: 1, height: 46, borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', color: '#475569', fontWeight: 700, cursor: 'pointer' }}>Abbrechen</button>
          <button onClick={saveDraft} disabled={!valid || busy} style={{ flex: 1, height: 46, borderRadius: 10, border: '1.5px solid #4F46E5', background: '#fff', color: '#4338CA', fontWeight: 700, cursor: valid && !busy ? 'pointer' : 'not-allowed' }}>{pending ? '…' : 'Entwurf'}</button>
          <button onClick={sendNow} disabled={!valid || busy} title={resendReady ? '' : 'Erst Resend verbinden'} style={{ flex: 1.4, height: 46, borderRadius: 10, border: 'none', background: valid && !busy ? '#4F46E5' : '#CBD5E1', color: '#fff', fontWeight: 700, cursor: valid && !busy ? 'pointer' : 'not-allowed' }}>{sending ? 'Sendet…' : `An ${audCount} senden`}</button>
        </div>
      </div>
    </div>
  );
}
