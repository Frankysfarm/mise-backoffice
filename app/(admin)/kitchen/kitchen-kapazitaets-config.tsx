'use client';

/**
 * KitchenKapazitaetsConfig — Phase 485
 * Konfiguration des Küchen-Kapazitäts-Schwellwerts (kitchen_max_concurrent_orders).
 * Nutzt GET/PATCH /api/delivery/admin/kitchen-capacity-config.
 * Collapsible, zeigt aktuellen Wert + Default-Hinweis.
 */

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Settings, Loader2, Save, RotateCcw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ConfigData {
  key: string;
  value: number;
  isCustom: boolean;
  default: number;
  updatedAt: string | null;
}

interface Props {
  locationId: string | null;
}

export function KitchenKapazitaetsConfig({ locationId }: Props) {
  const [open, setOpen]         = useState(false);
  const [data, setData]         = useState<ConfigData | null>(null);
  const [loading, setLoading]   = useState(false);
  const [value, setValue]       = useState<number>(8);
  const [saving, setSaving]     = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [saved, setSaved]       = useState(false);

  useEffect(() => {
    if (!open || !locationId) return;
    setLoading(true);
    setError(null);

    fetch(`/api/delivery/admin/kitchen-capacity-config?location_id=${encodeURIComponent(locationId)}`)
      .then((r) => r.json() as Promise<ConfigData>)
      .then((d) => { setData(d); setValue(d.value); })
      .catch(() => setError('Konfiguration konnte nicht geladen werden'))
      .finally(() => setLoading(false));
  }, [open, locationId]);

  async function save() {
    if (!locationId || saving) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    const res = await fetch('/api/delivery/admin/kitchen-capacity-config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location_id: locationId, value }),
    });

    const d = await res.json() as { ok?: boolean; error?: string; value?: number };
    if (!res.ok || !d.ok) {
      setError(d.error ?? 'Fehler beim Speichern');
    } else {
      setData((prev) => prev ? { ...prev, value: d.value!, isCustom: true } : null);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  async function resetToDefault() {
    if (!locationId || resetting) return;
    setResetting(true);
    setError(null);

    const res = await fetch(
      `/api/delivery/admin/kitchen-capacity-config?location_id=${encodeURIComponent(locationId)}`,
      { method: 'DELETE' },
    );

    if (res.ok) {
      const d = await res.json() as ConfigData;
      setData(d);
      setValue(d.value);
    } else {
      setError('Zurücksetzen fehlgeschlagen');
    }
    setResetting(false);
  }

  if (!locationId) return null;

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-muted/30 transition"
      >
        <Settings className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Küchen-Kapazitäts-Schwellwert
        </span>
        {data && (
          <span className={cn(
            'ml-auto text-[10px] font-mono font-bold px-2 py-0.5 rounded-full',
            data.isCustom ? 'bg-matcha-100 text-matcha-700' : 'bg-muted text-muted-foreground',
          )}>
            {data.value} {data.isCustom ? '(angepasst)' : '(Standard)'}
          </span>
        )}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t">
          {loading && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && (
            <>
              <p className="text-xs text-muted-foreground">
                Maximale Anzahl gleichzeitiger Bestellungen in Zubereitung, bevor ein Kapazitäts-Alert ausgelöst wird.
                Standard: {data?.default ?? 8} Bestellungen.
              </p>

              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-foreground shrink-0">Schwellwert:</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={value}
                  onChange={(e) => setValue(Math.max(1, Math.min(100, Number(e.target.value))))}
                  className="w-20 rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-mono text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-matcha-300"
                />
                <span className="text-xs text-muted-foreground">Bestellungen</span>

                {/* Slider */}
                <input
                  type="range"
                  min={1}
                  max={30}
                  value={Math.min(30, value)}
                  onChange={(e) => setValue(Number(e.target.value))}
                  className="flex-1 accent-matcha-500"
                />
              </div>

              {/* Alert-Vorschau */}
              <div className="rounded-lg bg-muted/50 px-3 py-2 text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">OK bis:</span>
                  <span className="font-mono font-bold">&lt; {Math.ceil(value * 0.75)} Bestellungen</span>
                </div>
                <div className="flex justify-between text-amber-600">
                  <span>Warnung:</span>
                  <span className="font-mono font-bold">{Math.ceil(value * 0.75)}–{value} Bestellungen</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>Kritisch:</span>
                  <span className="font-mono font-bold">&gt; {value} Bestellungen</span>
                </div>
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}
              {saved && <p className="text-xs text-matcha-600 font-semibold">✅ Gespeichert!</p>}

              <div className="flex gap-2">
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-matcha-500 text-white px-3 py-2 text-xs font-bold hover:bg-matcha-600 disabled:opacity-50 transition"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Speichern
                </button>
                {data?.isCustom && (
                  <button
                    onClick={resetToDefault}
                    disabled={resetting}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50 disabled:opacity-50 transition"
                  >
                    {resetting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                    Zurücksetzen
                  </button>
                )}
              </div>

              {data?.updatedAt && (
                <p className="text-[10px] text-muted-foreground text-right">
                  Zuletzt geändert: {new Date(data.updatedAt).toLocaleString('de-DE')}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
}
