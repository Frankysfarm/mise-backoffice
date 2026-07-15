'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Zap, AlertTriangle, ChevronDown, ChevronUp, Clock } from 'lucide-react';

/**
 * Phase 1744 — Fahrer-Reaktionszeit-Widget (Dispatch)
 *
 * Phase1742-API: Ø Reaktionszeit je Fahrer + Ausreißer-Flagge
 * + Alert wenn Ø >5 Min; 20-Min-Polling; in dispatch/client.tsx.
 */

interface FahrerReaktionszeit {
  driver_id: string;
  fahrer_name: string;
  touren_heute: number;
  avg_reaktionszeit_sek: number;
  avg_reaktionszeit_min: number;
  max_reaktionszeit_sek: number;
  ausreisser_anzahl: number;
  alert: boolean;
}

interface ApiResponse {
  fahrer: FahrerReaktionszeit[];
  gesamt_avg_sek: number;
  gesamt_avg_min: number;
  ausreisser_gesamt: number;
}

interface Props {
  locationId: string | null;
}

function sekToLabel(sek: number): string {
  if (sek < 60) return `${sek}s`;
  const m = Math.floor(sek / 60);
  const s = sek % 60;
  return s > 0 ? `${m}m ${s}s` : `${m} Min`;
}

const MOCK: ApiResponse = {
  fahrer: [
    { driver_id: 'drv-1', fahrer_name: 'Mehmet A.', touren_heute: 5, avg_reaktionszeit_sek: 95,  avg_reaktionszeit_min: 1.6, max_reaktionszeit_sek: 180, ausreisser_anzahl: 0, alert: false },
    { driver_id: 'drv-2', fahrer_name: 'Julia S.',  touren_heute: 4, avg_reaktionszeit_sek: 340, avg_reaktionszeit_min: 5.7, max_reaktionszeit_sek: 540, ausreisser_anzahl: 2, alert: true  },
    { driver_id: 'drv-3', fahrer_name: 'Kevin R.',  touren_heute: 3, avg_reaktionszeit_sek: 120, avg_reaktionszeit_min: 2.0, max_reaktionszeit_sek: 200, ausreisser_anzahl: 0, alert: false },
    { driver_id: 'drv-4', fahrer_name: 'Lena T.',   touren_heute: 6, avg_reaktionszeit_sek: 70,  avg_reaktionszeit_min: 1.2, max_reaktionszeit_sek: 130, ausreisser_anzahl: 0, alert: false },
  ],
  gesamt_avg_sek: 156,
  gesamt_avg_min: 2.6,
  ausreisser_gesamt: 2,
};

export function DispatchPhase1744FahrerReaktionsteiWidget({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }

    const load = () => {
      fetch(`/api/delivery/admin/fahrer-reaktionszeit?location_id=${locationId}`, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(d => setData(d ?? MOCK))
        .catch(() => setData(MOCK));
    };
    load();
    const iv = setInterval(load, 20 * 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!data) return null;

  const alertFahrer = data.fahrer.filter(f => f.alert);
  const gesamtAlert = data.gesamt_avg_sek > 300;

  return (
    <div className={cn(
      'mx-4 mb-3 rounded-xl border overflow-hidden',
      gesamtAlert ? 'border-red-300 bg-red-50' : 'border-stone-200 bg-white',
    )}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-black/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="text-sm font-bold text-char">Fahrer-Reaktionszeit</span>
          <span className={cn(
            'text-xs font-bold px-2 py-0.5 rounded-full border',
            gesamtAlert
              ? 'bg-red-100 border-red-300 text-red-700'
              : 'bg-amber-50 border-amber-200 text-amber-700',
          )}>
            Ø {sekToLabel(data.gesamt_avg_sek)}
          </span>
          {alertFahrer.length > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-red-600">
              <AlertTriangle className="w-3 h-3" />
              {alertFahrer.length} Ausreißer
            </span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
      </button>

      {open && (
        <div className="border-t border-stone-200 px-4 py-3 space-y-2">
          {gesamtAlert && (
            <div className="flex items-center gap-2 bg-red-100 border border-red-300 rounded-lg px-3 py-2 text-xs font-bold text-red-700">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              Team-Reaktionszeit über 5 Min — Dispatch-Prozess prüfen!
            </div>
          )}
          <div className="space-y-1.5">
            {data.fahrer.map(f => {
              const barPct = Math.min(100, (f.avg_reaktionszeit_sek / 600) * 100);
              const barColor = f.alert ? 'bg-red-400' : f.avg_reaktionszeit_sek > 120 ? 'bg-amber-400' : 'bg-matcha-400';
              return (
                <div key={f.driver_id} className="flex items-center gap-2">
                  {f.alert
                    ? <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    : <Clock className="w-3.5 h-3.5 text-stone-400 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-semibold truncate text-char">{f.fahrer_name}</span>
                      <span className={cn('text-[10px] font-mono font-bold ml-2 shrink-0', f.alert ? 'text-red-600' : 'text-stone-600')}>
                        {sekToLabel(f.avg_reaktionszeit_sek)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${barPct}%` }} />
                      </div>
                      <span className="text-[9px] text-stone-400 shrink-0">{f.touren_heute} Touren</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="text-[9px] text-stone-400 pt-1 border-t border-stone-100">
            Reaktionszeit = Dispatch-Zuweisung → Tour-Start · Ausreißer &gt;5 Min
          </div>
        </div>
      )}
    </div>
  );
}
