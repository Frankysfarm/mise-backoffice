'use client';

// Phase 1287 — Fahrer-Einsatz-Optimierer (Dispatch)
// Welche Fahrer sind unterausgelastet (<2 Stopps/h) und welche überausgelastet (>4 Stopps/h)
// Empfehlung zur Umverteilung · 5-Min-Polling · locationId-Prop

import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Gauge, Loader2, Users, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerAuslastung {
  fahrer_id: string;
  fahrer_name: string;
  aktive_stopps: number;
  schicht_stunden: number;
  stopps_pro_stunde: number;
  auslastung: 'unterausgelastet' | 'optimal' | 'ueberausgelastet';
  zone: string | null;
  empfehlung: string;
}

interface ApiResponse {
  fahrer: FahrerAuslastung[];
  unterausgelastet: number;
  ueberausgelastet: number;
  optimal: number;
  gesamt_stopps: number;
  location_id: string;
  generiert_am: string;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: '1', fahrer_name: 'Max M.',  aktive_stopps: 18, schicht_stunden: 3, stopps_pro_stunde: 6.0, auslastung: 'ueberausgelastet', zone: 'Mitte', empfehlung: 'Neue Touren kurzfristig pausieren' },
    { fahrer_id: '2', fahrer_name: 'Anna K.', aktive_stopps: 9,  schicht_stunden: 3, stopps_pro_stunde: 3.0, auslastung: 'optimal',           zone: 'Nord',  empfehlung: 'Auslastung ist optimal' },
    { fahrer_id: '3', fahrer_name: 'Tom S.',  aktive_stopps: 3,  schicht_stunden: 3, stopps_pro_stunde: 1.0, auslastung: 'unterausgelastet',  zone: 'West',  empfehlung: 'Weitere Stopps zuweisen' },
    { fahrer_id: '4', fahrer_name: 'Lisa W.', aktive_stopps: 15, schicht_stunden: 3, stopps_pro_stunde: 5.0, auslastung: 'ueberausgelastet', zone: 'Süd',   empfehlung: 'Stopps an Tom S. umleiten' },
    { fahrer_id: '5', fahrer_name: 'Jan B.',  aktive_stopps: 4,  schicht_stunden: 3, stopps_pro_stunde: 1.3, auslastung: 'unterausgelastet',  zone: 'Ost',   empfehlung: 'Kann 2–3 weitere Stopps übernehmen' },
  ],
  unterausgelastet: 2,
  ueberausgelastet: 2,
  optimal: 1,
  gesamt_stopps: 49,
  location_id: '',
  generiert_am: new Date().toISOString(),
};

const AUSL_STYLE: Record<FahrerAuslastung['auslastung'], { row: string; badge: string; label: string; bar: string }> = {
  unterausgelastet:  { row: 'bg-blue-50 dark:bg-blue-950/20',    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',     label: 'Unter',   bar: 'bg-blue-400' },
  optimal:           { row: 'bg-emerald-50 dark:bg-emerald-950/20', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', label: 'Optimal', bar: 'bg-emerald-500' },
  ueberausgelastet:  { row: 'bg-red-50 dark:bg-red-950/20',      badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',         label: 'Über',    bar: 'bg-red-500' },
};

export function DispatchPhase1287FahrerEinsatzOptimierer({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!locationId) { setData(MOCK); setLoading(false); return; }
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-einsatz-optimierer?location_id=${locationId}`);
      if (!r.ok) throw new Error();
      setData(await r.json());
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const hatProblem = data && (data.unterausgelastet > 0 || data.ueberausgelastet > 0);

  return (
    <div className={cn(
      'rounded-xl border shadow-sm overflow-hidden',
      hatProblem ? 'border-amber-300 dark:border-amber-700' : 'border-border',
    )}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
      >
        <Gauge className={cn('h-4 w-4 shrink-0', hatProblem ? 'text-amber-600' : 'text-matcha-600')} />
        <span className="flex-1 text-xs font-bold uppercase tracking-wider text-foreground">
          Fahrer-Einsatz-Optimierer
        </span>
        {data && (
          <div className="flex items-center gap-1.5">
            {data.ueberausgelastet > 0 && (
              <span className="rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 text-[10px] font-black px-2 py-0.5">
                {data.ueberausgelastet}× über
              </span>
            )}
            {data.unterausgelastet > 0 && (
              <span className="rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-[10px] font-black px-2 py-0.5">
                {data.unterausgelastet}× unter
              </span>
            )}
          </div>
        )}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-4 py-3 space-y-3">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analysiere Auslastung…
            </div>
          )}

          {!loading && data && (
            <>
              {/* Summary */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-red-50 dark:bg-red-950/20 p-2">
                  <div className="text-[9px] font-bold uppercase text-red-600 dark:text-red-400">Überlastet</div>
                  <div className="text-xl font-black text-red-600 dark:text-red-400 tabular-nums">{data.ueberausgelastet}</div>
                </div>
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 p-2">
                  <div className="text-[9px] font-bold uppercase text-emerald-600 dark:text-emerald-400">Optimal</div>
                  <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{data.optimal}</div>
                </div>
                <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 p-2">
                  <div className="text-[9px] font-bold uppercase text-blue-600 dark:text-blue-400">Unterlastet</div>
                  <div className="text-xl font-black text-blue-600 dark:text-blue-400 tabular-nums">{data.unterausgelastet}</div>
                </div>
              </div>

              {/* Driver list */}
              <div className="space-y-1.5">
                {data.fahrer
                  .sort((a, b) => {
                    const order = ['ueberausgelastet', 'unterausgelastet', 'optimal'];
                    return order.indexOf(a.auslastung) - order.indexOf(b.auslastung);
                  })
                  .map(f => {
                    const style = AUSL_STYLE[f.auslastung];
                    const barPct = Math.min(100, (f.stopps_pro_stunde / 6) * 100);
                    return (
                      <div key={f.fahrer_id} className={cn('rounded-lg border p-2.5', style.row, 'border-current/10')}>
                        <div className="flex items-center gap-2 mb-1">
                          <Users className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="text-xs font-bold text-foreground truncate flex-1">{f.fahrer_name}</span>
                          {f.zone && (
                            <span className="text-[9px] rounded-full bg-white/50 dark:bg-white/10 border px-1.5 py-0.5 font-bold text-muted-foreground">
                              {f.zone}
                            </span>
                          )}
                          <span className={cn('text-[9px] font-black rounded-full px-2 py-0.5', style.badge)}>
                            {style.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex-1 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                            <div
                              className={cn('h-full rounded-full transition-all', style.bar)}
                              style={{ width: `${barPct}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-black tabular-nums shrink-0 text-foreground">
                            {f.stopps_pro_stunde.toFixed(1)}/h
                          </span>
                        </div>
                        <div className="flex items-start gap-1 text-[10px] text-muted-foreground">
                          {(f.auslastung === 'ueberausgelastet' || f.auslastung === 'unterausgelastet') && (
                            <AlertTriangle className="h-3 w-3 shrink-0 mt-px text-amber-500" />
                          )}
                          {f.auslastung === 'optimal' && (
                            <Zap className="h-3 w-3 shrink-0 mt-px text-emerald-500" />
                          )}
                          <span>{f.empfehlung}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>

              <div className="text-[10px] text-muted-foreground text-right pt-1">
                {new Date(data.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · {data.gesamt_stopps} Stopps gesamt
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
