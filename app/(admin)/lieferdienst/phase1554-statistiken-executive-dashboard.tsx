'use client';

import React, { useEffect, useState } from 'react';

interface KpiData {
  umsatz_heute: number;
  lieferungen_heute: number;
  puenktlichkeit_pct: number;
  avg_lieferzeit_min: number;
  aktive_fahrer: number;
  stornos_heute: number;
  spitzenwert_stunde: number;
  trend_vs_gestern: number;
}

const MOCK: KpiData = {
  umsatz_heute: 2847.50,
  lieferungen_heute: 134,
  puenktlichkeit_pct: 87,
  avg_lieferzeit_min: 28,
  aktive_fahrer: 6,
  stornos_heute: 4,
  spitzenwert_stunde: 23,
  trend_vs_gestern: 12,
};

function TrendBadge({ pct }: { pct: number }) {
  if (pct > 0) return <span className="text-emerald-600 font-bold text-[10px]">▲ +{pct}%</span>;
  if (pct < 0) return <span className="text-rose-600 font-bold text-[10px]">▼ {pct}%</span>;
  return <span className="text-muted-foreground text-[10px]">± 0%</span>;
}

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  pulse?: boolean;
}

function KpiCard({ label, value, sub, color = 'bg-muted/30 border-border', pulse }: KpiCardProps) {
  return (
    <div className={`rounded-xl border p-3 ${color} flex flex-col gap-0.5`}>
      <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-xl font-black tabular-nums leading-tight ${pulse ? 'animate-pulse' : ''}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function LieferdienstPhase1554StatistikenExecutiveDashboard() {
  const [data, setData] = useState<KpiData>(MOCK);
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/delivery/admin/statistiken-executive');
        if (res.ok) setData(await res.json());
      } catch { /* use mock */ }
      setLoading(false);
    };
    load();
    const id = setInterval(load, 5 * 60_000);
    return () => clearInterval(id);
  }, []);

  if (!open) return null;

  const pctColor =
    data.puenktlichkeit_pct >= 90 ? 'text-emerald-600' :
    data.puenktlichkeit_pct >= 75 ? 'text-amber-600' : 'text-rose-600';

  return (
    <div className="rounded-xl border border-matcha-200 bg-white overflow-hidden mb-4">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-matcha-600 text-white">
        <span className="text-xs font-bold uppercase tracking-wider flex-1">
          Executive Dashboard · Heute
        </span>
        {loading && <span className="text-[10px] text-white/60 animate-pulse">Lädt…</span>}
        <TrendBadge pct={data.trend_vs_gestern} />
        <button onClick={() => setOpen(false)} className="text-base leading-none text-white/60 hover:text-white ml-2">×</button>
      </div>

      <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
        <KpiCard
          label="Umsatz"
          value={data.umsatz_heute.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
          sub={`Peak: ${data.spitzenwert_stunde}:00 Uhr`}
          color="bg-emerald-50 border-emerald-200"
        />
        <KpiCard
          label="Lieferungen"
          value={String(data.lieferungen_heute)}
          sub={`${data.stornos_heute} Storno${data.stornos_heute !== 1 ? 's' : ''}`}
          color="bg-matcha-50 border-matcha-200"
        />
        <KpiCard
          label="Pünktlichkeit"
          value={`${data.puenktlichkeit_pct}%`}
          sub={`Ziel: ≥90%`}
          color={data.puenktlichkeit_pct >= 90 ? 'bg-emerald-50 border-emerald-200' : data.puenktlichkeit_pct >= 75 ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200'}
          pulse={data.puenktlichkeit_pct < 75}
        />
        <KpiCard
          label="Ø Lieferzeit"
          value={`${data.avg_lieferzeit_min} Min`}
          sub={data.avg_lieferzeit_min <= 30 ? 'Im Ziel' : 'Über Ziel'}
          color={data.avg_lieferzeit_min <= 30 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}
        />
        <KpiCard
          label="Aktive Fahrer"
          value={String(data.aktive_fahrer)}
          sub="Online"
          color="bg-blue-50 border-blue-200"
        />
        <KpiCard
          label="Trend gg. gestern"
          value={`${data.trend_vs_gestern > 0 ? '+' : ''}${data.trend_vs_gestern}%`}
          sub="Umsatz-Vergleich"
          color={data.trend_vs_gestern >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}
        />
      </div>

      {/* Pünktlichkeits-Bar */}
      <div className="px-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold uppercase text-muted-foreground">Pünktlichkeits-Score</span>
          <span className={`text-[10px] font-black ${pctColor}`}>{data.puenktlichkeit_pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              data.puenktlichkeit_pct >= 90 ? 'bg-emerald-500' :
              data.puenktlichkeit_pct >= 75 ? 'bg-amber-400' : 'bg-rose-500'
            }`}
            style={{ width: `${data.puenktlichkeit_pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
