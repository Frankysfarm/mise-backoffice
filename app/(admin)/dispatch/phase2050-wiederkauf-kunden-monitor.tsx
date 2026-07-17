'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Users, ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface TopKunde {
  customer_id: string;
  name: string;
  bestellungen_heute: number;
  bestellungen_gesamt_30d: number;
}

interface WiederkaufData {
  stammkunden_anteil: number;
  neukunden_anteil: number;
  stammkunden_count: number;
  neukunden_count: number;
  gesamt_kunden: number;
  trend_vs_vormonat: number;
  alert_sinkend: boolean;
  top5_heute: TopKunde[];
}

const MOCK: WiederkaufData = {
  stammkunden_anteil: 62,
  neukunden_anteil: 38,
  stammkunden_count: 124,
  neukunden_count: 76,
  gesamt_kunden: 200,
  trend_vs_vormonat: 4,
  alert_sinkend: false,
  top5_heute: [
    { customer_id: 'c1', name: 'Maria S.', bestellungen_heute: 3, bestellungen_gesamt_30d: 18 },
    { customer_id: 'c2', name: 'Klaus H.', bestellungen_heute: 2, bestellungen_gesamt_30d: 14 },
    { customer_id: 'c3', name: 'Julia M.', bestellungen_heute: 2, bestellungen_gesamt_30d: 11 },
    { customer_id: 'c4', name: 'Peter W.', bestellungen_heute: 1, bestellungen_gesamt_30d: 9 },
    { customer_id: 'c5', name: 'Anna K.', bestellungen_heute: 1, bestellungen_gesamt_30d: 8 },
  ],
};

const POLL_MS = 30 * 60 * 1000;

export function DispatchPhase2050WiederkaufKundenMonitor({
  locationId,
  className,
}: {
  locationId: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<WiederkaufData | null>(null);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/kunden-wiederkauf-rate?location_id=${locationId}`);
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(MOCK);
      }
    };
    load();
    const iv = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  const d = data ?? MOCK;

  const ringPct = d.stammkunden_anteil;
  const circumference = 2 * Math.PI * 18;
  const strokeDashoffset = circumference * (1 - ringPct / 100);

  return (
    <div className={cn('rounded-xl border border-gray-800 bg-gray-900 overflow-hidden', className)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-100 hover:bg-gray-800 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Users className="w-4 h-4 text-purple-400" />
          Wiederkauf-Monitor
          {d.alert_sinkend && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-red-900 text-red-300">
              Anteil sinkt
            </span>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {d.alert_sinkend && (
            <div className="flex items-center gap-2 rounded-lg bg-red-950 border border-red-800 px-3 py-2 text-xs text-red-300">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              Stammkundenanteil um {Math.abs(d.trend_vs_vormonat)}% gesunken — Kundenbindung prüfen
            </div>
          )}

          <div className="flex items-center gap-4">
            <svg className="w-12 h-12 shrink-0 -rotate-90" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="18" fill="none" stroke="#374151" strokeWidth="4" />
              <circle
                cx="20" cy="20" r="18" fill="none"
                stroke={d.alert_sinkend ? '#ef4444' : '#a855f7'}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-700"
              />
            </svg>
            <div className="grid grid-cols-2 gap-2 flex-1">
              <div className="rounded-lg bg-gray-800 px-2 py-1.5 text-center">
                <div className="text-sm font-bold text-purple-300">{d.stammkunden_anteil}%</div>
                <div className="text-[10px] text-gray-400">Stammkunden</div>
              </div>
              <div className="rounded-lg bg-gray-800 px-2 py-1.5 text-center">
                <div className="text-sm font-bold text-gray-200">{d.neukunden_anteil}%</div>
                <div className="text-[10px] text-gray-400">Neukunden</div>
              </div>
              <div className="rounded-lg bg-gray-800 px-2 py-1.5 text-center">
                <div className="text-sm font-bold text-gray-200">{d.stammkunden_count}</div>
                <div className="text-[10px] text-gray-400">Stammkunden</div>
              </div>
              <div className="rounded-lg bg-gray-800 px-2 py-1.5 text-center col-span-1 flex items-center justify-center gap-1">
                <span className={cn(
                  'text-sm font-bold flex items-center gap-0.5',
                  d.trend_vs_vormonat > 0 ? 'text-green-400' : d.trend_vs_vormonat < 0 ? 'text-red-400' : 'text-gray-400',
                )}>
                  {d.trend_vs_vormonat > 0 ? <TrendingUp className="w-3 h-3" /> :
                   d.trend_vs_vormonat < 0 ? <TrendingDown className="w-3 h-3" /> :
                   <Minus className="w-3 h-3" />}
                  {d.trend_vs_vormonat > 0 ? '+' : ''}{d.trend_vs_vormonat}%
                </span>
                <div className="text-[10px] text-gray-400">vs. Vm.</div>
              </div>
            </div>
          </div>

          {d.top5_heute.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Top-5 aktiv heute</div>
              {d.top5_heute.map((k, i) => (
                <div key={k.customer_id} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-gray-300">
                    <span className="text-gray-600 w-3">{i + 1}.</span>
                    {k.name}
                  </span>
                  <span className="flex items-center gap-2 text-gray-400">
                    <span className="font-semibold text-purple-300">{k.bestellungen_heute}x heute</span>
                    <span className="text-gray-600">·</span>
                    <span>{k.bestellungen_gesamt_30d}x/30d</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
