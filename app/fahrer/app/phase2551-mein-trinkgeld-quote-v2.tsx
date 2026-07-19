'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Coins } from 'lucide-react';

interface SingleEntry {
  fahrer_id: string;
  fahrer_name: string;
  tip_rate_pct: number;
  tip_rate_pct_vw: number | null;
  tip_sum_eur: number;
  mit_trinkgeld_count: number;
  bestellungen_count: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface SingleData {
  fahrer_single: SingleEntry;
  team_avg_rate_pct: number;
}

function ampelStyle(pct: number) {
  if (pct < 10)  return { text: 'text-red-600',   bg: 'bg-red-50 border-red-200',    bar: 'bg-red-500',   label: 'Kritisch — Trinkgeld sehr niedrig' };
  if (pct < 20)  return { text: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', bar: 'bg-amber-400', label: 'Ausbaufähig — noch Potenzial' };
  return               { text: 'text-green-600',  bg: 'bg-green-50 border-green-200', bar: 'bg-green-500', label: 'Hervorragend — Kunden geben gerne Trinkgeld!' };
}

function coachingTipp(pct: number): string {
  if (pct < 10)  return 'Deine Trinkgeld-Quote liegt unter 10%. Achte auf freundlichen Kundenkontakt und eine sorgfältige Lieferung — das zahlt sich direkt aus.';
  if (pct < 20)  return 'Gute Basis! Mit einem Lächeln und pünktlicher Lieferung kannst du die 20%-Marke knacken.';
  return 'Fantastisch! Über 20% deiner Kunden geben dir Trinkgeld. Weiter so!';
}

function TrendIcon({ trend }: { trend: 'steigend' | 'fallend' | 'stabil' }) {
  if (trend === 'steigend') return <TrendingUp  size={14} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-red-500"  />;
  return <Minus size={14} className="text-gray-400" />;
}

const MOCK: SingleData = {
  fahrer_single: {
    fahrer_id: 'me',
    fahrer_name: 'Ich',
    tip_rate_pct: 14.3,
    tip_rate_pct_vw: 13.0,
    tip_sum_eur: 9.80,
    mit_trinkgeld_count: 3,
    bestellungen_count: 21,
    trend: 'steigend',
    trend_delta: 1.3,
    ampel: 'gelb',
  },
  team_avg_rate_pct: 15.1,
};

export function FahrerPhase2551MeinTrinkgeldQuoteV2({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<SingleData | null>(null);

  useEffect(() => {
    if (!isOnline) return;
    if (!locationId) { setData(MOCK); return; }
    const params = new URLSearchParams({ location_id: locationId });
    if (driverId) params.set('driver_id', driverId);
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-trinkgeld-quote-v2?${params}`)
        .then(r => r.json())
        .then((res: SingleData | { fahrer: SingleEntry[]; team_avg_rate_pct: number }) => {
          if ('fahrer_single' in res && res.fahrer_single) {
            setData(res as SingleData);
          } else if ('fahrer' in res && Array.isArray(res.fahrer) && res.fahrer.length > 0) {
            const all = res as { fahrer: SingleEntry[]; team_avg_rate_pct: number };
            const me  = driverId ? all.fahrer.find(f => f.fahrer_id === driverId) : null;
            setData({ fahrer_single: me ?? all.fahrer[0], team_avg_rate_pct: all.team_avg_rate_pct });
          } else {
            setData(MOCK);
          }
        })
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [driverId, locationId, isOnline]);

  if (!isOnline || !data) return null;

  const e  = data.fahrer_single;
  const st = ampelStyle(e.tip_rate_pct);
  const barW = Math.min(100, (e.tip_rate_pct / 50) * 100);

  return (
    <div className={`rounded-xl border ${st.bg} shadow-sm mb-3`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Coins size={16} className={e.ampel === 'gruen' ? 'text-green-600' : 'text-gray-400'} />
          <span className="font-semibold text-sm text-gray-800">Meine Trinkgeld-Quote</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${st.text}`}>{e.tip_rate_pct.toFixed(1)}%</span>
          {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Hauptwerte */}
          <div className="text-center py-2">
            <div className={`text-4xl font-black ${st.text}`}>{e.tip_rate_pct.toFixed(1)}%</div>
            <div className="text-sm font-semibold text-gray-700 mt-1">{e.tip_sum_eur.toFixed(2)} €</div>
            <div className="text-xs text-gray-500 mt-0.5">{st.label}</div>
          </div>

          {/* Balken */}
          <div className="relative h-3 rounded-full bg-gray-200">
            <div className={`absolute left-0 top-0 h-full rounded-full ${st.bar}`} style={{ width: `${barW}%` }} />
            <div className="absolute top-0 h-full border-l-2 border-dashed border-red-500"   style={{ left: `${(10 / 50) * 100}%` }} title="Alert <10%" />
            <div className="absolute top-0 h-full border-l border-dashed border-amber-400"   style={{ left: `${(20 / 50) * 100}%` }} title="Ziel ≥20%" />
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>0%</span>
            <span className="text-red-500">10%</span>
            <span className="text-amber-500">20%</span>
            <span>50%</span>
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-base font-bold text-gray-700">
                {e.tip_rate_pct_vw !== null ? `${e.tip_rate_pct_vw.toFixed(1)}%` : '—'}
              </div>
              <div className="text-xs text-gray-400">Vorwoche</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="flex items-center justify-center gap-1">
                <TrendIcon trend={e.trend} />
                <span className="text-base font-bold text-gray-700">
                  {e.trend_delta > 0 ? '+' : ''}{e.trend_delta.toFixed(1)}%
                </span>
              </div>
              <div className="text-xs text-gray-400">Trend</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-base font-bold text-green-600">≥20%</div>
              <div className="text-xs text-gray-400">Ziel</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-base font-bold text-gray-700">{data.team_avg_rate_pct.toFixed(1)}%</div>
              <div className="text-xs text-gray-400">Team Ø</div>
            </div>
          </div>

          {/* Bestellungsstatistik */}
          <div className="bg-white rounded-lg border border-gray-100 px-3 py-2 text-xs text-gray-600 text-center">
            {e.mit_trinkgeld_count} von {e.bestellungen_count} Bestellungen mit Trinkgeld
          </div>

          {/* Coaching */}
          <div className={`rounded-lg p-2.5 text-xs ${e.ampel === 'rot' ? 'bg-red-100 text-red-800' : e.ampel === 'gelb' ? 'bg-amber-50 text-amber-800' : 'bg-green-50 text-green-800'}`}>
            {coachingTipp(e.tip_rate_pct)}
          </div>
        </div>
      )}
    </div>
  );
}
