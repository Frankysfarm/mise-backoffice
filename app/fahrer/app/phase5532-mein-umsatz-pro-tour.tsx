'use client';

import { useEffect, useRef, useState } from 'react';
import { Euro, TrendingUp, TrendingDown, Minus, WifiOff } from 'lucide-react';

// Phase 5532 — Mein Umsatz pro Tour (Fahrer)
// Euro green-400; avg_umsatz large+Rang; isOnline-Guard+WifiOff-Fallback;
// Coaching ≥40€/≥30€/<30€; Dual-Balken Ich+Team-Ø; Ampel-Border; 30-Min-Polling; Mock-Fallback

type Ampel = 'gruen' | 'gelb' | 'rot';

interface MyData {
  rang: number;
  avg_umsatz: number;
  team_avg_umsatz: number;
  rank_delta: number;
  ampel: Ampel;
  alert_niedrig: boolean;
  gesamt: number;
}

const MOCK: MyData = {
  rang: 2,
  avg_umsatz: 38.2,
  team_avg_umsatz: 33.7,
  rank_delta: 1,
  ampel: 'gruen',
  alert_niedrig: false,
  gesamt: 4,
};

const BORDER: Record<Ampel, string> = {
  rot:   'border-red-500/50',
  gelb:  'border-yellow-500/50',
  gruen: 'border-green-500/50',
};

function DeltaIcon({ d }: { d: number }) {
  if (d > 0) return <TrendingUp  className="h-3.5 w-3.5 text-green-400" />;
  if (d < 0) return <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
  return <Minus className="h-3.5 w-3.5 text-gray-500" />;
}

function coaching(v: number): { text: string; color: string } {
  if (v >= 40) return { text: 'Top-Umsatz! Deine Touren bringen viel Erlös — weiter so!', color: 'text-green-400' };
  if (v >= 30) return { text: 'Guter Schnitt — mit etwas mehr Effizienz erreichst du die Spitze!', color: 'text-yellow-400' };
  return { text: 'Tipp: Kürzere Wartezeiten und optimierte Routen steigern deinen Tour-Umsatz.', color: 'text-red-400' };
}

function fmtEur(v: number): string {
  return `${v.toFixed(2)} €`;
}

export function FahrerPhase5532MeinUmsatzProTour({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<MyData>(MOCK);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!isOnline || !driverId) return;
    try {
      const r = await fetch(
        `/api/delivery/admin/fahrer-umsatz-pro-tour-ranking?driver_id=${driverId}${locationId ? `&location_id=${locationId}` : ''}`,
      );
      if (r.ok) {
        const json = await r.json();
        if (json.fahrer_single) {
          setData({
            rang:            json.fahrer_single.rang,
            avg_umsatz:      json.fahrer_single.avg_umsatz,
            team_avg_umsatz: json.team_avg_umsatz,
            rank_delta:      json.fahrer_single.rank_delta ?? 0,
            ampel:           json.fahrer_single.ampel,
            alert_niedrig:   json.fahrer_single.alert_niedrig,
            gesamt:          json.gesamt,
          });
        } else if (json.fahrer) {
          const me = json.fahrer.find((f: { fahrer_id: string }) => f.fahrer_id === driverId);
          if (me) setData({
            rang:            me.rang,
            avg_umsatz:      me.avg_umsatz,
            team_avg_umsatz: json.team_avg_umsatz,
            rank_delta:      me.rank_delta,
            ampel:           me.ampel,
            alert_niedrig:   me.alert_niedrig,
            gesamt:          json.gesamt,
          });
        }
      }
    } catch { /* use mock */ }
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 30 * 60_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId, locationId, isOnline]);

  if (!isOnline) {
    return (
      <div className="rounded-lg bg-gray-900 border border-gray-700/50 p-3 flex items-center gap-2">
        <WifiOff className="h-4 w-4 text-gray-500" />
        <span className="text-xs text-gray-500">Umsatz / Tour — offline nicht verfügbar</span>
      </div>
    );
  }

  const c      = coaching(data.avg_umsatz);
  const maxBar = Math.max(data.avg_umsatz, data.team_avg_umsatz, 1);

  return (
    <div className={`rounded-lg bg-gray-900 border ${BORDER[data.ampel]} p-3 space-y-2.5`}>
      <div className="flex items-center gap-1.5">
        <Euro className="h-3.5 w-3.5 text-green-400" />
        <span className="text-xs font-semibold text-white">Mein Umsatz / Tour</span>
        <span className="text-[10px] text-gray-500 ml-auto">30 Tage</span>
      </div>
      <div className="flex items-end gap-3">
        <span className="text-3xl font-bold text-green-400 leading-none">{fmtEur(data.avg_umsatz)}</span>
        <div className="flex items-center gap-1 mb-0.5">
          <span className="text-[10px] text-gray-400">Rang {data.rang}/{data.gesamt}</span>
          <DeltaIcon d={data.rank_delta} />
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-10">Ich</span>
          <div className="flex-1 h-1.5 rounded-full bg-gray-800">
            <div
              className="h-1.5 rounded-full bg-green-400 transition-all duration-500"
              style={{ width: `${(data.avg_umsatz / maxBar) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-green-400 w-16 text-right">{fmtEur(data.avg_umsatz)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-10">Team-Ø</span>
          <div className="flex-1 h-1.5 rounded-full bg-gray-800">
            <div
              className="h-1.5 rounded-full bg-gray-500 transition-all duration-500"
              style={{ width: `${(data.team_avg_umsatz / maxBar) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-gray-400 w-16 text-right">{fmtEur(data.team_avg_umsatz)}</span>
        </div>
      </div>
      <p className={`text-[10px] leading-snug ${c.color}`}>{c.text}</p>
    </div>
  );
}
