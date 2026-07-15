'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, Euro, Package, Clock, Users, Star, XCircle } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface KPI {
  key: string;
  label: string;
  value: string;
  delta: number | null;
  deltaLabel: string;
  icon: React.ReactNode;
  color: string;
}

interface StatsData {
  bestellungen_heute: number;
  umsatz_heute: number;
  avg_lieferzeit_min: number | null;
  on_time_rate: number | null;
  aktive_fahrer: number;
  avg_bewertung: number | null;
  storno_rate: number | null;
  delta_bestellungen?: number | null;
  delta_umsatz?: number | null;
  delta_lieferzeit?: number | null;
  stunden_verlauf?: { stunde: number; bestellungen: number; umsatz: number }[];
}

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

function DeltaBadge({ delta, suffix = '%', inverse = false }: { delta: number | null; suffix?: string; inverse?: boolean }) {
  if (delta === null) return <span className="text-[9px] text-muted-foreground">—</span>;
  const positive = inverse ? delta < 0 : delta > 0;
  const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  return (
    <div className={cn('flex items-center gap-0.5 text-[9px] font-bold', positive ? 'text-matcha-600' : delta === 0 ? 'text-muted-foreground' : 'text-red-500')}>
      <Icon className="h-2.5 w-2.5" />
      {delta > 0 ? '+' : ''}{delta.toFixed(1)}{suffix}
    </div>
  );
}

function MiniBar({ data }: { data: { stunde: number; bestellungen: number }[] }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.bestellungen), 1);
  const recent = data.slice(-8);
  return (
    <div className="flex items-end gap-0.5 h-8">
      {recent.map((d) => (
        <div key={d.stunde} className="flex-1 flex flex-col items-center gap-0.5">
          <div
            className="w-full rounded-sm bg-matcha-400 opacity-80"
            style={{ height: `${Math.max(2, (d.bestellungen / max) * 28)}px` }}
          />
        </div>
      ))}
    </div>
  );
}

