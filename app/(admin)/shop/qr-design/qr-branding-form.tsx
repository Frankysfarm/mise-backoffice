'use client';

import { useState } from 'react';
import { Check, Loader2, Palette } from 'lucide-react';
import { Card } from '@/components/ui/card';

type Props = {
  initialPrimary: string;
  initialAccent: string;
  initialWelcomeText: string;
  initialCtaLabel: string;
};

export function QRBrandingForm({
  initialPrimary,
  initialAccent,
  initialWelcomeText,
  initialCtaLabel,
}: Props) {
  const [primary, setPrimary] = useState(initialPrimary);
  const [accent, setAccent] = useState(initialAccent);
  const [welcomeText, setWelcomeText] = useState(initialWelcomeText);
  const [ctaLabel, setCtaLabel] = useState(initialCtaLabel);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  async function save() {
    if (saving) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch('/api/shop/qr-branding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primary, accent, welcomeText, ctaLabel }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? 'Speichern fehlgeschlagen');
      setMessage({ kind: 'ok', text: 'Branding gespeichert. Die QR-Seite nutzt es beim nächsten Laden.' });
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Speichern fehlgeschlagen' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="overflow-hidden border-2">
      <div className="border-b bg-stone-950 px-6 py-5 text-white">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl" style={{ background: accent, color: primary }}>
            <Palette className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Counter Culture</div>
            <h2 className="font-display text-2xl font-black">QR-Auftritt konfigurieren</h2>
          </div>
        </div>
      </div>

      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_0.9fr]">
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <ColorField label="Primärfarbe" value={primary} onChange={setPrimary} />
            <ColorField label="Akzentfarbe" value={accent} onChange={setAccent} />
          </div>
          <label className="block">
            <span className="text-sm font-bold">Begrüßung am Tisch</span>
            <input
              value={welcomeText}
              maxLength={160}
              onChange={(event) => setWelcomeText(event.target.value)}
              className="mt-2 min-h-12 w-full rounded-xl border px-4 text-sm outline-none focus:ring-2 focus:ring-stone-400"
            />
            <span className="mt-1 block text-xs text-muted-foreground">{welcomeText.length}/160 Zeichen</span>
          </label>
          <label className="block">
            <span className="text-sm font-bold">Warenkorb-CTA</span>
            <input
              value={ctaLabel}
              maxLength={48}
              onChange={(event) => setCtaLabel(event.target.value)}
              className="mt-2 min-h-12 w-full rounded-xl border px-4 text-sm outline-none focus:ring-2 focus:ring-stone-400"
            />
          </label>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 font-black text-white disabled:opacity-60 sm:w-auto"
            style={{ background: primary }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Branding speichern
          </button>
          {message && (
            <p role="status" className={message.kind === 'ok' ? 'text-sm text-emerald-700' : 'text-sm text-red-700'}>
              {message.text}
            </p>
          )}
        </div>

        <div className="rounded-3xl p-5 text-white" style={{ background: primary }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[9px] font-black uppercase tracking-[0.2em] opacity-60">Live-Stil</div>
              <div className="font-display text-2xl font-black">Dein Restaurant</div>
            </div>
            <div className="rounded-2xl px-3 py-2 text-center" style={{ background: accent, color: primary }}>
              <div className="text-[8px] font-black uppercase tracking-wider">Tisch</div>
              <div className="font-display text-xl font-black">12</div>
            </div>
          </div>
          <p className="mt-8 text-sm font-medium text-white/80">{welcomeText || 'Direkt am Tisch bestellen.'}</p>
          <div className="mt-6 rounded-2xl bg-white p-4 text-stone-900">
            <div className="text-sm font-black">San Sebastian Cheesecake</div>
            <div className="mt-3 flex items-center justify-between">
              <span className="font-display text-xl font-black" style={{ color: primary }}>6,90 €</span>
              <span className="rounded-full px-4 py-2 text-xs font-black text-white" style={{ background: primary }}>Hinzufügen</span>
            </div>
          </div>
          <div className="mt-4 rounded-2xl px-4 py-3 text-center font-black" style={{ background: accent, color: primary }}>
            {ctaLabel || 'Zur Bestellung'}
          </div>
        </div>
      </div>
    </Card>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold">{label}</span>
      <span className="mt-2 flex min-h-12 items-center gap-3 rounded-xl border px-3">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 w-10 cursor-pointer border-0 bg-transparent p-0"
        />
        <input
          value={value}
          maxLength={7}
          pattern="#[0-9A-Fa-f]{6}"
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent font-mono text-sm uppercase outline-none"
          aria-label={`${label} als Hex-Code`}
        />
      </span>
    </label>
  );
}
