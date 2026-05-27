'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  ChefHat, Copy, ExternalLink, Loader2, Monitor, Plus, Trash2, X,
} from 'lucide-react';

type Station = {
  id: string;
  tenant_id: string;
  location_id: string;
  name: string;
  icon: string | null;
  farbe: string | null;
  display_token: string;
  sound_enabled: boolean;
  aktiv: boolean;
  sort_order: number;
};

type Category = { id: string; name: string; icon: string | null };
type Routing = { station_id: string; category_id: string };

const PRESET_STATIONS = [
  { name: 'Hauptküche', icon: '👨‍🍳', farbe: '#14532d' },
  { name: 'Bar',        icon: '🍹',   farbe: '#b45309' },
  { name: 'Grill',      icon: '🔥',   farbe: '#b91c1c' },
  { name: 'Kalte Küche',icon: '🥗',   farbe: '#15803d' },
  { name: 'Dessert',    icon: '🍰',   farbe: '#a21caf' },
  { name: 'Barista',    icon: '☕',   farbe: '#92400e' },
];

export function StationsManager({
  tenantId, locationId, initialStations, categories, initialRouting,
}: {
  tenantId: string;
  locationId: string;
  initialStations: Station[];
  categories: Category[];
  initialRouting: Routing[];
}) {
  const supabase = createClient();
  const [stations, setStations] = useState(initialStations);
  const [routing, setRouting] = useState(initialRouting);
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

  async function addStation(preset: typeof PRESET_STATIONS[number] | { name: string; icon: string; farbe: string }) {
    startTransition(async () => {
      const { data } = await supabase.from('kitchen_stations').insert({
        tenant_id: tenantId,
        location_id: locationId,
        name: preset.name,
        icon: preset.icon,
        farbe: preset.farbe,
        sort_order: stations.length,
      }).select().single();
      if (data) setStations((arr) => [...arr, data as any]);
      setAdding(false);
    });
  }

  async function deleteStation(id: string) {
    if (!confirm('Station wirklich löschen? Die Display-URL wird ungültig.')) return;
    startTransition(async () => {
      await supabase.from('kitchen_stations').delete().eq('id', id);
      setStations((arr) => arr.filter((s) => s.id !== id));
      setRouting((r) => r.filter((x) => x.station_id !== id));
    });
  }

  async function toggleRoute(stationId: string, categoryId: string) {
    const exists = routing.some((r) => r.station_id === stationId && r.category_id === categoryId);
    startTransition(async () => {
      if (exists) {
        await supabase.from('station_category_routing').delete()
          .eq('station_id', stationId).eq('category_id', categoryId);
        setRouting((r) => r.filter((x) => !(x.station_id === stationId && x.category_id === categoryId)));
      } else {
        // Eine Kategorie kann an mehrere Stationen, aber hier single-assign bevorzugen:
        // zuerst bestehende Zuweisungen der Kategorie entfernen (single-assign Pattern)
        const toRemove = routing.filter((r) => r.category_id === categoryId);
        for (const t of toRemove) {
          await supabase.from('station_category_routing').delete()
            .eq('station_id', t.station_id).eq('category_id', t.category_id);
        }
        await supabase.from('station_category_routing').insert({
          station_id: stationId, category_id: categoryId,
        });
        setRouting((r) => [
          ...r.filter((x) => x.category_id !== categoryId),
          { station_id: stationId, category_id: categoryId },
        ]);
      }
    });
  }

  const displayUrl = (token: string) =>
    typeof window !== 'undefined' ? `${window.location.origin}/kitchen/display/${token}` : `/kitchen/display/${token}`;

  const unassignedCategories = categories.filter(
    (c) => !routing.some((r) => r.category_id === c.id),
  );

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      {unassignedCategories.length > 0 && stations.length > 0 && (
        <Card className="p-4 bg-amber-50 border-amber-200">
          <div className="text-sm text-amber-900">
            <strong>{unassignedCategories.length} Kategorien</strong> sind noch keiner Station zugeordnet — ihre Bestellungen gehen an keine Station.
            Zuweisung unten aktivieren.
          </div>
        </Card>
      )}

      {/* Stations List */}
      {stations.length === 0 ? (
        <Card className="p-10 text-center bg-gradient-to-br from-matcha-50/60 to-gold/10 border-matcha-200">
          <div className="mx-auto h-16 w-16 rounded-3xl bg-matcha-900 text-matcha-50 flex items-center justify-center mb-4">
            <ChefHat className="h-7 w-7" />
          </div>
          <h3 className="font-display text-2xl font-bold mb-2">Noch keine Stationen</h3>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            Leg mindestens eine Station an (z.B. <strong>Küche</strong>). Bei mehreren Stationen wird automatisch geroutet — z.B. Pasta → Küche, Cocktails → Bar.
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {PRESET_STATIONS.slice(0, 4).map((p) => (
              <button
                key={p.name}
                onClick={() => addStation(p)}
                disabled={pending}
                className="inline-flex items-center gap-2 h-11 px-4 rounded-xl border-2 bg-card hover:bg-muted text-sm font-semibold"
                style={{ borderColor: p.farbe }}
              >
                <span className="text-xl">{p.icon}</span> {p.name}
              </button>
            ))}
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {stations.map((s) => (
            <StationCard
              key={s.id}
              station={s}
              categories={categories}
              routing={routing}
              onToggleRoute={toggleRoute}
              onDelete={() => deleteStation(s.id)}
              displayUrl={displayUrl}
            />
          ))}

          {!adding ? (
            <button
              onClick={() => setAdding(true)}
              className="w-full h-16 rounded-2xl border-2 border-dashed text-muted-foreground hover:bg-muted/30 hover:text-foreground inline-flex items-center justify-center gap-2"
            >
              <Plus className="h-5 w-5" /> Weitere Station hinzufügen
            </button>
          ) : (
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-display font-bold">Station wählen</h4>
                <button onClick={() => setAdding(false)} className="h-8 w-8 rounded-full hover:bg-muted">
                  <X className="h-4 w-4 mx-auto" />
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PRESET_STATIONS.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => addStation(p)}
                    disabled={pending || stations.some((s) => s.name === p.name)}
                    className="inline-flex items-center gap-2 h-11 px-3 rounded-xl border bg-card hover:bg-muted text-sm font-semibold disabled:opacity-50"
                    style={{ borderColor: p.farbe }}
                  >
                    <span className="text-lg">{p.icon}</span> {p.name}
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function StationCard({
  station, categories, routing, onToggleRoute, onDelete, displayUrl,
}: {
  station: Station;
  categories: Category[];
  routing: Routing[];
  onToggleRoute: (stationId: string, categoryId: string) => void;
  onDelete: () => void;
  displayUrl: (t: string) => string;
}) {
  const [copied, setCopied] = useState(false);
  const assignedCats = categories.filter((c) => routing.some((r) => r.station_id === station.id && r.category_id === c.id));

  async function copy() {
    await navigator.clipboard.writeText(displayUrl(station.display_token));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-5 border-b" style={{ background: `${station.farbe}10` }}>
        <div
          className="h-12 w-12 rounded-2xl flex items-center justify-center text-2xl"
          style={{ background: station.farbe ?? '#14532d', color: 'white' }}
        >
          {station.icon ?? '👨‍🍳'}
        </div>
        <div className="flex-1">
          <div className="font-display text-xl font-bold">{station.name}</div>
          <div className="text-xs text-muted-foreground">
            {assignedCats.length} Kategorie{assignedCats.length !== 1 ? 'n' : ''} zugeordnet
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={copy}
            className="h-9 px-3 rounded-lg border bg-card hover:bg-muted text-xs font-semibold inline-flex items-center gap-1.5"
            title="Display-URL kopieren"
          >
            {copied ? <ExternalLink className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Kopiert' : 'Display-URL'}
          </button>
          <a
            href={displayUrl(station.display_token)}
            target="_blank"
            rel="noreferrer"
            className="h-9 px-3 rounded-lg bg-matcha-900 text-matcha-50 hover:bg-matcha-800 text-xs font-bold inline-flex items-center gap-1.5"
            title="Display öffnen"
          >
            <Monitor className="h-3.5 w-3.5" /> Öffnen
          </a>
          <button onClick={onDelete} className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-700" title="Löschen">
            <Trash2 className="h-3.5 w-3.5 mx-auto" />
          </button>
        </div>
      </div>

      {/* Categories */}
      <div className="p-5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
          Welche Kategorien landen auf diesem Display?
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => {
            const assigned = assignedCats.some((a) => a.id === c.id);
            const elsewhere = routing.find((r) => r.category_id === c.id && r.station_id !== station.id);
            return (
              <button
                key={c.id}
                onClick={() => onToggleRoute(station.id, c.id)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm font-semibold transition border-2',
                  assigned
                    ? 'text-white border-transparent'
                    : 'bg-card hover:bg-muted border-border text-foreground',
                )}
                style={assigned ? { background: station.farbe ?? '#14532d' } : undefined}
                title={elsewhere ? 'Wird einer anderen Station zugewiesen' : ''}
              >
                {c.icon} {c.name}
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