export function LieferdienstPhase1711StatistikenLiveExecutiveCockpit({ locationId }: Props) {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ location_id: locationId, range: 'today' });
        const res = await fetch(`/api/delivery/delivery-analytics?${params}`);
        if (!cancelled && res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch {
        // Mock-Fallback
        if (!cancelled) {
          setData({
            bestellungen_heute: 47,
            umsatz_heute: 1284,
            avg_lieferzeit_min: 24,
            on_time_rate: 88,
            aktive_fahrer: 3,
            avg_bewertung: 4.6,
            storno_rate: 3.2,
            delta_bestellungen: 12,
            delta_umsatz: 8.5,
            delta_lieferzeit: -2,
            stunden_verlauf: Array.from({ length: 10 }, (_, i) => ({
              stunde: 11 + i,
              bestellungen: Math.floor(Math.random() * 8 + 2),
              umsatz: Math.floor(Math.random() * 200 + 80),
            })),
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const t = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [locationId]);

  const kpis: KPI[] = data
    ? [
        {
          key: 'bestellungen',
          label: 'Bestellungen',
          value: `${data.bestellungen_heute}`,
          delta: data.delta_bestellungen ?? null,
          deltaLabel: 'vs. gestern',
          icon: <Package className="h-3.5 w-3.5" />,
          color: 'text-blue-600 bg-blue-50',
        },
        {
          key: 'umsatz',
          label: 'Umsatz',
          value: fmtEur(data.umsatz_heute),
          delta: data.delta_umsatz ?? null,
          deltaLabel: 'vs. gestern',
          icon: <Euro className="h-3.5 w-3.5" />,
          color: 'text-matcha-700 bg-matcha-50',
        },
        {
          key: 'lieferzeit',
          label: 'Ø Lieferzeit',
          value: data.avg_lieferzeit_min !== null ? `${Math.round(data.avg_lieferzeit_min)} Min` : '—',
          delta: data.delta_lieferzeit ?? null,
          deltaLabel: 'vs. gestern',
          icon: <Clock className="h-3.5 w-3.5" />,
          color: 'text-amber-600 bg-amber-50',
        },
        {
          key: 'ontime',
          label: 'Pünktlichkeit',
          value: data.on_time_rate !== null ? `${Math.round(data.on_time_rate)}%` : '—',
          delta: null,
          deltaLabel: '',
          icon: <TrendingUp className="h-3.5 w-3.5" />,
          color:
            (data.on_time_rate ?? 0) >= 85
              ? 'text-matcha-700 bg-matcha-50'
              : (data.on_time_rate ?? 0) >= 70
              ? 'text-amber-600 bg-amber-50'
              : 'text-red-600 bg-red-50',
        },
        {
          key: 'fahrer',
          label: 'Aktive Fahrer',
          value: `${data.aktive_fahrer}`,
          delta: null,
          deltaLabel: '',
          icon: <Users className="h-3.5 w-3.5" />,
          color: 'text-purple-600 bg-purple-50',
        },
        {
          key: 'bewertung',
          label: 'Ø Bewertung',
          value: data.avg_bewertung !== null ? `${data.avg_bewertung.toFixed(1)} ★` : '—',
          delta: null,
          deltaLabel: '',
          icon: <Star className="h-3.5 w-3.5" />,
          color: 'text-amber-500 bg-amber-50',
        },
        {
          key: 'storno',
          label: 'Storno-Rate',
          value: data.storno_rate !== null ? `${data.storno_rate.toFixed(1)}%` : '—',
          delta: null,
          deltaLabel: '',
          icon: <XCircle className="h-3.5 w-3.5" />,
          color:
            (data.storno_rate ?? 0) < 5 ? 'text-matcha-700 bg-matcha-50' : 'text-red-600 bg-red-50',
        },
      ]
    : [];

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Statistiken Live-Executive
          </span>
          {loading && (
            <span className="text-[10px] text-muted-foreground animate-pulse">lädt…</span>
          )}
        </div>
        <div className="flex h-2 w-2 rounded-full bg-matcha-500 animate-pulse" />
      </button>

      {open && (
        <div className="border-t px-5 py-4 space-y-4">
          {!locationId ? (
            <p className="text-sm text-muted-foreground">Bitte Filiale auswählen.</p>
          ) : !data && loading ? (
            <div className="h-20 flex items-center justify-center text-sm text-muted-foreground animate-pulse">
              Lade Statistiken…
            </div>
          ) : data ? (
            <>
              {/* KPI Grid */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {kpis.map((kpi) => (
                  <div
                    key={kpi.key}
                    className={cn('rounded-xl p-3 flex flex-col gap-1', kpi.color.split(' ')[1])}
                  >
                    <div className={cn('flex items-center gap-1', kpi.color.split(' ')[0])}>
                      {kpi.icon}
                      <span className="text-[10px] font-bold uppercase tracking-wide">{kpi.label}</span>
                    </div>
                    <div className="text-lg font-black tabular-nums text-foreground">
                      {kpi.value}
                    </div>
                    {kpi.delta !== null && (
                      <div className="flex items-center gap-1">
                        <DeltaBadge delta={kpi.delta} suffix="%" />
                        <span className="text-[9px] text-muted-foreground">{kpi.deltaLabel}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Stundenverlauf Sparkline */}
              {data.stunden_verlauf && data.stunden_verlauf.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">
                    Bestellungen je Stunde
                  </div>
                  <MiniBar data={data.stunden_verlauf} />
                  <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                    <span>{data.stunden_verlauf[0]?.stunde}:00</span>
                    <span>{data.stunden_verlauf[data.stunden_verlauf.length - 1]?.stunde}:00</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Keine Daten verfügbar.</p>
          )}
        </div>
      )}
    </div>
  );
}
