'use client';

/**
 * DispatchNächsteZuweisung — Optimale Nächste-Zuweisung Panel
 *
 * Zeigt welcher Fahrer am besten für unzugewiesene Bestellungen geeignet ist.
 * Berechnet Entfernung zum Restaurant + freie Kapazität + Schicht-Zustand.
 * Pollt /api/delivery/dispatch/engine alle 30s.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle, Bike, CheckCircle2, Clock, Loader2, MapPin, Route, Sparkles, Zap } from 'lucide-react';

type AssignmentSuggestion = {
  driver_id: string;
  driver_name: string;
  vehicle: string | null;
  score: number;
  distance_m: number | null;
  eta_to_restaurant_min: number | null;
  pending_orders: number;
  on_tour: boolean;
  reason: string;
  orders: { id: string; bestellnummer: string; zone: string | null; betrag: number }[];
};

type EngineResponse = {
  suggestions: AssignmentSuggestion[];
  unassigned_count: number;
  ready_count: number;
  drivers_available: number;
  generatedAt: string;
};

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const color = pct >= 75 ? 'bg-matcha-400' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn(
        'text-[10px] font-black tabular-nums w-7 text-right',
        pct >= 75 ? 'text-matcha-300' : pct >= 50 ? 'text-amber-300' : 'text-red-300',
      )}>{Math.round(pct)}</span>
    </div>
  );
}

export function DispatchNächsteZuweisung({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<EngineResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/delivery/dispatch/engine?location_id=${locationId}&preview=true`,
          { cache: 'no-store' },
        );
        if (res.ok && !cancelled) {
          const d: EngineResponse = await res.json();
          setData(d);
          setLastUpdate(new Date());
        }
      } catch { /* noop */ } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const iv = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (!locationId) return null;

  const suggestions = data?.suggestions ?? [];
  const topSuggestion = suggestions[0] ?? null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/3 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/8">
        <Sparkles className="h-4 w-4 text-accent shrink-0" />
        <span className="text-xs font-black uppercase tracking-wider text-accent">
          Optimale Zuweisung
        </span>
        {loading && <Loader2 className="h-3.5 w-3.5 text-matcha-500 animate-spin ml-auto" />}
        {!loading && lastUpdate && (
          <span className="ml-auto text-[9px] text-matcha-500">
            {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      <div className="p-3 space-y-3">
        {/* KPI Row */}
        {data && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: AlertCircle, label: 'Wartend', value: data.unassigned_count, color: data.unassigned_count > 3 ? 'text-red-400' : 'text-matcha-200' },
              { icon: CheckCircle2, label: 'Bereit',  value: data.ready_count,      color: 'text-matcha-300' },
              { icon: Bike,        label: 'Verfügbar', value: data.drivers_available, color: data.drivers_available === 0 ? 'text-red-400' : 'text-matcha-300' },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="rounded-xl bg-white/5 border border-white/8 px-2.5 py-2 text-center">
                <Icon className={cn('h-3.5 w-3.5 mx-auto mb-0.5', color)} />
                <div className={cn('text-lg font-black tabular-nums leading-none', color)}>{value}</div>
                <div className="text-[9px] text-matcha-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Top suggestion */}
        {topSuggestion && (
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-accent shrink-0" />
              <span className="text-[10px] font-black uppercase tracking-wider text-accent">
                Beste Wahl
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-accent/20 border border-accent/30 flex items-center justify-center font-black text-accent text-sm shrink-0">
                {topSuggestion.driver_name[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-matcha-50 text-sm truncate">{topSuggestion.driver_name}</div>
                <div className="text-[10px] text-matcha-400 flex items-center gap-1">
                  <Bike className="h-2.5 w-2.5" />
                  {topSuggestion.vehicle ?? 'Fahrrad'}
                  {topSuggestion.pending_orders > 0 && (
                    <span className="text-amber-400 ml-1">· {topSuggestion.pending_orders} Stopp aktiv</span>
                  )}
                </div>
              </div>
              {topSuggestion.eta_to_restaurant_min != null && (
                <div className="shrink-0 text-right">
                  <div className="text-xs font-black text-accent tabular-nums">
                    {topSuggestion.eta_to_restaurant_min} Min
                  </div>
                  <div className="text-[9px] text-matcha-500">bis Restaurant</div>
                </div>
              )}
            </div>

            <ScoreBar score={topSuggestion.score} />

            <div className="text-[10px] text-matcha-400 italic leading-snug">{topSuggestion.reason}</div>

            {/* Bestellungen */}
            {topSuggestion.orders.length > 0 && (
              <div className="space-y-1">
                {topSuggestion.orders.map((o) => (
                  <div key={o.id} className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1">
                    <MapPin className="h-2.5 w-2.5 text-matcha-500 shrink-0" />
                    <span className="text-[10px] text-matcha-300 flex-1 truncate">#{o.bestellnummer}{o.zone ? ` · ${o.zone}` : ''}</span>
                    <span className="text-[10px] font-bold text-matcha-200 tabular-nums">
                      {o.betrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Weitere Optionen */}
        {suggestions.length > 1 && (
          <div className="space-y-1.5">
            <div className="text-[9px] font-black uppercase tracking-wider text-matcha-500 px-0.5">
              Weitere Fahrer
            </div>
            {suggestions.slice(1, 4).map((s) => (
              <div key={s.driver_id} className="flex items-center gap-2.5 rounded-xl bg-white/4 border border-white/8 px-3 py-2">
                <div className="h-6 w-6 rounded-lg bg-white/10 flex items-center justify-center font-bold text-matcha-300 text-xs shrink-0">
                  {s.driver_name[0]?.toUpperCase() ?? '?'}
                </div>
                <span className="flex-1 text-xs font-bold text-matcha-200 truncate">{s.driver_name}</span>
                {s.eta_to_restaurant_min != null && (
                  <span className="text-[10px] text-matcha-400 flex items-center gap-1 shrink-0">
                    <Clock className="h-2.5 w-2.5" />
                    {s.eta_to_restaurant_min} Min
                  </span>
                )}
                <div className="w-16 shrink-0">
                  <ScoreBar score={s.score} />
                </div>
              </div>
            ))}
          </div>
        )}

        {!data && !loading && (
          <div className="text-center py-4 text-matcha-500 text-xs">
            Keine Daten verfügbar
          </div>
        )}

        {suggestions.length === 0 && data && (
          <div className="flex items-center gap-2 rounded-xl bg-matcha-800/50 px-3 py-3">
            <CheckCircle2 className="h-4 w-4 text-matcha-400 shrink-0" />
            <div className="text-xs text-matcha-400">
              Keine offenen Zuweisungen — alles erledigt!
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
