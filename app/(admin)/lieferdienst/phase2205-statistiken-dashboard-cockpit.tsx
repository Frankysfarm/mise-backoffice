'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Euro, Package, Clock, Star, Bike, Target } from 'lucide-react';

interface DashStats {
  heuteUmsatz: number;
  heuteBestellungen: number;
  heuteStornos: number;
  avgLieferzeitMin: number;
  kundenbewertung: number; // 1-5
  aktiveFahrer: number;
  zielerreichungPct: number;
  stundenumsatz: { stunde: string; umsatz: number; bestellungen: number }[];
}

const MOCK_STATS: DashStats = {
  heuteUmsatz: 3847,
  heuteBestellungen: 127,
  heuteStornos: 4,
  avgLieferzeitMin: 28,
  kundenbewertung: 4.6,
  aktiveFahrer: 8,
  zielerreichungPct: 84,
  stundenumsatz: [
    { stunde: '11', umsatz: 180, bestellungen: 6 },
    { stunde: '12', umsatz: 420, bestellungen: 14 },
    { stunde: '13', umsatz: 650, bestellungen: 22 },
    { stunde: '14', umsatz: 310, bestellungen: 10 },
    { stunde: '15', umsatz: 195, bestellungen: 6 },
    { stunde: '16', umsatz: 280, bestellungen: 9 },
    { stunde: '17', umsatz: 490, bestellungen: 16 },
    { stunde: '18', umsatz: 720, bestellungen: 24 },
    { stunde: '19', umsatz: 602, bestellungen: 20 },
  ],
};

interface KpiCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  color: string;
}

function KpiCard({ icon: Icon, label, value, sub, color }: KpiCardProps) {
  return (
    <div className={`rounded-xl p-3 ${color}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 opacity-70" />
        <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{label}</span>
      </div>
      <p className="text-xl font-black tabular-nums">{value}</p>
      {sub && <p className="text-[10px] opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
}

export function LieferdienstPhase2205StatistikDashboardCockpit() {
  const [stats, setStats] = useState<DashStats>(MOCK_STATS);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const supabase = createClient();

  const refresh = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('daily_stats')
        .select('revenue,order_count,cancellation_count,avg_delivery_min,avg_rating,active_drivers,target_pct')
        .eq('date', today)
        .single();
      if (data) {
        setStats((prev) => ({
          ...prev,
          heuteUmsatz: data.revenue ?? 0,
          heuteBestellungen: data.order_count ?? 0,
          heuteStornos: data.cancellation_count ?? 0,
          avgLieferzeitMin: data.avg_delivery_min ?? 30,
          kundenbewertung: data.avg_rating ?? 4.5,
          aktiveFahrer: data.active_drivers ?? 0,
          zielerreichungPct: data.target_pct ?? 0,
        }));
      }
    } catch {
      // keep mock
    }
    setLastUpdate(new Date());
  }, [supabase]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, [refresh]);

  const stornoquote = stats.heuteBestellungen
    ? Math.round((stats.heuteStornos / stats.heuteBestellungen) * 100)
    : 0;

  const maxUmsatz = Math.max(...stats.stundenumsatz.map((s) => s.umsatz));

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-matcha-600" />
          <span className="text-sm font-bold text-stone-800">Statistiken-Dashboard Heute</span>
        </div>
        <span className="text-[10px] text-stone-400">
          {lastUpdate.toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Zielerreichung */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-stone-500 font-medium">Tages-Zielerreichung</span>
          <span className={`font-bold ${
            stats.zielerreichungPct >= 90 ? 'text-emerald-600' :
            stats.zielerreichungPct >= 70 ? 'text-amber-600' : 'text-red-600'
          }`}>{stats.zielerreichungPct}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-stone-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              stats.zielerreichungPct >= 90 ? 'bg-emerald-500' :
              stats.zielerreichungPct >= 70 ? 'bg-amber-400' : 'bg-red-400'
            }`}
            style={{ width: `${stats.zielerreichungPct}%` }}
          />
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <KpiCard
          icon={Euro}
          label="Umsatz"
          value={`€${(stats.heuteUmsatz / 1000).toFixed(1)}k`}
          sub="heute gesamt"
          color="bg-emerald-50 text-emerald-800"
        />
        <KpiCard
          icon={Package}
          label="Bestellungen"
          value={String(stats.heuteBestellungen)}
          sub={`${stornoquote}% Storno`}
          color="bg-blue-50 text-blue-800"
        />
        <KpiCard
          icon={Clock}
          label="Ø Lieferzeit"
          value={`${stats.avgLieferzeitMin}m`}
          sub={stats.avgLieferzeitMin <= 30 ? 'Im Ziel ✓' : 'Über Ziel ⚠'}
          color={stats.avgLieferzeitMin <= 30 ? 'bg-matcha-50 text-matcha-800' : 'bg-amber-50 text-amber-800'}
        />
        <KpiCard
          icon={Star}
          label="Bewertung"
          value={stats.kundenbewertung.toFixed(1)}
          sub={`${stats.aktiveFahrer} Fahrer aktiv`}
          color="bg-amber-50 text-amber-800"
        />
      </div>

      {/* Stundenumsatz Chart */}
      <div>
        <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-wide mb-2">Umsatz nach Stunde</p>
        <ResponsiveContainer width="100%" height={80}>
          <BarChart data={stats.stundenumsatz} barCategoryGap="20%">
            <XAxis dataKey="stunde" tick={{ fontSize: 9, fill: '#a8a29e' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ fontSize: 10, padding: '4px 8px', borderRadius: 6 }}
              formatter={(v: any) => [`€${v}`, 'Umsatz']}
            />
            <Bar dataKey="umsatz" radius={[3, 3, 0, 0]}>
              {stats.stundenumsatz.map((s, i) => (
                <Cell
                  key={i}
                  fill={s.umsatz === maxUmsatz ? '#15803d' : '#86efac'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom strip */}
      <div className="flex items-center gap-3 text-[10px] text-stone-500 pt-1 border-t border-stone-100">
        <span className="flex items-center gap-1"><Bike className="w-3 h-3" />{stats.aktiveFahrer} aktiv</span>
        <span className="flex items-center gap-1">
          {stornoquote <= 5 ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : <TrendingDown className="w-3 h-3 text-red-500" />}
          {stornoquote}% Storno
        </span>
        <span className="ml-auto">30s Refresh</span>
      </div>
    </div>
  );
}
