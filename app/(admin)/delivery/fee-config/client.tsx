'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { euro } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, Save } from 'lucide-react';

interface ZoneFee {
  zone: string;
  zone_label: string;
  zone_color: string;
  min_km: number;
  max_km: number;
  surcharge_eur: number;
  min_order_eur: number;
  free_delivery_above_eur: number | null;
  eta_min: number;
}

type EditableZone = ZoneFee & { _dirty?: boolean };

export function FeeConfigClient({ locationId }: { locationId: string }) {
  const [zones, setZones] = useState<EditableZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/delivery/admin/fee-config?location_id=${locationId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.zones) setZones(d.zones as ZoneFee[]); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId]);

  const updateZone = (zone: string, key: keyof ZoneFee, value: number | null) => {
    setZones(prev => prev.map(z => z.zone === zone ? { ...z, [key]: value, _dirty: true } : z));
  };

  const saveZone = async (zone: EditableZone) => {
    setSaving(zone.zone);
    setError(null);
    const res = await fetch('/api/delivery/admin/fee-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location_id: locationId,
        zone: zone.zone,
        surcharge_eur: zone.surcharge_eur,
        min_order_eur: zone.min_order_eur,
        free_delivery_above_eur: zone.free_delivery_above_eur,
        eta_base_min: zone.eta_min,
      }),
    });
    if (res.ok) {
      setZones(prev => prev.map(z => z.zone === zone.zone ? { ...z, _dirty: false } : z));
      setSaved(zone.zone);
      setTimeout(() => setSaved(null), 3000);
    } else {
      const json = await res.json();
      setError(json.error ?? 'Fehler beim Speichern');
    }
    setSaving(null);
  };

  if (loading) return <div className="flex items-center justify-center py-16 text-muted-foreground">Lade Gebühren…</div>;
  if (zones.length === 0) return <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Keine Zonen konfiguriert.</div>;

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {zones.map(zone => (
        <div key={zone.zone} className={cn('rounded-xl border bg-card p-5 space-y-4', zone._dirty && 'border-amber-300')}>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-black shrink-0"
              style={{ backgroundColor: zone.zone_color || '#4A7C59' }}>
              {zone.zone}
            </div>
            <div>
              <div className="font-display font-bold">{zone.zone_label}</div>
              <div className="text-[11px] text-muted-foreground">{zone.min_km} – {zone.max_km} km</div>
            </div>
            {zone._dirty && <span className="ml-auto text-[11px] text-amber-600 font-bold">Nicht gespeichert</span>}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Liefergebühr (€)</label>
              <input
                type="number" step="0.10" min="0"
                value={zone.surcharge_eur}
                onChange={e => updateZone(zone.zone, 'surcharge_eur', Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Mindestbestellung (€)</label>
              <input
                type="number" step="0.50" min="0"
                value={zone.min_order_eur}
                onChange={e => updateZone(zone.zone, 'min_order_eur', Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Gratis ab (€, leer = nie)</label>
              <input
                type="number" step="1.00" min="0"
                value={zone.free_delivery_above_eur ?? ''}
                placeholder="—"
                onChange={e => updateZone(zone.zone, 'free_delivery_above_eur', e.target.value === '' ? null : Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Basis-ETA (Min)</label>
              <input
                type="number" step="1" min="1"
                value={zone.eta_min}
                onChange={e => updateZone(zone.zone, 'eta_min', Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500"
              />
            </div>
          </div>

          {/* Current values summary */}
          <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
            <span>Gebühr: <strong>{euro(zone.surcharge_eur)}</strong></span>
            <span>Mindest: <strong>{euro(zone.min_order_eur)}</strong></span>
            <span>Gratis ab: <strong>{zone.free_delivery_above_eur !== null ? euro(zone.free_delivery_above_eur) : '—'}</strong></span>
            <span>ETA: <strong>{zone.eta_min} Min</strong></span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => saveZone(zone)}
              disabled={saving === zone.zone || !zone._dirty}
              className="flex items-center gap-1.5 rounded-lg border border-matcha-700 bg-matcha-700 text-white px-3 py-1.5 text-sm font-semibold hover:bg-matcha-800 transition disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {saving === zone.zone ? 'Speichert…' : 'Speichern'}
            </button>
            {saved === zone.zone && (
              <div className="flex items-center gap-1.5 text-sm text-matcha-700">
                <CheckCircle2 className="h-4 w-4" /> Gespeichert
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
