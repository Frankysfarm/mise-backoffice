'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Map, ChevronDown, ChevronUp, Loader2, AlertTriangle } from 'lucide-react';

/**
 * Phase 958 — Echtzeit-Zonenauslastung-Board (Dispatch)
 *
 * Heatmap Bestelldichte je Zone A/B/C/D mit Kapazitäts-Alert.
 * 60s-Polling auf /api/delivery/admin/zonen-auslastung-live.
 */

interface ZoneAuslastung {
  zone: string;
  aktive_bestellungen: number;
  kapazitaet_max: number;
  auslastung_pct: number;
  fahrer_verfuegbar: number;
  fahrer_gesamt: number;
  status: 'ok' | 'hoch' | 'kritisch';
  letzteBestellung: string | null;
}

interface ApiResponse {
  zonen: ZoneAuslastung[];
  generatedAt: string;
}

interface Props {
  locationId: string | null;
}

const ZONE_FARBEN: Record<string, string> = {
  A: 'bg-emerald-500',
  B: 'bg-sky-500',
  C: 'bg-violet-500',
  D: 'bg-amber-500',
};

const STATUS_FARBEN: Record<string, string> = {
  ok: 'bg-green-100 border-green-200 text-green-700',
  hoch: 'bg-amber-100 border-amber-200 text-amber-700',
  kritisch: 'bg-red-100 border-red-200 text-red-700',
};

function minutenSeit(iso: string | null): string {
  if (!iso) return '–';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min <= 0) return 'gerade eben';
  if (min === 1) return 'vor 1 Min';
  return `vor ${min} Min`;
}

export function DispatchPhase958ZonenAuslastungBoard({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }

    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/zonen-auslastung-live?location_id=${locationId}`);
        if (res.ok) setData(await res.json());
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    };

    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [locationId]);

  const kritischeZonen = data?.zonen.filter((z) => z.status === 'kritisch') ?? [];

  return (
    <section className="mb-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Map className="h-5 w-5 text-violet-600" />
          <span className="font-semibold text-stone-800">Zonen-Auslastung Live</span>
          {kritischeZonen.length > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
              <AlertTriangle className="h-3 w-3" />
              Zone {kritischeZonen.map((z) => z.zone).join(', ')} KRITISCH
            </span>
          )}
        </div>
        {collapsed ? <ChevronDown className="h-4 w-4 text-stone-400" /> : <ChevronUp className="h-4 w-4 text-stone-400" />}
      </button>

      {!collapsed && (
        <div className="mt-3">
          {loading && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
            </div>
          )}

          {!loading && data && (
            <div className="space-y-3">
              {/* Heatmap-Grid */}
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {data.zonen.map((z) => (
                  <div
                    key={z.zone}
                    className={cn('rounded-xl border p-3', STATUS_FARBEN[z.status])}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold">Zone {z.zone}</span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-semibold',
                          z.status === 'ok' && 'bg-green-200 text-green-800',
                          z.status === 'hoch' && 'bg-amber-200 text-amber-800',
                          z.status === 'kritisch' && 'bg-red-200 text-red-800',
                        )}
                      >
                        {z.auslastung_pct}%
                      </span>
                    </div>

                    {/* Füllstands-Balken */}
                    <div className="mt-2 h-2 w-full rounded-full bg-black/10">
                      <div
                        className={cn(
                          'h-2 rounded-full transition-all',
                          ZONE_FARBEN[z.zone] ?? 'bg-stone-500',
                          z.status === 'kritisch' && 'animate-pulse',
                        )}
                        style={{ width: `${z.auslastung_pct}%` }}
                      />
                    </div>

                    <div className="mt-2 space-y-0.5 text-xs">
                      <div className="flex justify-between">
                        <span>Bestellungen</span>
                        <span className="font-semibold">{z.aktive_bestellungen}/{z.kapazitaet_max}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Fahrer frei</span>
                        <span className={cn('font-semibold', z.fahrer_verfuegbar === 0 && z.status !== 'ok' && 'text-red-600')}>
                          {z.fahrer_verfuegbar}/{z.fahrer_gesamt}
                        </span>
                      </div>
                      <div className="flex justify-between opacity-70">
                        <span>Letzte Bestellung</span>
                        <span>{minutenSeit(z.letzteBestellung)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-right text-xs text-stone-400">
                Stand: {new Date(data.generatedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · 60s-Polling
              </p>
            </div>
          )}

          {!loading && !data && (
            <p className="text-center text-sm text-stone-400">Keine Daten verfügbar</p>
          )}
        </div>
      )}
    </section>
  );
}
