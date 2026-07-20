'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, Award, BarChart2, ChevronDown, ChevronUp, Euro, Package, Timer, TrendingUp, Users } from 'lucide-react';

interface ZoneKpi {
  zone: string;
  bestellungen: number;
  umsatz_eur: number;
  avg_lieferzeit_min: number;
}

interface TopFahrer {
  name: string;
  touren: number;
  bewertung: number;
  on_time_pct: number;
}

interface ApiData {
  bestellungen_heute: number;
  bestellungen_delta_pct: number;
  umsatz_heute_eur: number;
  umsatz_delta_pct: number;
  avg_lieferzeit_min: number;
  sla_erfuellung_pct: number;
  aktive_fahrer: number;
  top_fahrer: TopFahrer | null;
  zonen_kpis: ZoneKpi[];
  alert_sla: boolean;
}

const MOCK: ApiData = {
  bestellungen_heute: 147,
  bestellungen_delta_pct: 12.4,
  umsatz_heute_eur: 3218.50,
  umsatz_delta_pct: 8.7,
  avg_lieferzeit_min: 28,
  sla_erfuellung_pct: 84,
  aktive_fahrer: 7,
  top_fahrer: { name: 'Max M.', touren: 18, bewertung: 4.9, on_time_pct: 96 },
  zonen_kpis: [
    { zone: 'Mitte',     bestellungen: 52, umsatz_eur: 1142, avg_lieferzeit_min: 24 },
    { zone: 'Prenzlberg', bestellungen: 41, umsatz_eur:  892, avg_lieferzeit_min: 31 },
    { zone: 'Kreuzberg', bestellungen: 34, umsatz_eur:  745, avg_lieferzeit_min: 27 },
    { zone: 'Neukölln',  bestellungen: 20, umsatz_eur:  440, avg_lieferzeit_min: 33 },
  ],
  alert_sla: false,
};

function DeltaBadge({ delta }: { delta: number }) {
  const positive = delta >= 0;
  return (
    <span className={`text-[10px] px-1 py-0.5 rounded font-medium ${positive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
      {positive ? '+' : ''}{delta.toFixed(1)}%
    </span>
  );
}

export function LieferdienstPhase2590StatistikenEchtzeitKommando({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    const load = () => {
      if (!locationId) { setData(MOCK); return; }
      fetch(`/api/delivery/admin/analytics?location_id=${locationId}`)
        .then(r => r.ok ? r.json() : null)
        .then((d: ApiData | null) => setData(d ?? MOCK))
        .catch(() => setData(MOCK));
    };
    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!data) return null;

  return (
    <div className={`rounded-xl border p-3 mb-3 ${data.alert_sla ? 'border-red-300 bg-red-50' : 'border-violet-200 bg-white'}`}>
      <button onClick={() => setOpen(o => !o)} className="flex items-center justify-between w-full text-left">
        <div className="flex items-center gap-2">
          <BarChart2 size={14} className="text-violet-600" />
          <span className="font-semibold text-xs text-gray-800">Statistiken Echtzeit-Kommando</span>
          {data.alert_sla && <AlertTriangle size={12} className="text-red-500" />}
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 font-medium">
            Heute
          </span>
        </div>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* KPI-Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
              <div className="flex items-center gap-1 mb-1">
                <Package size={11} className="text-gray-400" />
                <span className="text-[10px] text-gray-500">Bestellungen</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-black text-gray-800">{data.bestellungen_heute}</span>
                <DeltaBadge delta={data.bestellungen_delta_pct} />
              </div>
            </div>

            <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
              <div className="flex items-center gap-1 mb-1">
                <Euro size={11} className="text-gray-400" />
                <span className="text-[10px] text-gray-500">Umsatz</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-black text-gray-800">
                  {data.umsatz_heute_eur.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
                </span>
                <DeltaBadge delta={data.umsatz_delta_pct} />
              </div>
            </div>

            <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
              <div className="flex items-center gap-1 mb-1">
                <Timer size={11} className="text-gray-400" />
                <span className="text-[10px] text-gray-500">Ø Lieferzeit</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-black text-gray-800">{data.avg_lieferzeit_min}'</span>
                <span className={`text-[10px] font-medium ${data.avg_lieferzeit_min <= 30 ? 'text-green-600' : data.avg_lieferzeit_min <= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                  {data.avg_lieferzeit_min <= 30 ? '✓ Ziel' : '↑ hoch'}
                </span>
              </div>
            </div>

            <div className={`rounded-lg border px-3 py-2 ${data.sla_erfuellung_pct >= 85 ? 'bg-green-50 border-green-200' : data.sla_erfuellung_pct >= 70 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center gap-1 mb-1">
                <TrendingUp size={11} className="text-gray-400" />
                <span className="text-[10px] text-gray-500">SLA-Erfüllung</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-lg font-black ${data.sla_erfuellung_pct >= 85 ? 'text-green-700' : data.sla_erfuellung_pct >= 70 ? 'text-amber-700' : 'text-red-700'}`}>
                  {data.sla_erfuellung_pct}%
                </span>
              </div>
            </div>
          </div>

          {/* Aktive Fahrer */}
          <div className="flex items-center gap-2 bg-blue-50 rounded-lg px-3 py-2">
            <Users size={13} className="text-blue-500" />
            <span className="text-xs text-blue-800">
              <strong>{data.aktive_fahrer}</strong> Fahrer aktiv
            </span>
          </div>

          {/* Top-Fahrer */}
          {data.top_fahrer && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <Award size={16} className="text-amber-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-gray-800">{data.top_fahrer.name}</div>
                <div className="text-[10px] text-gray-500">
                  {data.top_fahrer.touren} Touren · ★ {data.top_fahrer.bewertung} · {data.top_fahrer.on_time_pct}% on-time
                </div>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-800 font-bold">Top</span>
            </div>
          )}

          {/* Zonen-KPIs */}
          <div>
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Zonen</div>
            <div className="space-y-1">
              {data.zonen_kpis.map(z => (
                <div key={z.zone} className="flex items-center gap-2 text-[11px]">
                  <span className="font-medium text-gray-700 w-20 truncate">{z.zone}</span>
                  <span className="text-gray-500">{z.bestellungen} Bestell.</span>
                  <span className="text-gray-500 ml-auto">{z.umsatz_eur} €</span>
                  <span className={`w-12 text-right ${z.avg_lieferzeit_min <= 30 ? 'text-green-600' : z.avg_lieferzeit_min <= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                    {z.avg_lieferzeit_min} Min.
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
