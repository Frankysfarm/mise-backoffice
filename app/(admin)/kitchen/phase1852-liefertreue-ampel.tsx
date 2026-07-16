'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Target, TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * Phase 1852 — Liefertreue-Ampel (Kitchen)
 *
 * SLA-Quote heutiger Schicht aus /api/delivery/admin/liefertreue-monitor:
 *  ≥80% → grün  |  60–79% → gelb  |  <60% → rot
 * SVG-Torten-Segment für on-time / etwas spät / sehr spät.
 * 5-Min-Polling.
 */

interface SlaData {
  sla_quote: number;
  ontime: number;
  etwas_spaet: number;
  sehr_spaet: number;
  noch_offen: number;
  gesamt_abgeschlossen: number;
}

const MOCK: SlaData = {
  sla_quote: 78,
  ontime: 32,
  etwas_spaet: 7,
  sehr_spaet: 2,
  noch_offen: 3,
  gesamt_abgeschlossen: 41,
};

function ampelConfig(quote: number) {
  if (quote >= 80) return { label: 'Gut', farbe: 'text-matcha-700 dark:text-matcha-300', bg: 'bg-matcha-50 dark:bg-matcha-950/20', ring: 'stroke-matcha-500', dot: 'bg-matcha-500', border: 'border-matcha-200' };
  if (quote >= 60) return { label: 'Mittel', farbe: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-950/20', ring: 'stroke-amber-400', dot: 'bg-amber-400', border: 'border-amber-200' };
  return { label: 'Kritisch', farbe: 'text-red-700 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-950/20', ring: 'stroke-red-500', dot: 'bg-red-500 animate-pulse', border: 'border-red-200' };
}

function PieSegment({ quote, stroke }: { quote: number; stroke: string }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const dash = (quote / 100) * circ;
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" className="shrink-0">
      <circle cx="28" cy="28" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/20" />
      <circle
        cx="28" cy="28" r={r} fill="none"
        strokeWidth="6" strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round" transform="rotate(-90 28 28)"
        className={stroke}
      />
      <text x="28" y="32" textAnchor="middle" fontSize="10" fontWeight="800" className="fill-foreground">
        {quote}%
      </text>
    </svg>
  );
}

interface Props {
  locationId: string | null;
  className?: string;
}

export function KitchenPhase1852LiefertreueAmpel({ locationId, className }: Props) {
  const [offen, setOffen] = useState(true);
  const [data, setData] = useState<SlaData | null>(null);
  const [prevQuote, setPrevQuote] = useState<number | null>(null);

  useEffect(() => {
    if (!locationId) return;
    let alive = true;
    async function load() {
      try {
        const res = await fetch(`/api/delivery/admin/liefertreue-monitor?location_id=${locationId}`);
        if (res.ok && alive) {
          const j = await res.json();
          setData((prev) => {
            if (prev) setPrevQuote(prev.sla_quote);
            return j;
          });
        }
      } catch {
        if (alive) setData(MOCK);
      }
    }
    load();
    const id = setInterval(load, 5 * 60_000);
    return () => { alive = false; clearInterval(id); };
  }, [locationId]);

  const cfg = useMemo(() => ampelConfig(data?.sla_quote ?? 80), [data]);

  if (!locationId) return null;
  const d = data ?? MOCK;

  const trend = prevQuote === null ? null : d.sla_quote > prevQuote ? 'up' : d.sla_quote < prevQuote ? 'down' : 'flat';

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <Target className={cn('h-4 w-4 shrink-0', cfg.farbe)} />
        <span className="text-xs font-bold uppercase tracking-wider">Liefertreue-Ampel</span>
        <span className={cn('ml-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black', cfg.bg, cfg.farbe)}>
          <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
          {cfg.label} · {d.sla_quote}%
        </span>
        <div className="ml-auto flex items-center gap-1">
          {trend === 'up' && <TrendingUp className="h-3.5 w-3.5 text-matcha-500" />}
          {trend === 'down' && <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
          {trend === 'flat' && <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
          {offen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {offen && (
        <div className="px-4 py-3">
          <div className="flex items-center gap-4">
            <PieSegment quote={d.sla_quote} stroke={cfg.ring} />
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 flex-1">
              {[
                { label: 'On-Time', val: d.ontime, color: 'text-matcha-600' },
                { label: 'Etwas spät', val: d.etwas_spaet, color: 'text-amber-600' },
                { label: 'Sehr spät', val: d.sehr_spaet, color: 'text-red-600' },
                { label: 'Noch offen', val: d.noch_offen, color: 'text-muted-foreground' },
              ].map(({ label, val, color }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">{label}</span>
                  <span className={cn('text-xs font-black tabular-nums', color)}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* SLA-Fortschrittsbalken */}
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>SLA-Ziel 80%</span>
              <span>{d.gesamt_abgeschlossen} Lieferungen heute</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', d.sla_quote >= 80 ? 'bg-matcha-500' : d.sla_quote >= 60 ? 'bg-amber-400' : 'bg-red-500')}
                style={{ width: `${Math.min(100, d.sla_quote)}%` }}
              />
            </div>
            <div className="flex justify-end">
              <div className="h-3 w-px bg-border" style={{ marginLeft: `calc(${Math.min(80, 100)}% - 1px)` }} />
            </div>
          </div>

          <p className="mt-2 text-[9px] text-muted-foreground text-right">Alle 5 Min aktualisiert · SLA = Lieferung &lt;30 Min</p>
        </div>
      )}
    </div>
  );
}
