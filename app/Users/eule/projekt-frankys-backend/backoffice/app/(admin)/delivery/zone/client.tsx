'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Check, Loader2, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

type Location = {
  id: string;
  name: string;
  adresse: string | null;
  stadt: string | null;
  plz: string | null;
  lat: number | null;
  lng: number | null;
};

export function ZoneForm({
  tenantId, initialRadius, locations,
}: {
  tenantId: string;
  initialRadius: number;
  locations: Location[];
}) {
  const supabase = createClient();
  const [radius, setRadius] = useState(initialRadius);
  const [saving, startSaving] = useTransition();
  const [saved, setSaved] = useState(false);

  const mainLocation = locations[0];

  function save() {
    startSaving(async () => {
      await supabase.from('tenants').update({ lieferradius_km: radius }).eq('id', tenantId);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  const presets = [3, 5, 8, 10, 15, 20];

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Standorte */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-matcha-100 text-matcha-800 flex items-center justify-center">
            <MapPin className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold">Dein Standort</h3>
            <p className="text-sm text-muted-foreground">
              Ausgangspunkt deines Liefergebiets. Ändern unter <a href="/locations" className="underline">Standorte</a>.
            </p>
          </div>
        </div>

        {mainLocation ? (
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="font-bold">{mainLocation.name}</div>
            <div className="text-sm text-muted-foreground mt-0.5">
              {[mainLocation.adresse, mainLocation.plz, mainLocation.stadt].filter(Boolean).join(', ') || 'Adresse fehlt'}
            </div>
            {mainLocation.lat && mainLocation.lng ? (
              <div className="mt-2 text-xs text-matcha-700 font-semibold">
                ✓ Geocodiert
              </div>
            ) : (
              <div className="mt-2 text-xs text-amber-700 font-semibold">
                Adresse noch nicht geocodiert — Radius-Check kann nicht greifen.
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            Noch kein aktiver Standort. Erst unter <a href="/locations" className="underline">Standorte</a> anlegen.
          </div>
        )}
      </Card>

      {/* Radius */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display text-lg font-bold">Lieferradius</h3>
            <p className="text-sm text-muted-foreground">Luftlinie-Entfernung vom Standort.</p>
          </div>
          <div className="font-display text-3xl font-bold">
            {radius} <span className="text-sm text-muted-foreground">km</span>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap mb-4">
          {presets.map((v) => (
            <button
              key={v}
              onClick={() => setRadius(v)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-semibold transition border',
                radius === v
                  ? 'bg-matcha-900 text-matcha-50 border-matcha-900'
                  : 'bg-card border-border hover:bg-muted',
              )}
            >
              {v} km
            </button>
          ))}
        </div>

        <input
          type="range"
          min={1} max={30} step={0.5}
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
          className="w-full accent-matcha-700"
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>1 km</span>
          <span>30 km</span>
        </div>

        {/* Visual Radius Preview */}
        <div className="mt-6 flex items-center justify-center bg-matcha-50/40 rounded-2xl p-8">
          <div className="relative" style={{ width: 200, height: 200 }}>
            <div
              className="absolute inset-0 rounded-full bg-matcha-500/20 border-2 border-matcha-500/40"
              style={{ transform: `scale(${Math.min(1, radius / 30)})`, transformOrigin: 'center' }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-6 w-6 rounded-full bg-matcha-900 border-4 border-white shadow-lg" />
            </div>
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-muted-foreground whitespace-nowrap">
              Radius ≈ {radius} km
            </div>
          </div>
        </div>
      </Card>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="h-11 px-6 rounded-xl bg-matcha-900 text-matcha-50 font-bold hover:bg-matcha-800 disabled:opacity-50 inline-flex items-center gap-2"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Speichern
        </button>
        {saved && <span className="text-sm text-matcha-700 font-semibold">Gespeichert</span>}
      </div>
    </div>
  );
}
