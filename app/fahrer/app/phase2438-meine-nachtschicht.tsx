'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Moon, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerSingle {
  fahrer_id: string;
  fahrer_name: string;
  nacht_h: number;
  nacht_h_vw: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_erschoepfung: boolean;
}

interface ApiData {
  fahrer_single: FahrerSingle;
  team_avg_nacht_h: number;
}

function fmtH(h: number) {
  return `${h.toFixed(1)}h`;
}

function ampelStyle(a: string) {
  if (a === 'gruen') return { bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700', bar: 'bg-indigo-400' };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', bar: 'bg-amber-400' };
  return { bg: 'bg-red-50 border-red-200', text: 'text-red-700', bar: 'bg-red-500' };
}

function coachingTipp(ampel: string): string {
  if (ampel === 'gruen') return 'Keine Nachtschicht heute — gut für deine Erholung!';
  if (ampel === 'gelb') return 'Bis zu 4h Nachtschicht. Achte auf ausreichend Schlaf danach.';
  return 'Mehr als 4h Nachtschicht — Erschöpfungsrisiko! Bitte nach der Schicht ausreichend ruhen und Teamleitung informieren.';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp size={13} className="text-red-500" />;
  if (trend === 'fallend') return <TrendingDown size={13} className="text-green-600" />;
  return <Minus size={13} className="text-gray-400" />;
}

export function FahrerPhase2438MeineNachtschicht({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!driverId || !locationId || !isOnline) return;
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-nachtschicht?location_id=${locationId}&driver_id=${driverId}`)
        .then(r => r.json())
        .then(setData)
        .catch(console.error);
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [driverId, locationId, isOnline]);

  if (!isOnline || !data?.fahrer_single) return null;

  const f = data.fahrer_single;
  const style = ampelStyle(f.ampel);
  const maxH = 8;
  const barPct = Math.min(100, (f.nacht_h / maxH) * 100);
  const ziel4Pct = (4 / maxH) * 100;

  return (
    <div className={`border rounded-xl mb-3 overflow-hidden ${style.bg}`}>
      <button
        className={`w-full flex items-center justify-between px-4 py-2 font-semibold text-sm ${style.text}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center gap-2">
          <Moon size={14} />
          Meine Nachtschicht
          {f.alert_erschoepfung && (
            <span className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">!</span>
          )}
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="bg-white px-4 pb-3 pt-2 space-y-3">
          {/* Big value */}
          <div className="text-center">
            <span className={`text-3xl font-bold ${style.text}`}>{fmtH(f.nacht_h)}</span>
            <p className="text-xs text-gray-400 mt-0.5">Nachtschicht (22–06 Uhr)</p>
          </div>

          {/* Progress bar */}
          <div className="relative h-3 rounded-full bg-gray-200">
            <div className={`absolute left-0 top-0 h-full rounded-full ${style.bar}`} style={{ width: `${barPct}%` }} />
            <div
              className="absolute top-0 h-full border-l-2 border-dashed border-red-400"
              style={{ left: `${ziel4Pct}%` }}
              title="+4h Alert"
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>0h</span>
            <span className="text-red-400">4h</span>
            <span>{maxH}h</span>
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-4 gap-1.5 text-center">
            {[
              { label: 'Vorwoche', val: fmtH(f.nacht_h_vw) },
              { label: 'Trend', val: <TrendIcon trend={f.trend} /> },
              { label: 'Ziel', val: '0h', color: 'text-green-600' },
              { label: 'Team-Ø', val: fmtH(data.team_avg_nacht_h) },
            ].map((k, i) => (
              <div key={i} className="bg-gray-50 rounded-lg py-1 px-1">
                <div className="text-xs text-gray-400">{k.label}</div>
                <div className={`font-bold text-sm ${k.color ?? 'text-gray-700'} flex items-center justify-center`}>{k.val}</div>
              </div>
            ))}
          </div>

          {/* Coaching Tipp */}
          <div className={`text-xs rounded-lg px-3 py-2 border ${style.bg} ${style.text}`}>
            💡 {coachingTipp(f.ampel)}
          </div>
        </div>
      )}
    </div>
  );
}
