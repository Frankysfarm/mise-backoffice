'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Star, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerSingle {
  fahrer_id: string;
  fahrer_name: string;
  feiertag_h: number;
  feiertag_h_vw: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_ueberlastung: boolean;
}

interface ApiData {
  fahrer_single: FahrerSingle;
  team_avg_feiertag_h: number;
}

function fmtH(h: number) {
  return `${h.toFixed(1)}h`;
}

function ampelStyle(a: string) {
  if (a === 'gruen') return { bg: 'bg-teal-50 border-teal-200', text: 'text-teal-700', bar: 'bg-teal-400' };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', bar: 'bg-amber-400' };
  return { bg: 'bg-red-50 border-red-200', text: 'text-red-700', bar: 'bg-red-500' };
}

function coachingTipp(ampel: string): string {
  if (ampel === 'gruen') return 'Keine Feiertagsschicht dieses Jahr — du hast deine freien Tage gut genutzt!';
  if (ampel === 'gelb') return '1–8h Feiertagsschicht. Achte darauf, dass Feiertagszuschläge korrekt erfasst sind.';
  return 'Mehr als 8h Feiertagsschicht — Überlastungsrisiko! Bitte Teamleitung informieren und Ausgleich einplanen.';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp size={13} className="text-red-500" />;
  if (trend === 'fallend') return <TrendingDown size={13} className="text-green-600" />;
  return <Minus size={13} className="text-gray-400" />;
}

export function FahrerPhase2448MeineFeiertagsschicht({
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
      fetch(`/api/delivery/admin/fahrer-feiertagsschicht?location_id=${locationId}&driver_id=${driverId}`)
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
  const maxH = 12;
  const barPct = Math.min(100, (f.feiertag_h / maxH) * 100);
  const ziel8Pct = (8 / maxH) * 100;

  return (
    <div className={`border rounded-xl mb-3 overflow-hidden ${style.bg}`}>
      <button
        className={`w-full flex items-center justify-between px-4 py-2 font-semibold text-sm ${style.text}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center gap-2">
          <Star size={14} />
          Meine Feiertagsschicht
          {f.alert_ueberlastung && (
            <span className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">!</span>
          )}
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="bg-white px-4 pb-3 pt-2 space-y-3">
          {/* Big value */}
          <div className="text-center">
            <span className={`text-3xl font-bold ${style.text}`}>{fmtH(f.feiertag_h)}</span>
            <p className="text-xs text-gray-400 mt-0.5">Feiertagsschicht (gesetzliche Feiertage)</p>
          </div>

          {/* Progress bar */}
          <div className="relative h-3 rounded-full bg-gray-200">
            <div className={`absolute left-0 top-0 h-full rounded-full ${style.bar}`} style={{ width: `${barPct}%` }} />
            <div
              className="absolute top-0 h-full border-l-2 border-dashed border-red-400"
              style={{ left: `${ziel8Pct}%` }}
              title=">8h Alert"
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>0h</span>
            <span className="text-red-400">8h</span>
            <span>{maxH}h</span>
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-4 gap-1.5 text-center">
            {[
              { label: 'Vorjahr', val: fmtH(f.feiertag_h_vw) },
              { label: 'Trend', val: <TrendIcon trend={f.trend} /> },
              { label: 'Ziel', val: '0h', color: 'text-green-600' },
              { label: 'Team-Ø', val: fmtH(data.team_avg_feiertag_h) },
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
