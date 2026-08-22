'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  AlertCircle, Check, ChevronLeft, ChevronRight, Loader2, Mail, Send, Sparkles,
} from 'lucide-react';

type Voucher = { id: string; code: string; typ: string; wert: number; beschreibung: string | null };

const AUDIENCES = [
  { id: 'all_customers', label: 'Alle Bestandskunden', desc: 'Jeder mit E-Mail + Marketing-Opt-in' },
  { id: 'last_30d',      label: 'Letzte 30 Tage',       desc: 'Kunden mit Bestellung in den letzten 30 Tagen' },
  { id: 'voucher_unused', label: 'Ohne Gutschein-Einlösung', desc: 'Kunden, die noch keinen Code eingelöst haben' },
];

export function NewCampaign({
  vouchers, audienceCounts,
}: {
  vouchers: Voucher[];
  audienceCounts: Record<string, number>;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [betreff, setBetreff] = useState('');
  const [preheader, setPreheader] = useState('');
  const [audienceTyp, setAudienceTyp] = useState<string>('last_30d');
  const [voucherCode, setVoucherCode] = useState<string>('');
  const [ctaLabel, setCtaLabel] = useState('Jetzt bestellen');
  const [bodyHtml, setBodyHtml] = useState(
    '<p>Hallo 👋</p><p>Wir freuen uns, dich wieder bei uns zu sehen. Als Dankeschön gibt\'s einen Rabatt auf deine nächste Bestellung.</p>'
  );

  const [saving, startSaving] = useTransition();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audienceCount = audienceCounts[audienceTyp] ?? 0;

  async function saveDraft() {
    if (!name || !betreff) {
      setError('Name und Betreff sind Pflicht');
      return;
    }
    startSaving(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: emp } = await supabase.from('employees').select('id,tenant_id').eq('auth_user_id', user.id).maybeSingle();
      if (!emp?.tenant_id) return;

      const { data: c, error: e } = await supabase
        .from('email_campaigns')
        .insert({
          tenant_id: emp.tenant_id,
          name,
          betreff,
          preheader: preheader || null,
          body_html: bodyHtml,
          audience_typ: audienceTyp,
          voucher_code: voucherCode || null,
          cta_label: ctaLabel,
          status: 'entwurf',
          created_by: emp.id,
        })
        .select('id')
        .single();

      if (e) {
        setError(e.message);
        return;
      }
      router.push(`/campaigns/${c.id}`);
    });
  }

  async function sendNow() {
    if (!confirm(`Kampagne an ${audienceCount} Empfänger jetzt senden?`)) return;
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: emp } = await supabase.from('employees').select('id,tenant_id').eq('auth_user_id', user.id).maybeSingle();
      if (!emp?.tenant_id) return;

      const { data: c } = await supabase
        .from('email_campaigns')
        .insert({
          tenant_id: emp.tenant_id,
          name,
          betreff,
          preheader: preheader || null,
          body_html: bodyHtml,
          audience_typ: audienceTyp,
          voucher_code: voucherCode || null,
          cta_label: ctaLabel,
          status: 'entwurf',
          created_by: emp.id,
        })
        .select('id')
        .single();

      if (!c) return;

      const res = await fetch(`/api/campaigns/${c.id}/send`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Versand fehlgeschlagen');
        setSending(false);
        return;
      }
      router.push(`/campaigns/${c.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
      setSending(false);
    }
  }

  const STEPS = ['Basis', 'Empfänger', 'Inhalt', 'Versand'];
  const canNext = (() => {
    if (step === 0) return name.trim().length > 0 && betreff.trim().length > 0;
    if (step === 1) return audienceCount > 0;
    if (step === 2) return bodyHtml.trim().length > 10;
    return true;
  })();

  return (
    <div className="max-w-3xl">
      {/* Stepper */}
      <div className="flex gap-1.5 mb-8">
        {STEPS.map((_, i) => (
          <div key={i} className={cn('h-1 flex-1 rounded-full transition', i <= step ? 'bg-matcha-700' : 'bg-muted')} />
        ))}
      </div>

      {error && (
        <Card className="p-4 border-red-300 bg-red-50 mb-4 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-700 shrink-0 mt-0.5" />
          <div className="text-sm text-red-900">{error}</div>
        </Card>
      )}

      {/* Step 0: Basis */}
      {step === 0 && (
        <Card className="p-6 space-y-4">
          <h2 className="font-display text-xl font-bold">Basis</h2>
          <Field label="Name (intern)" value={name} onChange={setName} placeholder="Welcome-Kampagne April" />
          <Field label="Betreff (für Kunde)" value={betreff} onChange={setBetreff} placeholder="10 % auf deine nächste Bestellung 🎁" />
          <Field label="Preheader (Vorschau)" value={preheader} onChange={setPreheader} placeholder="Als Dankeschön für Stammkunden — gültig 30 Tage" />
        </Card>
      )}

      {/* Step 1: Empfänger */}
      {step === 1 && (
        <Card className="p-6 space-y-4">
          <h2 className="font-display text-xl font-bold">Empfänger</h2>
          <div className="space-y-2">
            {AUDIENCES.map((a) => {
              const count = audienceCounts[a.id] ?? 0;
              const active = audienceTyp === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => setAudienceTyp(a.id)}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-xl border-2 p-4 text-left transition',
                    active ? 'border-matcha-700 bg-matcha-50' : 'border-border hover:bg-muted/40',
                  )}
                >
                  <div className={cn('h-6 w-6 rounded-full flex items-center justify-center shrink-0', active ? 'bg-matcha-700 text-white' : 'border-2 border-border')}>
                    {active && <Check size={14} />}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold">{a.label}</div>
                    <div className="text-xs text-muted-foreground">{a.desc}</div>
                  </div>
                  <div className="font-display font-bold text-matcha-700">{count}</div>
                </button>
              );
            })}
          </div>
          {audienceCount === 0 && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Noch keine Empfänger in dieser Kategorie. Brauchst du zuerst Bestellungen oder Opt-ins.
            </div>
          )}
        </Card>
      )}

      {/* Step 2: Inhalt */}
      {step === 2 && (
        <Card className="p-6 space-y-4">
          <h2 className="font-display text-xl font-bold">Inhalt</h2>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Nachricht (HTML)
            </label>
            <textarea
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              rows={8}
              className="mt-1.5 w-full rounded-xl border bg-background px-4 py-3 font-mono text-sm"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Gutschein-Code (optional, aus deinen Aktionen)
            </label>
            <select
              value={voucherCode}
              onChange={(e) => setVoucherCode(e.target.value)}
              className="mt-1.5 w-full h-10 rounded-xl border bg-background px-3"
            >
              <option value="">— Keiner —</option>
              {vouchers.map((v) => (
                <option key={v.id} value={v.code}>
                  {v.code} — {v.beschreibung ?? `${v.wert}% Rabatt`}
                </option>
              ))}
            </select>
          </div>

          <Field label="CTA-Button-Text" value={ctaLabel} onChange={setCtaLabel} placeholder="Jetzt bestellen" />

          {/* Preview */}
          <div className="rounded-xl border-2 border-dashed p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Vorschau</div>
            <div className="rounded-lg bg-white p-5 max-h-80 overflow-y-auto">
              <div className="text-sm" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
              {voucherCode && (
                <div className="mt-4 text-center">
                  <div className="inline-block bg-accent text-matcha-900 font-mono font-bold px-4 py-2 rounded-lg">{voucherCode}</div>
                </div>
              )}
              <div className="mt-4 text-center">
                <div className="inline-block bg-matcha-900 text-matcha-50 px-6 py-3 rounded-lg font-bold text-sm">{ctaLabel}</div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Step 3: Versand */}
      {step === 3 && (
        <Card className="p-6 space-y-4">
          <h2 className="font-display text-xl font-bold">Versand</h2>

          <div className="rounded-2xl border bg-muted/20 p-5 space-y-2">
            <SummaryRow label="Name" value={name} />
            <SummaryRow label="Betreff" value={betreff} />
            <SummaryRow label="Empfänger" value={`${audienceCount} Personen`} />
            {voucherCode && <SummaryRow label="Gutschein" value={voucherCode} />}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={saveDraft}
              disabled={saving || sending}
              className="inline-flex items-center gap-2 rounded-xl bg-muted hover:bg-muted/80 px-4 py-2.5 text-sm font-bold"
            >
              Als Entwurf speichern
            </button>
            <button
              onClick={sendNow}
              disabled={saving || sending || audienceCount === 0}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-matcha-900 text-matcha-50 px-4 py-2.5 text-sm font-bold hover:bg-matcha-800 disabled:opacity-50"
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Jetzt an {audienceCount} Empfänger senden
            </button>
          </div>
        </Card>
      )}

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="inline-flex items-center gap-1 text-sm disabled:opacity-30"
        >
          <ChevronLeft size={14} /> Zurück
        </button>
        {step < STEPS.length - 1 && (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canNext}
            className="inline-flex items-center gap-1 rounded-xl bg-matcha-900 text-matcha-50 px-4 py-2 text-sm font-bold disabled:opacity-50"
          >
            Weiter <ChevronRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 outline-none focus:border-matcha-700 focus:ring-2 focus:ring-matcha-500/20"
      />
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
