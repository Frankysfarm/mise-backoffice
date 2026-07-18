'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Euro } from 'lucide-react';

interface FahrerUPH {
  fahrer_id: string;
  fahrer_name: string;
  umsatz_pro_stunde: number;
  uph_vw: number;
  einnahmen: number;
  schichtdauer_h: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_ineffizient: boolean;
}

interface ApiData {
  fahrer_single: FahrerUPH;
  team_avg_uph: number;
}

function ampelBg(a: string) {
  if (a === 'gruen') return 'bg-green-50 border-green-200 text-green-800';
  if (a === 'gelb') return 'bg-amber-50 border-amber-200 text-amber-800';
  return 'bg-red-50 border-red-200 text-red-800';
}

function uphTextColor(a: string) {
  if (a === 'gruen') return 'text-green-600';
  if (a === 'gelb') return 'text-amber-500';
  return 'text-red-600';
}

function coachingTipp(f: FahrerUPH): string {
  if (f.alert_ineffizient) return `Nur ${f.umsatz_pro_stunde.toFixed(1)} €/h — Effizienz steigern: mehr Touren pro Stunde oder kürzere Routen wählen.`;
  if (f.ampel === 'gruen') return `Sehr gut! ${f.umsatz_pro_stunde.toFixed(1)} €/h übertrifft das Ziel von 12 €/h. Weiter so!`;
  return `${f.umsatz_pro_stunde.toFixed(1)} €/h — Ziel ist 12 €/h. Kürzere Lieferzeiten helfen.`;
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp size={14} className="text-green-600" />;
  if (trend === 'fallend') return <TrendingDown size={14} className="text-red-500" />;
  return <Minus size={14} className="text-gray-400" />;
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase2415MeinUmsatzProStunde({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!driverId || !locationId || !isOnline) return;
    try {
      const r = await fetch(
        `/api/delivery/admin/fahrer-umsatz-pro-stunde?location_id=${locationId}&driver_id=${driverId}`,
      );
      if (r.ok) setData(await r.json());
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [driverId, locationId, isOnline]);

  if (!isOnline || !data) return null;

  const f = data.fahrer_single;

  return (
    <div className={`rounded-xl border mb-3 ${ampelBg(f.ampel)}`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <Euro size={16} className={uphTextColor(f.ampel)} />
          <span className="font-semibold text-sm">
            Mein Umsatz/h — {f.umsatz_pro_stunde.toFixed(1)} €/h
          </span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="text-center py-2">
            <p className={`text-4xl font-black ${uphTextColor(f.ampel)}`}>
              {f.umsatz_pro_stunde.toFixed(1)} €/h
            </p>
            <div className="flex items-center justify-center gap-1 mt-1">
              <TrendIcon trend={f.trend} />
              <span className="text-xs text-gray-600">
                {f.trend_delta !== 0
                  ? `${f.trend_delta > 0 ? '+' : ''}${f.trend_delta.toFixed(1)} €/h ggü. VW`
                  : 'Wie Vorwoche'}
              </span>
            </div>
          </div>

          <div className="relative h-3 rounded-full bg-gray-200">
            <div
              className={`absolute left-0 top-0 h-full rounded-full ${f.ampel === 'gruen' ? 'bg-green-500' : f.ampel === 'gelb' ? 'bg-amber-400' : 'bg-red-500'}`}
              style={{ width: `${Math.min(100, (f.umsatz_pro_stunde / 20) * 100)}%` }}
            />
            <div className="absolute top-0 h-full border-l-2 border-dashed border-gray-500" style={{ left: '40%' }} title="8 €/h" />
            <div className="absolute top-0 h-full border-l-2 border-dashed border-gray-700" style={{ left: '60%' }} title="12 €/h" />
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>0</span><span>8 €/h</span><span>12 €/h</span><span>20 €/h</span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'VW', value: `${f.uph_vw.toFixed(1)} €/h` },
              { label: 'Trend', value: f.trend === 'steigend' ? '↑' : f.trend === 'fallend' ? '↓' : '→' },
              { label: 'Ziel', value: '12 €/h' },
              { label: 'Team-Ø', value: `${data.team_avg_uph.toFixed(1)} €/h` },
            ].map(k => (
              <div key={k.label} className="bg-white/60 rounded-lg p-2 text-center">
                <p className="text-xs text-gray-500">{k.label}</p>
                <p className="text-xs font-bold text-gray-800">{k.value}</p>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-2 bg-white/60 rounded-lg p-2">
            <Euro size={12} className={`${uphTextColor(f.ampel)} mt-0.5 shrink-0`} />
            <p className="text-xs text-gray-700">{coachingTipp(f)}</p>
          </div>

          <p className="text-xs text-gray-400 text-right">
            {f.einnahmen.toFixed(0)} € · {f.schichtdauer_h.toFixed(1)} h Schicht
          </p>
        </div>
      )}
    </div>
  );
}
