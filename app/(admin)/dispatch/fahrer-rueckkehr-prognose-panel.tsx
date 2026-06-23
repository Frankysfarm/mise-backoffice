'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Clock, RefreshCw, Bike, Car, Zap } from 'lucide-react';

interface FahrerRueckkehrPrognose {
  driverId: string;
  driverName: string | null;
  driverVehicle: 'bike' | 'car';
  batchId: string | null;
  minutesUntilReturn: number;
  remainingStops: number;
  totalStops: number;
  estimatedReturnUtc: string;
  confidence: number;
  residualCapacity: number;
  urgency: 'soon' | 'coming' | 'later';
}

interface ApiData {
  ok: boolean;
  prognosen: FahrerRueckkehrPrognose[];
  activeDrivers: number;
  returningWithin15Min: number;
  returningWithin30Min: number;
  avgMinutesUntilReturn: number;
}

interface Props {
  locationId: string | null;
}

const URGENCY_STYLE = {
  soon:   { bg: 'bg-matcha-50',  border: 'border-matcha-300',  badge: 'bg-matcha-500 text-white',   ring: 'bg-matcha-400',  label: 'Gleich' },
  coming: { bg: 'bg-amber-50',   border: 'border-amber-300',   badge: 'bg-amber-400 text-white',    ring: 'bg-amber-400',   label: 'Bald'   },
  later:  { bg: 'bg-muted/20',   border: 'border-border',      badge: 'bg-muted text-muted-foreground', ring: 'bg-muted-foreground', label: 'Später' },
};

function ConfidenceDots({ confidence }: { confidence: number }) {
  const dots = Math.round(confidence * 3);
  return (
    <div className="flex gap-0.5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cn('h-1.5 w-1.5 rounded-full', i < dots ? 'bg-matcha-500' : 'bg-muted/50')}
        />
      ))}
    </div>
  );
}

function ReturnRing({ minutesUntilReturn }: { minutesUntilReturn: number }) {
  const clampedMin = Math.min(minutesUntilReturn, 60);
  const pct = 1 - clampedMin / 60;
  const r = 18;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;
  const color = minutesUntilReturn <= 5 ? '#22c55e' : minutesUntilReturn <= 20 ? '#f59e0b' : '#9ca3af';

  return (
    <svg width={44} height={44} className="shrink-0 -rotate-90">
      <circle cx={22} cy={22} r={r} fill="none" stroke="#e5e7eb" strokeWidth={4} />
      <circle
        cx={22} cy={22} r={r}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
      />
      <text
        x={22} y={22}
        textAnchor="middle"
        dominantBaseline="central"
        className="rotate-90"
        style={{ fontSize: 9, fontWeight: 800, fill: color, transform: 'rotate(90deg)', transformOrigin: '22px 22px' }}
      >
        {minutesUntilReturn}m
      </text>
    </svg>
  );
}

export function DispatchFahrerRueckkehrPrognosePanel({ locationId }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  const load = () => {
    if (!locationId) { setLoading(false); return; }
    fetch(`/api/delivery/admin/fahrer-rueckkehr-prognose?location_id=${locationId}`)
      .then((r) => r.json())
      .then((d: ApiData) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 45_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (loading) return null;
  if (!data?.prognosen?.length) return null;

  const soon = data.returningWithin15Min;

  return (
    <Card className="overflow-hidden border-amber-200 bg-amber-50/20">
      <button
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b border-amber-200/60 hover:bg-amber-50/60 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <RefreshCw className="h-4 w-4 text-amber-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
          Fahrer-Rückkehr-Prognose
        </span>
        <Badge variant="secondary" className="bg-amber-100 text-amber-800 ml-1">
          {data.activeDrivers} Fahrer
        </Badge>
        {soon > 0 && (
          <Badge className="bg-matcha-500 text-white text-[9px] ml-1">
            {soon} kehren in 15 Min zurück
          </Badge>
        )}
        {open ? <ChevronUp className="ml-auto h-3 w-3 text-amber-500" /> : <ChevronDown className="ml-auto h-3 w-3 text-amber-500" />}
      </button>

      {open && (
        <>
          {/* Summary bar */}
          <div className="px-4 py-2 border-b border-amber-100/60 flex flex-wrap gap-3 text-[10px] font-bold">
            <span className="text-muted-foreground">
              Ø Rückkehr: <span className="text-foreground tabular-nums">{Math.round(data.avgMinutesUntilReturn)} Min</span>
            </span>
            <span className="text-muted-foreground">
              ≤15 Min: <span className="text-matcha-700 tabular-nums">{data.returningWithin15Min}</span>
            </span>
            <span className="text-muted-foreground">
              ≤30 Min: <span className="text-amber-700 tabular-nums">{data.returningWithin30Min}</span>
            </span>
          </div>

          {/* Driver cards */}
          <div className="p-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {data.prognosen.map((p) => {
              const s = URGENCY_STYLE[p.urgency];
              return (
                <div
                  key={p.driverId}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-3 py-2.5',
                    s.bg, s.border,
                  )}
                >
                  {/* Return ring */}
                  <ReturnRing minutesUntilReturn={p.minutesUntilReturn} />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs truncate text-foreground">
                        {p.driverName ?? 'Fahrer'}
                      </span>
                      {p.driverVehicle === 'car'
                        ? <Car className="h-3 w-3 text-muted-foreground shrink-0" />
                        : <Bike className="h-3 w-3 text-muted-foreground shrink-0" />}
                      <span className={cn('rounded-full px-1.5 py-0.5 text-[8px] font-black ml-auto', s.badge)}>
                        {s.label}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center gap-3 text-[9px] text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        {p.remainingStops} von {p.totalStops} Stopps
                      </span>
                      <ConfidenceDots confidence={p.confidence} />
                    </div>

                    {/* Residual capacity bar */}
                    {p.residualCapacity > 0 && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <Zap className="h-2.5 w-2.5 text-matcha-600 shrink-0" />
                        <div className="text-[9px] font-bold text-matcha-700">
                          +{p.residualCapacity} Stops Restkapazität
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-4 py-1.5 text-[9px] text-amber-400 border-t border-amber-100/60">
            Ring = verbleibende Zeit bis Basis · Punkte = Konfidenz · 45s Auto-Refresh
          </div>
        </>
      )}
    </Card>
  );
}
