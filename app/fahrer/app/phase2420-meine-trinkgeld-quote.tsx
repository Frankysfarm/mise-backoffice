'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Gift } from 'lucide-react';

interface FahrerTQ {
  fahrer_id: string;
  fahrer_name: string;
  trinkgeld_quote: number;
  quote_vw: number;
  trinkgeld_gesamt: number;
  bestellwert_gesamt: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiData {
  fahrer_single: FahrerTQ;
  team_avg_quote: number;
}

function ampelBg(a: string) {
  if (a === 'gruen') return 'bg-green-50 border-green-200 text-green-800';
  if (a === 'gelb') return 'bg-amber-50 border-amber-200 text-amber-800';
  return 'bg-red-50 border-red-200 text-red-800';
}

function quoteTextColor(a: string) {
  if (a === 'gruen') return 'text-green-600';
  if (a === 'gelb') return 'text-amber-500';
  return 'text-red-600';
}

function coachingTipp(f: FahrerTQ): string {
  if (f.alert_niedrig) return `Nur ${f.trinkgeld_quote.toFixed(1)} % Trinkgeld — Freundlicher Service und pünktliche Lieferung steigern die Quote.`;
  if (f.ampel === 'gruen') return `Sehr gut! ${f.trinkgeld_quote.toFixed(1)} % übertrifft das Ziel von 10 %. Kunden schätzen deinen Service!`;
  return `${f.trinkgeld_quote.toFixed(1)} % — Ziel ist 10 %. Kommunikation und sorgfältige Übergabe helfen.`;
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

export function FahrerPhase2420MeineTrinkgeldQuote({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!driverId || !locationId || !isOnline) return;
    try {
      const r = await fetch(
        `/api/delivery/admin/fahrer-trinkgeld-quote?location_id=${locationId}&driver_id=${driverId}`,
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
          <Gift size={16} className={quoteTextColor(f.ampel)} />
          <span className="font-semibold text-sm">
            Meine Trinkgeld-Quote — {f.trinkgeld_quote.toFixed(1)} %
          </span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="text-center py-2">
            <p className={`text-4xl font-black ${quoteTextColor(f.ampel)}`}>
              {f.trinkgeld_quote.toFixed(1)} %
            </p>
            <div className="flex items-center justify-center gap-1 mt-1">
              <TrendIcon trend={f.trend} />
              <span className="text-xs text-gray-600">
                {f.trend_delta !== 0
                  ? `${f.trend_delta > 0 ? '+' : ''}${f.trend_delta.toFixed(1)} % ggü. VW`
                  : 'Wie Vorwoche'}
              </span>
            </div>
          </div>

          <div className="relative h-3 rounded-full bg-gray-200">
            <div
              className={`absolute left-0 top-0 h-full rounded-full ${f.ampel === 'gruen' ? 'bg-green-500' : f.ampel === 'gelb' ? 'bg-amber-400' : 'bg-red-500'}`}
              style={{ width: `${Math.min(100, (f.trinkgeld_quote / 20) * 100)}%` }}
            />
            <div className="absolute top-0 h-full border-l-2 border-dashed border-gray-500" style={{ left: '25%' }} title="5 %" />
            <div className="absolute top-0 h-full border-l-2 border-dashed border-gray-700" style={{ left: '50%' }} title="10 %" />
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>0</span><span>5 %</span><span>10 %</span><span>20 %</span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'VW', value: `${f.quote_vw.toFixed(1)} %` },
              { label: 'Trend', value: f.trend === 'steigend' ? '↑' : f.trend === 'fallend' ? '↓' : '→' },
              { label: 'Ziel', value: '10 %' },
              { label: 'Team-Ø', value: `${data.team_avg_quote.toFixed(1)} %` },
            ].map(k => (
              <div key={k.label} className="bg-white/60 rounded-lg p-2 text-center">
                <p className="text-xs text-gray-500">{k.label}</p>
                <p className="text-xs font-bold text-gray-800">{k.value}</p>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-2 bg-white/60 rounded-lg p-2">
            <Gift size={12} className={`${quoteTextColor(f.ampel)} mt-0.5 shrink-0`} />
            <p className="text-xs text-gray-700">{coachingTipp(f)}</p>
          </div>

          <p className="text-xs text-gray-400 text-right">
            {f.trinkgeld_gesamt.toFixed(2)} € TG · {f.bestellwert_gesamt.toFixed(0)} € Bestellwert
          </p>
        </div>
      )}
    </div>
  );
}
