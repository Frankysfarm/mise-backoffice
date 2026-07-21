'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Euro, Package, Star, Timer, TrendingUp, Zap } from 'lucide-react';

interface KpiData {
  bestellungen: number;
  umsatz_eur: number;
  avg_liefer_min: number;
  on_time_pct: number;
  storno_pct: number;
  aktive_fahrer: number;
  trend_bestellungen: number;
  trend_umsatz: number;
}

interface HourlySlot {
  stunde: number;
  bestellungen: number;
  umsatz_eur: number;
}

interface ApiData {
  kpi: KpiData;
  hourly: HourlySlot[];
  alerts: string[];
}

interface Props {
  locationId?: string | null;
}

const MOCK: ApiData = {
  kpi: {
    bestellungen: 47,
    umsatz_eur: 1284,
    avg_liefer_min: 28,
    on_time_pct: 83,
    storno_pct: 3,
    aktive_fahrer: 4,
    trend_bestellungen: 12,
    trend_umsatz: 8,
  },
  hourly: [
    { stunde: 11, bestellungen: 3, umsatz_eur: 82 },
    { stunde: 12, bestellungen: 8, umsatz_eur: 218 },
    { stunde: 13, bestellungen: 11, umsatz_eur: 301 },
    { stunde: 14, bestellungen: 6, umsatz_eur: 164 },
    { stunde: 15, bestellungen: 4, umsatz_eur: 109 },
    { stunde: 16, bestellungen: 3, umsatz_eur: 82 },
    { stunde: 17, bestellungen: 7, umsatz_eur: 191 },
    { stunde: 18, bestellungen: 5, umsatz_eur: 137 },
  ],
  alerts: [],
};

function ampel(val: number, warn: number, crit: number, invert = false): string {
  if (invert) {
    if (val <= crit) return 'text-green-600';
    if (val <= warn) return 'text-amber-600';
    return 'text-red-600';
  }
  if (val >= warn) return 'text-green-600';
  if (val >= crit) return 'text-amber-600';
  return 'text-red-600';
}

export function LieferdienstPhase2615StatistikDashboardFinal({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);
  const [mode, setMode] = useState<'bestellungen' | 'umsatz'>('bestellungen');

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/statistiken-heute?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 5 * 60_000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const { kpi, hourly, alerts } = data;
  const maxVal = Math.max(...hourly.map(h => mode === 'umsatz' ? h.umsatz_eur : h.bestellungen), 1);

  const kpis = [
    { label: 'Bestellungen', val: kpi.bestellungen, trend: kpi.trend_bestellungen, icon: <Package size={12} />, color: 'text-indigo-600' },
    { label: 'Umsatz',       val: `€${kpi.umsatz_eur}`, trend: kpi.trend_umsatz, icon: <Euro size={12} />, color: 'text-emerald-600' },
    { label: 'Ø Lieferzeit', val: `${kpi.avg_liefer_min} Min`, trend: null, icon: <Timer size={12} />, color: ampel(kpi.avg_liefer_min, 30, 40, true) },
    { label: 'Pünktlichkeit', val: `${kpi.on_time_pct}%`, trend: null, icon: <Zap size={12} />, color: ampel(kpi.on_time_pct, 80, 60) },
    { label: 'Storno',       val: `${kpi.storno_pct}%`, trend: null, icon: <AlertTriangle size={12} />, color: ampel(kpi.storno_pct, 5, 10, true) },
    { label: 'Akt. Fahrer',  val: kpi.aktive_fahrer, trend: null, icon: <Star size={12} />, color: 'text-blue-600' },
  ];

  return (
    <div className={`rounded-xl border p-4 mb-4 ${alerts.length > 0 ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-indigo-500" />
          <span className="font-semibold text-sm text-gray-800">Statistiken Heute — Final</span>
          {alerts.length > 0 && <AlertTriangle size={14} className="text-red-500" />}
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Alert Strip */}
          {alerts.map((a, i) => (
            <div key={i} className="bg-red-100 border border-red-300 rounded-lg p-2 text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle size={12} /> {a}
            </div>
          ))}

          {/* KPI Grid */}
          <div className="grid grid-cols-3 gap-2">
            {kpis.map(k => (
              <div key={k.label} className="bg-gray-50 rounded-xl p-2.5 text-center">
                <div className="flex items-center justify-center gap-0.5 text-gray-400 mb-1">
                  {k.icon}
                  <span className="text-[9px]">{k.label}</span>
                </div>
                <div className={`text-base font-black ${k.color}`}>{k.val}</div>
                {k.trend !== null && (
                  <div className={`text-[9px] mt-0.5 font-semibold ${k.trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {k.trend >= 0 ? '↑' : '↓'} {Math.abs(k.trend)}% vs. gestern
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Hourly Chart */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Stundenverlauf</span>
              <div className="flex rounded-lg overflow-hidden border border-gray-200">
                {(['bestellungen', 'umsatz'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`px-2 py-0.5 text-[9px] font-semibold transition-colors ${mode === m ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500'}`}
                  >
                    {m === 'bestellungen' ? 'Bestellungen' : 'Umsatz'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-end gap-1 h-16">
              {hourly.map(h => {
                const val = mode === 'umsatz' ? h.umsatz_eur : h.bestellungen;
                const pct = (val / maxVal) * 100;
                const currentHour = new Date().getHours();
                const isCurrent = h.stunde === currentHour;
                return (
                  <div key={h.stunde} className="flex-1 flex flex-col items-center gap-0.5">
                    <div className="w-full flex items-end h-12">
                      <div
                        className={`w-full rounded-t transition-all ${isCurrent ? 'bg-indigo-500' : 'bg-indigo-200'}`}
                        style={{ height: `${pct}%`, minHeight: pct > 0 ? 2 : 0 }}
                      />
                    </div>
                    <span className="text-[8px] text-gray-400">{h.stunde}h</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SLA Indicators */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Lieferzeit ≤30 Min', ok: kpi.avg_liefer_min <= 30 },
              { label: 'Pünktlichkeit ≥80%', ok: kpi.on_time_pct >= 80 },
              { label: 'Storno ≤5%',          ok: kpi.storno_pct <= 5 },
              { label: 'Fahrer online',        ok: kpi.aktive_fahrer > 0 },
            ].map(s => (
              <div key={s.label} className={`flex items-center gap-1.5 rounded-lg p-2 text-[10px] font-medium ${s.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${s.ok ? 'bg-green-500' : 'bg-red-500'}`} />
                {s.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
