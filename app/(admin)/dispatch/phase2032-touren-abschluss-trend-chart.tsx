'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';

interface VerlaufTag {
  datum: string;
  gesamt: number;
  abgeschlossen: number;
  rate: number;
}

interface AbschlussData {
  ok: boolean;
  verlauf: VerlaufTag[];
  schnitt7d: number;
  heutRate: number | null;
  generatedAt: string;
}

const MOCK: AbschlussData = {
  ok: true,
  verlauf: [
    { datum: '2026-07-10', gesamt: 22, abgeschlossen: 20, rate: 90.9 },
    { datum: '2026-07-11', gesamt: 25, abgeschlossen: 24, rate: 96.0 },
    { datum: '2026-07-12', gesamt: 20, abgeschlossen: 17, rate: 85.0 },
    { datum: '2026-07-13', gesamt: 28, abgeschlossen: 27, rate: 96.4 },
    { datum: '2026-07-14', gesamt: 24, abgeschlossen: 23, rate: 95.8 },
    { datum: '2026-07-15', gesamt: 26, abgeschlossen: 25, rate: 96.2 },
    { datum: '2026-07-16', gesamt: 18, abgeschlossen: 17, rate: 94.4 },
  ],
  schnitt7d: 93.5,
  heutRate: 94.4,
  generatedAt: new Date().toISOString(),
};

const POLL_MS = 30 * 60 * 1000;

function buildSparkline(verlauf: VerlaufTag[]): string {
  if (verlauf.length < 2) return '';
  const rates = verlauf.map(v => v.rate);
  const min = Math.min(...rates);
  const max = Math.max(...rates);
  const range = Math.max(max - min, 5);
  const W = 120, H = 36;
  const pts = rates.map((r, i) => {
    const x = (i / (rates.length - 1)) * W;
    const y = H - ((r - min) / range) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return pts.join(' ');
}

export function DispatchPhase2032TourenAbschlussTrendChart({
  locationId,
  className,
}: {
  locationId: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<AbschlussData | null>(null);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/touren-abschluss-rate?location_id=${locationId}`);
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(MOCK);
      }
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [locationId]);

  const d = data ?? MOCK;
  const rate = d.heutRate ?? d.schnitt7d;
  const alertNiedrig = rate < 85;
  const trend = rate >= 93 ? 'up' : rate >= 87 ? 'gleich' : 'down';
  const sparkPts = buildSparkline(d.verlauf);

  const ringPct = Math.min(100, rate);
  const circ = 2 * Math.PI * 28;
  const dash = (ringPct / 100) * circ;
  const ringColor = rate >= 90 ? '#16a34a' : rate >= 85 ? '#d97706' : '#dc2626';

  return (
    <div className={cn('rounded-xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <CheckCircle2 className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="font-semibold text-sm flex-1">Touren-Abschluss-Rate (7 Tage)</span>
        {alertNiedrig && (
          <span className="flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
            <AlertTriangle className="h-3 w-3" /> &lt;85%
          </span>
        )}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {alertNiedrig && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-red-700 dark:text-red-300 text-xs font-semibold">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Abschlussrate kritisch niedrig — sofort prüfen!
            </div>
          )}

          <div className="flex items-center gap-6">
            {/* Ring */}
            <div className="shrink-0">
              <svg width="72" height="72" viewBox="0 0 72 72">
                <circle cx="36" cy="36" r="28" fill="none" stroke="currentColor" strokeWidth="7" className="text-muted/20" />
                <circle
                  cx="36" cy="36" r="28" fill="none"
                  stroke={ringColor} strokeWidth="7"
                  strokeDasharray={`${dash} ${circ - dash}`}
                  strokeLinecap="round"
                  transform="rotate(-90 36 36)"
                />
                <text x="36" y="40" textAnchor="middle" fontSize="13" fontWeight="bold" fill={ringColor}>
                  {rate.toFixed(1)}%
                </text>
              </svg>
            </div>

            {/* KPIs */}
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                Ø 7 Tage
                {trend === 'up' && <TrendingUp className="h-3 w-3 text-matcha-600" />}
                {trend === 'down' && <TrendingDown className="h-3 w-3 text-red-500" />}
                {trend === 'gleich' && <Minus className="h-3 w-3 text-muted-foreground" />}
                <span className="font-bold text-foreground">{d.schnitt7d.toFixed(1)}%</span>
              </div>
              {d.heutRate !== null && (
                <div className="text-xs text-muted-foreground">
                  Heute: <span className="font-semibold text-foreground">{d.heutRate.toFixed(1)}%</span>
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                {d.verlauf[d.verlauf.length - 1]?.abgeschlossen ?? '—'} /{' '}
                {d.verlauf[d.verlauf.length - 1]?.gesamt ?? '—'} Touren heute
              </div>
            </div>
          </div>

          {/* Sparkline */}
          {sparkPts && (
            <div>
              <div className="text-[10px] text-muted-foreground mb-1">Verlauf 7 Tage</div>
              <svg width="100%" viewBox="0 0 120 36" preserveAspectRatio="none" className="h-9">
                <polyline
                  points={sparkPts}
                  fill="none"
                  stroke={ringColor}
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {/* Reference line at 85% */}
                <line x1="0" y1="28.8" x2="120" y2="28.8" stroke="#dc2626" strokeWidth="0.8" strokeDasharray="3 2" opacity="0.5" />
              </svg>
              <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                <span>{d.verlauf[0]?.datum.slice(5)}</span>
                <span className="text-red-400">85%-Ziel</span>
                <span>{d.verlauf[d.verlauf.length - 1]?.datum.slice(5)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
