'use client';

import { useState, useTransition, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Check, Loader2, MapPin, Settings2 } from 'lucide-react';
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

type ZoneConfig = {
  id: string;
  name: string;
  label: string;
  min_km: number;
  max_km: number;
  surcharge_eur: number;
  min_order_eur: number;
  eta_base_min: number;
  color: string;
};

function ZoneConfigRow({
  zone,
  locationId,
  onSaved,
}: {
  zone: ZoneConfig;
  locationId: string;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...zone });
  const [saving, startSaving] = useTransition();
  const [saved, setSaved] = useState(false);

  function save() {
    startSaving(async () => {
      await fetch('/api/delivery/zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_id: locationId, ...form }),
      });
      setSaved(true);
      setTimeout(() => { setSaved(false); setEditing(false); onSaved(); }, 1200);
    });
  }

  const zoneColor =
    zone.name === 'A' ? 'bg-emerald-500' :
    zone.name === 'B' ? 'bg-blue-500' :
    zone.name === 'C' ? 'bg-amber-500' : 'bg-red-500';

  if (!editing) {
    return (
      <tr className="border-b border-stone-100 hover:bg-stone-50 transition">
        <td className="py-3 pl-1">
          <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ${zoneColor}`}>
            {zone.name}
          </span>
        </td>
        <td className="py-3 font-semibold text-char">{zone.label}</td>
        <td className="py-3 text-sm text-stone-500">{zone.min_km}–{zone.max_km === 999 ? '∞' : zone.max_km} km</td>
        <td className="py-3 text-sm">{zone.surcharge_eur > 0 ? `+${zone.surcharge_eur.toFixed(2)} €` : 'Kostenlos'}</td>
        <td className="py-3 text-sm">{zone.min_order_eur > 0 ? `${zone.min_order_eur.toFixed(0)} €` : '—'}</td>
        <td className="py-3 text-sm">{zone.eta_base_min} Min</td>
        <td className="py-3 pr-1 text-right">
          <button
            onClick={() => setEditing(true)}
            className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted transition inline-flex items-center gap-1"
          >
            <Settings2 className="h-3.5 w-3.5" /> Bearbeiten
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-matcha-200 bg-matcha-50/40">
      <td colSpan={7} className="py-4 px-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-stone-500">Bezeichnung</span>
            <input
              className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-stone-500">Max. Radius (km)</span>
            <input
              type="number" min={0} step={0.5}
              className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500"
              value={form.max_km === 999 ? '' : form.max_km}
              placeholder="∞"
              onChange={(e) => setForm((f) => ({ ...f, max_km: e.target.value === '' ? 999 : Number(e.target.value) }))}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-stone-500">Aufpreis (€)</span>
            <input
              type="number" min={0} step={0.5}
              className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500"
              value={form.surcharge_eur}
              onChange={(e) => setForm((f) => ({ ...f, surcharge_eur: Number(e.target.value) }))}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-stone-500">Mindestbestellwert (€)</span>
            <input
              type="number" min={0} step={1}
              className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500"
              value={form.min_order_eur}
              onChange={(e) => setForm((f) => ({ ...f, min_order_eur: Number(e.target.value) }))}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-stone-500">Basis-ETA (Min)</span>
            <input
              type="number" min={5} step={5}
              className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500"
              value={form.eta_base_min}
              onChange={(e) => setForm((f) => ({ ...f, eta_base_min: Number(e.target.value) }))}
            />
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="h-9 px-4 rounded-lg bg-matcha-900 text-matcha-50 text-sm font-bold hover:bg-matcha-800 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {saved ? 'Gespeichert' : 'Speichern'}
          </button>
          <button
            onClick={() => { setForm({ ...zone }); setEditing(false); }}
            className="h-9 px-4 rounded-lg border text-sm font-semibold hover:bg-muted transition"
          >
            Abbrechen
          </button>
        </div>
      </td>
    </tr>
  );
}

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
  const [zones, setZones] = useState<ZoneConfig[]>([]);
  const [seeding, startSeeding] = useTransition();

  const mainLocation = locations[0];

  function loadZones() {
    if (!mainLocation?.id) return;
    fetch(`/api/delivery/zones?location_id=${mainLocation.id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d: { zones?: ZoneConfig[] } | null) => d?.zones && setZones(d.zones))
      .catch(() => {});
  }

  useEffect(() => { loadZones(); }, [mainLocation?.id]);

  function seedZones() {
    startSeeding(async () => {
      await fetch('/api/delivery/zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_id: mainLocation.id, seed: true }),
      });
      loadZones();
    });
  }

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

      {/* Zonen A/B/C/D */}
      {mainLocation && (
        <Card className="p-6">
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center">
                <Settings2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold">Lieferzonen A–D</h3>
                <p className="text-sm text-muted-foreground">ETA, Aufpreis und Mindestbestellwert pro Zone.</p>
              </div>
            </div>
            {zones.length === 0 && (
              <button
                onClick={seedZones}
                disabled={seeding}
                className="h-9 px-4 rounded-xl border text-sm font-semibold hover:bg-muted transition inline-flex items-center gap-1.5"
              >
                {seeding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Standard-Zonen anlegen
              </button>
            )}
          </div>

          {zones.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine Zonen konfiguriert. Klicke auf &quot;Standard-Zonen anlegen&quot; um A/B/C/D mit Standardwerten zu erstellen.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="border-b border-stone-100">
                    <th className="text-left py-2 pl-1 text-stone-500 font-medium w-8">Zone</th>
                    <th className="text-left py-2 text-stone-500 font-medium">Bezeichnung</th>
                    <th className="text-left py-2 text-stone-500 font-medium">Radius</th>
                    <th className="text-left py-2 text-stone-500 font-medium">Aufpreis</th>
                    <th className="text-left py-2 text-stone-500 font-medium">Mindestbestellung</th>
                    <th className="text-left py-2 text-stone-500 font-medium">Basis-ETA</th>
                    <th className="text-right py-2 pr-1 text-stone-500 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {zones.map((z) => (
                    <ZoneConfigRow
                      key={z.id}
                      zone={z}
                      locationId={mainLocation.id}
                      onSaved={loadZones}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
