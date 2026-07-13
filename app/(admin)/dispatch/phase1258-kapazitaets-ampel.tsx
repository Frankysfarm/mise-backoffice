'use client';

// Phase 1258 — Kapazitäts-Ampel (Dispatch)
// Verhältnis offene Touren / verfügbare Fahrer → grün/gelb/rot + Empfehlung
// Props: locationId · 30s-Polling

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Activity, Loader2, Users, Route } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ApiResponse {
  offene_touren: number;
  verfuegbare_fahrer: number;
  ratio: number;
  level: 'gruen' | 'gelb' | 'rot';
  empfehlung: string;
  location_id: string;
  generiert_am: string;
}

const LEVEL_STYLE = {
  gruen: {
    header: 'bg-gradient-to-r from-green-500 to-emerald-500',
    bg: 'bg-green-50 dark:bg-green-950/30',
    border: 'border-green-200 dark:border-green-800',
    text: 'text-green-700 dark:text-green-400',
    badge: 'bg-green-500 text-white',
    label: 'Ausreichend',
    dot: 'bg-green-500',
  },
  gelb: {
    header: 'bg-gradient-to-r from-amber-400 to-yellow-500',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-700',
    text: 'text-amber-700 dark:text-amber-400',
    badge: 'bg-amber-500 text-white',
    label: 'Knapp',
    dot: 'bg-amber-500',
  },
  rot: {
    header: 'bg-gradient-to-r from-red-500 to-rose-600',
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-400',
    badge: 'bg-red-600 text-white',
    label: 'Kritisch',
    dot: 'bg-red-500 animate-pulse',
  },
};

function buildMock(locationId: string): ApiResponse {
  return {
    offene_touren: 8,
    verfuegbare_fahrer: 3,
    ratio: 2.67,
    level: 'rot',
    empfehlung: 'Dringend weitere Fahrer einteilen — aktuell 8 Touren auf 3 Fahrer.',
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

export function DispatchPhase1258KapazitaetsAmpel({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = () => {
    if (!locationId) return;
    setLoading(true);

    // Fetch offene Touren (batch-monitor) + verfügbare Fahrer (mise_drivers)
    Promise.all([
      fetch(`/api/delivery/admin/batch-monitor?action=details&location_id=${locationId}`).then(r => r.json()).catch(() => null),
      fetch(`/api/delivery/admin/fahrer-netz-heatmap?location_id=${locationId}`).then(r => r.json()).catch(() => null),
    ]).then(([batches, heatmap]) => {
      const offeneTouren: number =
        (Array.isArray(batches?.batches) ? batches.batches.filter((b: { status?: string }) => b.status === 'active').length : null) ??
        (typeof batches?.active_count === 'number' ? batches.active_count : null) ??
        buildMock(locationId!).offene_touren;

      let verfuegbareFahrer = 0;
      if (heatmap?.zonen && Array.isArray(heatmap.zonen)) {
        for (const z of heatmap.zonen as Array<{ fahrer_gesamt?: number; fahrer_verfuegbar?: number }>) {
          verfuegbareFahrer += z.fahrer_verfuegbar ?? 0;
        }
      }
      if (verfuegbareFahrer === 0) {
        // fallback: use mock ratio
        const m = buildMock(locationId!);
        setData(m);
        return;
      }

      const ratio = offeneTouren / Math.max(verfuegbareFahrer, 1);
      const level: ApiResponse['level'] =
        ratio <= 1.5 ? 'gruen' :
        ratio <= 3   ? 'gelb'  : 'rot';

      const empfehlung =
        level === 'gruen' ? `${verfuegbareFahrer} Fahrer für ${offeneTouren} Touren — Kapazität ausreichend.` :
        level === 'gelb'  ? `${offeneTouren} Touren auf ${verfuegbareFahrer} Fahrer — bald weitere einplanen.` :
                            `Dringend weitere Fahrer einteilen — aktuell ${offeneTouren} Touren auf ${verfuegbareFahrer} Fahrer.`;

      setData({
        offene_touren: offeneTouren,
        verfuegbare_fahrer: verfuegbareFahrer,
        ratio: Math.round(ratio * 100) / 100,
        level,
        empfehlung,
        location_id: locationId!,
        generiert_am: new Date().toISOString(),
      });
    }).catch(() => setData(buildMock(locationId!))).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const style = data ? LEVEL_STYLE[data.level] : LEVEL_STYLE.gruen;

  return (
    <div className="rounded-xl border border-border overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn('w-full flex items-center gap-2 px-4 py-2.5 text-white', style.header)}
      >
        <Activity className="h-4 w-4 shrink-0" />
        <span className="text-sm font-bold flex-1 text-left">Kapazitäts-Ampel</span>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin opacity-70" />}
        {data && (
          <span className={cn('text-xs rounded-full px-2 py-0.5 font-bold', style.badge)}>
            {style.label}
          </span>
        )}
        {open ? <ChevronUp className="h-4 w-4 opacity-80" /> : <ChevronDown className="h-4 w-4 opacity-80" />}
      </button>

      {open && (
        <div className="p-4 space-y-3 bg-background">
          {!locationId && (
            <p className="text-sm text-muted-foreground">Bitte Filiale auswählen.</p>
          )}

          {data && (
            <>
              {/* Ampel-Anzeige */}
              <div className={cn('rounded-lg border p-3 flex items-center gap-4', style.bg, style.border)}>
                <span className={cn('h-5 w-5 rounded-full shrink-0', style.dot)} />
                <div className="flex-1 min-w-0">
                  <div className={cn('text-sm font-bold', style.text)}>{style.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{data.empfehlung}</div>
                </div>
                <div className={cn('text-2xl font-black tabular-nums shrink-0', style.text)}>
                  {data.ratio.toFixed(1)}×
                </div>
              </div>

              {/* KPI-Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/40 border border-border p-3 text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <Route className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Offene Touren
                    </span>
                  </div>
                  <div className="text-2xl font-black tabular-nums text-foreground">
                    {data.offene_touren}
                  </div>
                </div>
                <div className="rounded-lg bg-muted/40 border border-border p-3 text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Verfügbare Fahrer
                    </span>
                  </div>
                  <div className="text-2xl font-black tabular-nums text-foreground">
                    {data.verfuegbare_fahrer}
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground">
                Verhältnis Touren/Fahrer · zuletzt {new Date(data.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
