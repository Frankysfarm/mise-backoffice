'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Route, RefreshCw, Map, User, Star, TrendingUp,
  MapPin, Bike, Clock, BarChart2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  RouteLearningDashboard,
  RouteProfileWithDriver,
  PlzStats,
} from '@/lib/delivery/driver-route-learning';

// ─── helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-amber-500';
  if (score >= 40) return 'text-orange-500';
  return 'text-red-600';
}

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-emerald-100 text-emerald-700';
  if (score >= 60) return 'bg-amber-100 text-amber-700';
  if (score >= 40) return 'bg-orange-100 text-orange-700';
  return 'bg-red-100 text-red-700';
}

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 80 ? 'bg-emerald-500' :
    score >= 60 ? 'bg-amber-400' :
    score >= 40 ? 'bg-orange-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${score}%` }} />
      </div>
      <span className={cn('text-xs font-bold w-7 text-right', scoreColor(score))}>{score}</span>
    </div>
  );
}

function KpiCard({
  label, value, sub, icon, color,
}: {
  label: string; value: string | number; sub?: string; icon: React.ReactNode; color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex gap-4 items-start shadow-sm">
      <div className={cn('p-2 rounded-lg', color)}>{icon}</div>
      <div>
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-2xl font-bold text-slate-800 leading-tight">{value}</div>
        {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

// ─── ProfileRow ───────────────────────────────────────────────────────────────

function ProfileRow({ p }: { p: RouteProfileWithDriver }) {
  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 transition">
      <td className="py-2 px-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-matcha-100 flex items-center justify-center text-xs font-bold text-matcha-700">
            {(p.driverName ?? 'F').charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-medium text-slate-800">{p.driverName ?? 'Unbekannt'}</div>
            {p.vehicleType && <div className="text-xs text-slate-400">{p.vehicleType}</div>}
          </div>
        </div>
      </td>
      <td className="py-2 px-3">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-xs font-mono font-semibold text-slate-700">
          <MapPin className="h-3 w-3" />{p.plz}
        </span>
      </td>
      <td className="py-2 px-3">
        <div className="w-32">
          <ScoreBar score={p.proficiencyScore} />
        </div>
      </td>
      <td className="py-2 px-3 text-sm text-slate-600">{p.stopCount}</td>
      <td className="py-2 px-3 text-sm text-slate-600">
        {p.avgDeliveryMin != null ? `${p.avgDeliveryMin.toFixed(1)} min` : '—'}
      </td>
      <td className="py-2 px-3 text-sm text-slate-600">
        {p.onTimeRate != null ? `${Math.round(p.onTimeRate * 100)} %` : '—'}
      </td>
    </tr>
  );
}

// ─── PlzRow ───────────────────────────────────────────────────────────────────

function PlzRow({ s }: { s: PlzStats }) {
  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 transition">
      <td className="py-2 px-3">
        <span className="font-mono text-sm font-semibold text-slate-700">{s.plz}</span>
      </td>
      <td className="py-2 px-3 text-sm text-slate-600">{s.totalStops}</td>
      <td className="py-2 px-3 text-sm text-slate-600">
        {s.avgDeliveryMin != null ? `${s.avgDeliveryMin.toFixed(1)} min` : '—'}
      </td>
      <td className="py-2 px-3 text-sm text-slate-600">{s.activeDrivers}</td>
      <td className="py-2 px-3">
        {s.bestDriverName ? (
          <span className="text-sm font-medium text-matcha-700">{s.bestDriverName}</span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </td>
      <td className="py-2 px-3">
        <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded', scoreBg(s.bestScore))}>
          {s.bestScore}
        </span>
      </td>
    </tr>
  );
}

// ─── Main Client ──────────────────────────────────────────────────────────────

export function DriverRouteLearningClient() {
  const [data, setData]         = useState<RouteLearningDashboard | null>(null);
  const [loading, setLoading]   = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [tab, setTab]           = useState<'profiles' | 'plz' | 'drivers'>('profiles');
  const [showAll, setShowAll]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/admin/driver-route-learning?action=dashboard');
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5 * 60_000);
    return () => clearInterval(interval);
  }, [load]);

  const handleRebuild = async () => {
    setRebuilding(true);
    await fetch('/api/delivery/admin/driver-route-learning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'rebuild' }),
    });
    setRebuilding(false);
    await load();
  };

  if (loading && !data) {
    return (
      <div className="p-8 flex items-center justify-center text-slate-400">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Lade Routen-Lernkurve…
      </div>
    );
  }

  const s = data?.stats;
  const profiles = data?.topProfiles ?? [];
  const plzStats = data?.plzStats ?? [];
  const drivers  = data?.driverSummary ?? [];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-matcha-100 text-matcha-800 flex items-center justify-center">
            <Route className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-slate-800">Smart Driver Route Learning</h1>
            <p className="text-sm text-slate-500">Fahrer-spezifische Routen-Lernkurve · PLZ-Proficiency-Scores</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Aktualisieren
          </button>
          <button
            onClick={handleRebuild}
            disabled={rebuilding}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-matcha-700 text-white text-sm hover:bg-matcha-800 disabled:opacity-50 transition"
          >
            <TrendingUp className={cn('h-3.5 w-3.5', rebuilding && 'animate-spin')} />
            {rebuilding ? 'Berechne…' : 'Profile neu berechnen'}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Beobachtungen gesamt"
          value={(s?.totalObservations ?? 0).toLocaleString('de')}
          sub={`${s?.observationsLast7d ?? 0} letzte 7 Tage`}
          icon={<BarChart2 className="h-4 w-4" />}
          color="bg-blue-50 text-blue-600"
        />
        <KpiCard
          label="Aktive Fahrer"
          value={s?.activeDrivers ?? 0}
          sub={`${s?.coveredPlzs ?? 0} PLZ-Gebiete`}
          icon={<User className="h-4 w-4" />}
          color="bg-matcha-50 text-matcha-700"
        />
        <KpiCard
          label="Profile gesamt"
          value={(s?.totalProfiles ?? 0).toLocaleString('de')}
          sub="Fahrer × PLZ Kombinationen"
          icon={<Map className="h-4 w-4" />}
          color="bg-purple-50 text-purple-600"
        />
        <KpiCard
          label="Ø Proficiency-Score"
          value={s?.avgProficiencyScore != null ? `${s.avgProficiencyScore}/100` : '—'}
          sub="Über alle Fahrer + PLZs"
          icon={<Star className="h-4 w-4" />}
          color="bg-amber-50 text-amber-600"
        />
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200">
          {([ ['profiles', 'Top Profile', <Route key="r" className="h-3.5 w-3.5" />], ['plz', 'PLZ-Übersicht', <MapPin key="m" className="h-3.5 w-3.5" />], ['drivers', 'Fahrer-Ranking', <Bike key="b" className="h-3.5 w-3.5" />]] as const).map(([id, label, icon]) => (
            <button
              key={id}
              onClick={() => setTab(id as typeof tab)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition',
                tab === id
                  ? 'border-matcha-600 text-matcha-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700',
              )}
            >
              {icon}{label}
            </button>
          ))}
        </div>

        {/* Top Profile Table */}
        {tab === 'profiles' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="py-2 px-3 text-left text-xs font-semibold text-slate-500">Fahrer</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-slate-500">PLZ</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-slate-500">Proficiency</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-slate-500">Stopps</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-slate-500">Ø Zeit</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-slate-500">Pünktlichkeit</th>
                </tr>
              </thead>
              <tbody>
                {profiles.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-slate-400 text-sm">Noch keine Profildaten vorhanden</td></tr>
                ) : (
                  profiles.slice(0, showAll ? undefined : 10).map((p) => (
                    <ProfileRow key={p.id} p={p} />
                  ))
                )}
              </tbody>
            </table>
            {profiles.length > 10 && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="w-full py-2 text-xs text-slate-500 hover:text-slate-700 flex items-center justify-center gap-1 border-t border-slate-100"
              >
                {showAll ? <><ChevronUp className="h-3 w-3" /> Weniger anzeigen</> : <><ChevronDown className="h-3 w-3" /> Alle {profiles.length} Profile anzeigen</>}
              </button>
            )}
          </div>
        )}

        {/* PLZ Stats Table */}
        {tab === 'plz' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="py-2 px-3 text-left text-xs font-semibold text-slate-500">PLZ</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-slate-500">Stopps gesamt</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-slate-500">Ø Lieferzeit</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-slate-500">Aktive Fahrer</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-slate-500">Bester Fahrer</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-slate-500">Bester Score</th>
                </tr>
              </thead>
              <tbody>
                {plzStats.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-slate-400 text-sm">Noch keine PLZ-Daten vorhanden</td></tr>
                ) : (
                  plzStats.map((s) => <PlzRow key={s.plz} s={s} />)
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Driver Ranking */}
        {tab === 'drivers' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="py-2 px-3 text-left text-xs font-semibold text-slate-500">#</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-slate-500">Fahrer</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-slate-500">Ø Score</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-slate-500">PLZ-Profile</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-slate-500">Stopps gesamt</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-slate-500">Stärkstes Gebiet</th>
                </tr>
              </thead>
              <tbody>
                {drivers.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-slate-400 text-sm">Noch keine Fahrer-Daten vorhanden</td></tr>
                ) : (
                  drivers.map((d, i) => (
                    <tr key={d.driverId} className="border-b border-slate-100 hover:bg-slate-50 transition">
                      <td className="py-2 px-3">
                        <span className={cn('text-sm font-bold', i < 3 ? 'text-amber-500' : 'text-slate-400')}>
                          {i + 1}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-matcha-100 flex items-center justify-center text-xs font-bold text-matcha-700">
                            {(d.driverName ?? 'F').charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-slate-800">{d.driverName ?? 'Unbekannt'}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="w-28">
                          <ScoreBar score={d.avgScore} />
                        </div>
                      </td>
                      <td className="py-2 px-3 text-sm text-slate-600">{d.profileCount}</td>
                      <td className="py-2 px-3 text-sm text-slate-600">{d.totalStops}</td>
                      <td className="py-2 px-3">
                        {d.bestPlz ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-matcha-50 text-xs font-mono font-semibold text-matcha-700">
                            <MapPin className="h-3 w-3" />{d.bestPlz}
                          </span>
                        ) : <span className="text-xs text-slate-400">—</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info footer */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Clock className="h-3.5 w-3.5" />
        Profile werden täglich 03:45 UTC automatisch neu berechnet · Beobachtungen werden 120 Tage aufbewahrt
        {s?.lastRebuildAt && (
          <> · Letzter Datenpunkt: {new Date(s.lastRebuildAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</>
        )}
      </div>
    </div>
  );
}
