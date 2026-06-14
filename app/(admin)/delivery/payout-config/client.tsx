'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { euro } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, Save } from 'lucide-react';

interface PayoutConfig {
  basePerDelivery: number;
  kmRate: number;
  peakMultiplier: number;
  bonusPerRatingPoint: number;
  minRatingForBonus: number;
  milestoneBonuses: Record<string, number>;
  peakWindows: { weekday: number; start: string; end: string }[];
}

const WEEKDAY_LABELS = ['', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function Field({ label, value, onChange, step = 0.01, min = 0 }: { label: string; value: number; onChange: (v: number) => void; step?: number; min?: number }) {
  return (
    <div>
      <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{label}</label>
      <input
        type="number"
        step={step}
        min={min}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500"
      />
    </div>
  );
}

export function PayoutConfigClient({ locationId }: { locationId: string }) {
  const [config, setConfig] = useState<PayoutConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/delivery/admin/payout-config?location_id=${locationId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.config) setConfig(d.config as PayoutConfig); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId]);

  const update = (key: keyof PayoutConfig, value: unknown) => {
    setConfig(prev => prev ? { ...prev, [key]: value } : prev);
  };

  const save = async () => {
    if (!config) return;
    setSaving(true);
    setError(null);
    const res = await fetch('/api/delivery/admin/payout-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location_id: locationId, ...config }),
    });
    const json = await res.json();
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    else setError(json.error ?? 'Fehler beim Speichern');
    setSaving(false);
  };

  if (loading) return <div className="flex items-center justify-center py-16 text-muted-foreground">Lade Konfiguration…</div>;
  if (!config) return <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Keine Konfiguration gefunden.</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Basis-Vergütung */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <h3 className="font-display font-bold text-sm">Basis-Vergütung</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Basis pro Lieferung (€)" value={config.basePerDelivery} onChange={v => update('basePerDelivery', v)} />
          <Field label="km-Satz (€/km)" value={config.kmRate} onChange={v => update('kmRate', v)} step={0.001} />
        </div>
      </div>

      {/* Peak-Bonus */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <h3 className="font-display font-bold text-sm">Peak-Bonus</h3>
        <Field label="Peak-Multiplikator (z.B. 1.2 = +20%)" value={config.peakMultiplier} onChange={v => update('peakMultiplier', v)} step={0.05} min={1} />
        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Peak-Zeitfenster</div>
          {config.peakWindows.length === 0 && <div className="text-sm text-muted-foreground">Keine Fenster konfiguriert.</div>}
          {config.peakWindows.map((pw, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="w-8 font-bold">{WEEKDAY_LABELS[pw.weekday] ?? pw.weekday}</span>
              <span className="text-muted-foreground">{pw.start} – {pw.end}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bewertungs-Bonus */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <h3 className="font-display font-bold text-sm">Bewertungs-Bonus</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Bonus je 0.1 Punkte über Mindestrating (€)" value={config.bonusPerRatingPoint} onChange={v => update('bonusPerRatingPoint', v)} />
          <Field label="Mindestrating für Bonus" value={config.minRatingForBonus} onChange={v => update('minRatingForBonus', v)} step={0.1} min={3} />
        </div>
      </div>

      {/* Meilenstein-Boni */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <h3 className="font-display font-bold text-sm">Meilenstein-Boni</h3>
        <div className="space-y-2">
          {Object.entries(config.milestoneBonuses).sort(([a], [b]) => Number(a) - Number(b)).map(([count, bonus]) => (
            <div key={count} className="flex items-center gap-2 text-sm">
              <span className="font-medium w-24">{count} Lieferungen</span>
              <span className="text-muted-foreground">→</span>
              <span className="font-bold text-matcha-700">{euro(bonus)}</span>
            </div>
          ))}
          {Object.keys(config.milestoneBonuses).length === 0 && (
            <div className="text-sm text-muted-foreground">Keine Meilenstein-Boni konfiguriert.</div>
          )}
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg border border-matcha-700 bg-matcha-700 text-white px-4 py-2 text-sm font-semibold hover:bg-matcha-800 transition disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Wird gespeichert…' : 'Speichern'}
        </button>
        {saved && (
          <div className="flex items-center gap-1.5 text-sm text-matcha-700">
            <CheckCircle2 className="h-4 w-4" /> Gespeichert
          </div>
        )}
        {error && (
          <div className="flex items-center gap-1.5 text-sm text-red-600">
            <AlertTriangle className="h-4 w-4" /> {error}
          </div>
        )}
      </div>
    </div>
  );
}
