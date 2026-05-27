'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  MapPin,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Navigation,
  Crosshair,
} from 'lucide-react';

interface Location {
  id: string;
  name: string;
  adresse: string | null;
  plz: string | null;
  stadt: string | null;
  lat: number | null;
  lng: number | null;
}

interface Zone {
  id: string;
  radius_km_bis: number;
  liefergebuehr: number;
  mindestbestellwert: number;
  aktiv: boolean;
  sort_order: number;
}

export function DeliveryZonesClient({
  tenantId,
  primaryLocation,
  initialZones,
}: {
  tenantId: string;
  primaryLocation: Location | null;
  initialZones: Zone[];
}) {
  const sb = createClient();
  const [zones, setZones] = useState<Zone[]>(initialZones);
  const [location, setLocation] = useState<Location | null>(primaryLocation);
  const [geocoding, startGeocoding] = useTransition();
  const [savingZone, startSavingZone] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // === Geocoding via OSM Nominatim ===
  async function geocodeAdresse() {
    if (!location) return;
    if (!location.adresse || !location.plz || !location.stadt) {
      setError(
        'Adresse, PLZ und Stadt müssen unter Restaurant-Einstellungen gesetzt sein.',
      );
      return;
    }
    setError(null);
    startGeocoding(async () => {
      try {
        const q = `${location.adresse}, ${location.plz} ${location.stadt}, Deutschland`;
        const url = new URL('https://nominatim.openstreetmap.org/search');
        url.searchParams.set('q', q);
        url.searchParams.set('format', 'jsonv2');
        url.searchParams.set('limit', '1');
        const res = await fetch(url.toString(), {
          headers: { 'User-Agent': 'mise-backoffice/1.0' },
        });
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) {
          setError('Adresse konnte nicht gefunden werden. Bitte prüfen.');
          return;
        }
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        if (!isFinite(lat) || !isFinite(lng)) {
          setError('Geocoding-Antwort ungültig.');
          return;
        }
        const { error: updErr } = await sb
          .from('locations')
          .update({ lat, lng })
          .eq('id', location.id);
        if (updErr) {
          setError('Speichern fehlgeschlagen: ' + updErr.message);
          return;
        }
        setLocation({ ...location, lat, lng });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unbekannter Fehler');
      }
    });
  }

  // === Zone CRUD ===
  function newZone() {
    const lastRadius =
      zones.length > 0 ? Math.max(...zones.map((z) => Number(z.radius_km_bis))) : 0;
    addZone({
      radius_km_bis: lastRadius + 2,
      liefergebuehr: 1.5,
      mindestbestellwert: 12,
    });
  }

  function addZone(input: {
    radius_km_bis: number;
    liefergebuehr: number;
    mindestbestellwert: number;
  }) {
    setError(null);
    startSavingZone(async () => {
      const { data, error: e } = await sb
        .from('delivery_zones')
        .insert({
          tenant_id: tenantId,
          location_id: location?.id ?? null,
          radius_km_bis: input.radius_km_bis,
          liefergebuehr: input.liefergebuehr,
          mindestbestellwert: input.mindestbestellwert,
          sort_order: zones.length,
          aktiv: true,
        })
        .select()
        .single();
      if (e || !data) {
        setError('Anlegen fehlgeschlagen: ' + (e?.message ?? 'unbekannt'));
        return;
      }
      setZones((prev) =>
        [...prev, data as Zone].sort(
          (a, b) => Number(a.radius_km_bis) - Number(b.radius_km_bis),
        ),
      );
    });
  }

  async function updateZone(id: string, patch: Partial<Zone>) {
    const { error: e } = await sb
      .from('delivery_zones')
      .update(patch)
      .eq('id', id);
    if (e) {
      setError('Update fehlgeschlagen: ' + e.message);
      return;
    }
    setZones((prev) =>
      prev
        .map((z) => (z.id === id ? { ...z, ...patch } : z))
        .sort((a, b) => Number(a.radius_km_bis) - Number(b.radius_km_bis)),
    );
  }

  async function deleteZone(id: string) {
    if (!confirm('Diese Zone wirklich löschen?')) return;
    const { error: e } = await sb.from('delivery_zones').delete().eq('id', id);
    if (e) {
      setError('Löschen fehlgeschlagen: ' + e.message);
      return;
    }
    setZones((prev) => prev.filter((z) => z.id !== id));
  }

  const hasGeo = !!(location?.lat && location?.lng);
  const adressString = location
    ? `${location.adresse ?? '—'}, ${location.plz ?? ''} ${location.stadt ?? ''}`.trim()
    : '';

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-red-200 bg-red-50 text-red-900">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <div className="text-sm">{error}</div>
        </div>
      )}

      {/* === Standort + Geocoding === */}
      <Card className="p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
            <Crosshair size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold mb-1">Restaurant-Standort</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Damit das System ausrechnen kann ob eine PLZ im Liefergebiet liegt,
              brauchen wir die Geo-Koordinaten deiner Filiale.
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-muted-foreground" />
                <span className="font-mono">{adressString || '— keine Adresse hinterlegt —'}</span>
              </div>
              {hasGeo && (
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 size={14} />
                  <span className="font-mono text-xs">
                    {location!.lat!.toFixed(5)}, {location!.lng!.toFixed(5)}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={geocodeAdresse}
              disabled={geocoding || !location}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-800 transition disabled:opacity-50"
            >
              {geocoding ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Suche
                </>
              ) : (
                <>
                  <Navigation size={14} /> {hasGeo ? 'Koordinaten neu berechnen' : 'Adresse zu Koordinaten'}
                </>
              )}
            </button>
            {!hasGeo && (
              <p className="mt-3 text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                Solange keine Koordinaten gesetzt sind, kann der Online-Shop
                keine PLZ-Distanz prüfen.
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* === Zonen === */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h3 className="font-semibold mb-1">Lieferzonen</h3>
            <p className="text-sm text-muted-foreground">
              Pro Zone: bis welche Distanz, welche Liefergebühr, welcher
              Mindestbestellwert. Kunden werden automatisch der kleinsten
              passenden Zone zugeordnet.
            </p>
          </div>
          <button
            onClick={newZone}
            disabled={savingZone}
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition disabled:opacity-50"
          >
            <Plus size={14} /> Zone hinzufügen
          </button>
        </div>

        {zones.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <div className="text-sm mb-1">Noch keine Liefer-Zonen.</div>
            <div className="text-xs">
              Klick „Zone hinzufügen" — z.B.: bis 4 km · 1,00 € · Min 10 €.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b">
                  <th className="py-2 pr-3">Bis km</th>
                  <th className="py-2 pr-3">Liefergebühr</th>
                  <th className="py-2 pr-3">Mindestbestellwert</th>
                  <th className="py-2 pr-3">Aktiv</th>
                  <th className="py-2 pr-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {zones.map((z) => (
                  <tr key={z.id} className="border-b border-zinc-100">
                    <td className="py-2 pr-3">
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        max="50"
                        value={z.radius_km_bis}
                        onBlur={(e) =>
                          updateZone(z.id, {
                            radius_km_bis: parseFloat(e.target.value),
                          })
                        }
                        onChange={(e) =>
                          setZones((prev) =>
                            prev.map((p) =>
                              p.id === z.id
                                ? {
                                    ...p,
                                    radius_km_bis: parseFloat(e.target.value),
                                  }
                                : p,
                            ),
                          )
                        }
                        className="w-20 bg-transparent border border-zinc-200 rounded-md px-2 py-1.5 font-mono text-right"
                      />
                      <span className="ml-1 text-muted-foreground text-xs">km</span>
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={z.liefergebuehr}
                        onBlur={(e) =>
                          updateZone(z.id, {
                            liefergebuehr: parseFloat(e.target.value),
                          })
                        }
                        onChange={(e) =>
                          setZones((prev) =>
                            prev.map((p) =>
                              p.id === z.id
                                ? {
                                    ...p,
                                    liefergebuehr: parseFloat(e.target.value),
                                  }
                                : p,
                            ),
                          )
                        }
                        className="w-20 bg-transparent border border-zinc-200 rounded-md px-2 py-1.5 font-mono text-right"
                      />
                      <span className="ml-1 text-muted-foreground text-xs">€</span>
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={z.mindestbestellwert}
                        onBlur={(e) =>
                          updateZone(z.id, {
                            mindestbestellwert: parseFloat(e.target.value),
                          })
                        }
                        onChange={(e) =>
                          setZones((prev) =>
                            prev.map((p) =>
                              p.id === z.id
                                ? {
                                    ...p,
                                    mindestbestellwert: parseFloat(e.target.value),
                                  }
                                : p,
                            ),
                          )
                        }
                        className="w-20 bg-transparent border border-zinc-200 rounded-md px-2 py-1.5 font-mono text-right"
                      />
                      <span className="ml-1 text-muted-foreground text-xs">€</span>
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="checkbox"
                        checked={z.aktiv}
                        onChange={(e) =>
                          updateZone(z.id, { aktiv: e.target.checked })
                        }
                        className="w-4 h-4"
                      />
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <button
                        onClick={() => deleteZone(z.id)}
                        aria-label="Zone löschen"
                        className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-50 text-red-600 transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Vorschau-Hint */}
            <div className="mt-5 p-4 rounded-xl bg-zinc-50 text-xs">
              <strong className="block mb-2">So sieht's für Kunden aus:</strong>
              <ul className="space-y-1 font-mono">
                {zones.filter((z) => z.aktiv).length === 0 ? (
                  <li className="text-muted-foreground">
                    — keine aktiven Zonen — keine Lieferung möglich
                  </li>
                ) : (
                  zones
                    .filter((z) => z.aktiv)
                    .sort(
                      (a, b) =>
                        Number(a.radius_km_bis) - Number(b.radius_km_bis),
                    )
                    .map((z, i, arr) => {
                      const von = i === 0 ? 0 : Number(arr[i - 1].radius_km_bis);
                      const bis = Number(z.radius_km_bis);
                      return (
                        <li key={z.id}>
                          {von.toFixed(1)} – {bis.toFixed(1)} km · Liefergebühr{' '}
                          {Number(z.liefergebuehr).toFixed(2)} € · Min{' '}
                          {Number(z.mindestbestellwert).toFixed(2)} €
                        </li>
                      );
                    })
                )}
              </ul>
            </div>
          </div>
        )}
      </Card>

      {/* === Wie es funktioniert === */}
      <Card className="p-5 bg-zinc-50/50">
        <h3 className="font-semibold mb-2 text-sm">Wie's funktioniert</h3>
        <ol className="text-xs text-muted-foreground space-y-1 list-decimal pl-5">
          <li>Kunde wählt im Shop „Lieferung" → PLZ-Eingabe-Modal</li>
          <li>System schlägt PLZ → Geo-Koordinaten nach (cached)</li>
          <li>
            Distance zwischen Restaurant und PLZ wird gerechnet
            (Luftlinie, Haversine-Formel)
          </li>
          <li>
            Kleinste passende Zone wird gewählt → Liefergebühr + Mindestbestellwert
            ergeben sich automatisch
          </li>
          <li>
            Außerhalb aller Zonen → keine Lieferung möglich, nur Abholung
          </li>
        </ol>
      </Card>
    </div>
  );
}
