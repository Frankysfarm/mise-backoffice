'use client';

import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, YAxis } from 'recharts';
import { BarChart3, TrendingUp, TrendingDown, Target, Users, Clock, Star, Euro, AlertTriangle, CheckCircle2, Bike } from 'lucide-react';
import { cn, euro } from '@/lib/utils';

interface Stats {
  umsatz_heute: number;
  umsatz_delta_pct: number;
  bestellungen_heute: number;
  bestellungen_delta_pct: number;
  avg_lieferzeit_min: number;
  puenktlichkeit_pct: number;
  fahrer_aktiv: number;
  bewertung_avg: number;
  storno_pct: number;
  profit_margin_pct: number;
  monatsziel_pct: number;
}

interface StundenPunkt { stunde: string; umsatz: number; bestellungen: number; }
interface FahrerRang { name: string; score: number; stopps: number; puenktl: number; umsatz: number; }
interface ZoneKpi { zone: string; sla_pct: number; avg_min: number; umsatz: number; kapaz_pct: number; }

const MOCK_STATS: Stats = {
  umsatz_heute: 1847.5, umsatz_delta_pct: 12.4,
  bestellungen_heute: 73, bestellungen_delta_pct: 8.1,
  avg_lieferzeit_min: 26.4, puenktlichkeit_pct: 91,
  fahrer_aktiv: 6, bewertung_avg: 4.6,
  storno_pct: 2.7, profit_margin_pct: 22.1,
  monatsziel_pct: 68,
};

const MOCK_STUNDEN: StundenPunkt[] = [
  { stunde: '10', umsatz: 82, bestellungen: 4 },
  { stunde: '11', umsatz: 145, bestellungen: 7 },
  { stunde: '12', umsatz: 312, bestellungen: 13 },
  { stunde: '13', umsatz: 285, bestellungen: 11 },
  { stunde: '14', umsatz: 178, bestellungen: 8 },
  { stunde: '15', umsatz: 96, bestellungen: 5 },
  { stunde: '16', umsatz: 124, bestellungen: 6 },
  { stunde: '17', umsatz: 241, bestellungen: 10 },
  { stunde: '18', umsatz: 384, bestellungen: 9 },
];

const MOCK_FAHRER: FahrerRang[] = [
  { name: 'Max K.', score: 92, stopps: 18, puenktl: 96, umsatz: 412 },
  { name: 'Lena S.', score: 79, stopps: 14, puenktl: 88, umsatz: 325 },
  { name: 'Tom B.', score: 61, stopps: 10, puenktl: 78, umsatz: 238 },
];

const MOCK_ZONEN: ZoneKpi[] = [
  { zone: 'Mitte', sla_pct: 94, avg_min: 24, umsatz: 641, kapaz_pct: 80 },
  { zone: 'Nord',  sla_pct: 88, avg_min: 28, umsatz: 497, kapaz_pct: 65 },
  { zone: 'Süd',   sla_pct: 75, avg_min: 34, umsatz: 392, kapaz_pct: 92 },
  { zone: 'West',  sla_pct: 91, avg_min: 26, umsatz: 318, kapaz_pct: 58 },
];

type Tab = 'heute' | 'fahrer' | 'zonen';

function KpiTile({ label, val, delta, warn }: { label: string; val: string; delta?: string; warn?: boolean }) {
  const isPos = delta?.startsWith('+');
  return (
    <div className={cn('rounded-lg bg-white/5 p-2', warn && 'bg-red-500/10')}>
      <div className={cn('text-sm font-bold', warn ? 'text-red-400' : 'text-white')}>{val}</div>
      <div className="text-[10px] text-white/40">{label}</div>
      {delta && <div className={cn('text-[10px]', isPos ? 'text-emerald-400' : 'text-red-400')}>{delta}</div>}
    </div>
  );
}

export function LieferdienstPhase5110StatistikenDashboardV29({ locationId }: { locationId: string | null }) {
  const [stats, setStats] = useState<Stats>(MOCK_STATS);
  const [stunden, setStunden] = useState<StundenPunkt[]>(MOCK_STUNDEN);
  const [fahrer, setFahrer] = useState<FahrerRang[]>(MOCK_FAHRER);
  const [zonen, setZonen] = useState<ZoneKpi[]>(MOCK_ZONEN);
  const [tab, setTab] = useState<Tab>('heute');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }
    async function load() {
      try {
        const res = await fetch(`/api/delivery/admin/stats-dashboard?location_id=${locationId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.stats) setStats(data.stats);
          if (data.stunden?.length) setStunden(data.stunden);
          if (data.fahrer?.length) setFahrer(data.fahrer);
          if (data.zonen?.length) setZonen(data.zonen);
        }
      } catch { /* keep mock */ }
      finally { setLoading(false); }
    }
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const monatColor = stats.monatsziel_pct >= 80 ? 'bg-emerald-400' : stats.monatsziel_pct >= 50 ? 'bg-amber-400' : 'bg-red-400';

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-teal-400" />
          <span className="text-sm font-semibold text-white">Statistiken Dashboard V29</span>
        </div>
        <div className="text-[10px] text-white/40">30s Polling</div>
      </div>

      {/* Monatsziel */}
      <div>
        <div className="flex items-center justify-between text-[10px] text-white/40 mb-1">
          <span>Monatsziel</span>
          <span>{stats.monatsziel_pct}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div className={cn('h-full rounded-full transition-all', monatColor)} style={{ width: `${stats.monatsziel_pct}%` }} />
        </div>
      </div>

      {/* 8-KPI-Grid */}
      <div className="grid grid-cols-4 gap-1.5">
        <KpiTile label="Umsatz" val={euro(stats.umsatz_heute)} delta={`${stats.umsatz_delta_pct >= 0 ? '+' : ''}${stats.umsatz_delta_pct}%`} />
        <KpiTile label="Bestellungen" val={String(stats.bestellungen_heute)} delta={`${stats.bestellungen_delta_pct >= 0 ? '+' : ''}${stats.bestellungen_delta_pct}%`} />
        <KpiTile label="Ø Lieferzeit" val={`${stats.avg_lieferzeit_min}min`} warn={stats.avg_lieferzeit_min > 35} />
        <KpiTile label="Pünktlich" val={`${stats.puenktlichkeit_pct}%`} warn={stats.puenktlichkeit_pct < 85} />
        <KpiTile label="Fahrer aktiv" val={String(stats.fahrer_aktiv)} />
        <KpiTile label="Bewertung" val={`★${stats.bewertung_avg}`} warn={stats.bewertung_avg < 4.0} />
        <KpiTile label="Storno" val={`${stats.storno_pct}%`} warn={stats.storno_pct > 5} />
        <KpiTile label="Marge" val={`${stats.profit_margin_pct}%`} />
      </div>

      {/* Tab-Nav */}
      <div className="flex gap-1">
        {(['heute', 'fahrer', 'zonen'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn('px-2 py-0.5 rounded text-xs transition-colors capitalize', tab === t ? 'bg-teal-500/30 text-teal-300' : 'text-white/40 hover:text-white/60')}
          >
            {t === 'heute' ? 'Stunden' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab-Inhalt */}
      {tab === 'heute' && (
        <div className="h-28">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stunden} barSize={12}>
              <XAxis dataKey="stunde" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 10 }}
                formatter={(v: unknown) => [euro(v as number), 'Umsatz']}
              />
              <Bar dataKey="umsatz" radius={[2, 2, 0, 0]}>
                {stunden.map((s, i) => (
                  <Cell key={i} fill={s.umsatz >= 300 ? '#34d399' : s.umsatz >= 150 ? '#fbbf24' : '#6366f1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {tab === 'fahrer' && (
        <div className="space-y-2">
          {fahrer.map((f, i) => (
            <div key={f.name} className="rounded-lg bg-white/5 p-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-white/40 w-4">{i + 1}.</span>
                <span className="text-xs text-white flex-1">{f.name}</span>
                <span className={cn('text-xs font-bold', f.score >= 80 ? 'text-emerald-400' : f.score >= 60 ? 'text-amber-400' : 'text-red-400')}>{f.score}</span>
              </div>
              <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden mb-1">
                <div className={cn('h-full rounded-full', f.score >= 80 ? 'bg-emerald-400' : f.score >= 60 ? 'bg-amber-400' : 'bg-red-400')} style={{ width: `${f.score}%` }} />
              </div>
              <div className="flex gap-3 text-[10px] text-white/40">
                <span>{f.stopps} Stopps</span>
                <span>{f.puenktl}% pünktl.</span>
                <span>{euro(f.umsatz)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'zonen' && (
        <div className="space-y-1.5">
          {zonen.map(z => (
            <div key={z.zone} className="rounded-lg bg-white/5 p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-white">{z.zone}</span>
                <span className={cn('text-xs font-bold', z.sla_pct >= 90 ? 'text-emerald-400' : z.sla_pct >= 75 ? 'text-amber-400' : 'text-red-400')}>SLA {z.sla_pct}%</span>
              </div>
              <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden mb-1">
                <div className={cn('h-full rounded-full', z.kapaz_pct >= 85 ? 'bg-red-400' : z.kapaz_pct >= 60 ? 'bg-amber-400' : 'bg-emerald-400')} style={{ width: `${z.kapaz_pct}%` }} />
              </div>
              <div className="flex gap-3 text-[10px] text-white/40">
                <span>Ø {z.avg_min}min</span>
                <span>{euro(z.umsatz)}</span>
                <span>Kap. {z.kapaz_pct}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
