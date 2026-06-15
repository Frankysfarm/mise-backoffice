'use client';

import { useState, useEffect, useCallback } from 'react';
import type { StreakDashboard, StreakLeaderboardEntry, MultiplierTier, MilestoneBonusTier } from '@/lib/delivery/driver-streaks';

interface Props { locationId: string; }

type Tab = 'leaderboard' | 'milestones' | 'config';

function FlameIcon({ size = 18, lit = false }: { size?: number; lit?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={lit ? '#f97316' : 'none'}
      stroke={lit ? '#f97316' : '#9ca3af'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 3z" />
    </svg>
  );
}

function MultiplierBadge({ mult }: { mult: number }) {
  const isAbove1 = mult > 1;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${isAbove1 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
      {isAbove1 && <FlameIcon size={12} lit />}
      {mult.toFixed(2)}×
    </span>
  );
}

export function DriverStreaksClient({ locationId }: Props) {
  const [tab, setTab] = useState<Tab>('leaderboard');
  const [dashboard, setDashboard] = useState<StreakDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Config edit state
  const [editTiers, setEditTiers] = useState<MultiplierTier[]>([]);
  const [editMilestones, setEditMilestones] = useState<MilestoneBonusTier[]>([]);
  const [editEnabled, setEditEnabled] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/admin/driver-streaks?action=dashboard');
      if (res.ok) {
        const d: StreakDashboard = await res.json();
        setDashboard(d);
        setEditTiers(d.config.multiplierTiers);
        setEditMilestones(d.config.milestoneBonusEur);
        setEditEnabled(d.config.enabled);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSaveConfig() {
    setSaving(true);
    try {
      await fetch('/api/delivery/admin/driver-streaks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_config',
          multiplierTiers: editTiers,
          milestoneBonusEur: editMilestones,
          enabled: editEnabled,
        }),
      });
      load();
    } finally { setSaving(false); }
  }

  const top = dashboard?.topStreakDriver;

  return (
    <div className="p-4 space-y-4">
      {/* KPI Cards */}
      {dashboard && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Aktive Streaker', value: dashboard.activeStreakers, color: 'text-orange-600' },
            { label: 'Ø Streak', value: dashboard.avgStreak, color: 'text-blue-600' },
            { label: 'Meilensteine (kürzlich)', value: dashboard.totalMilestones, color: 'text-purple-600' },
            { label: 'Top Streak', value: top ? `${top.currentStreak} 🔥 ${top.driverName}` : '—', color: 'text-green-600' },
          ].map((k) => (
            <div key={k.label} className="bg-white rounded-xl p-4 shadow-sm border">
              <div className={`text-xl font-bold truncate ${k.color}`}>{k.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Multiplier Tiers Info */}
      {dashboard && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex flex-wrap gap-3 items-center">
          <FlameIcon size={20} lit />
          <span className="text-sm font-medium text-orange-800">Multiplikator-Stufen:</span>
          {dashboard.config.multiplierTiers.map((t) => (
            <span key={t.threshold} className="text-xs bg-white border border-orange-200 text-orange-700 px-2 py-0.5 rounded-full font-medium">
              ≥{t.threshold} Stops → {t.multiplier.toFixed(2)}×
            </span>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {(['leaderboard', 'milestones', 'config'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {{ leaderboard: '🏆 Rangliste', milestones: '🎯 Meilensteine', config: '⚙️ Konfiguration' }[t]}
          </button>
        ))}
      </div>

      {loading && <div className="text-center py-10 text-gray-400">Lädt …</div>}

      {/* Leaderboard Tab */}
      {!loading && tab === 'leaderboard' && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          {(!dashboard?.leaderboard?.length) ? (
            <div className="p-8 text-center text-gray-400">Noch keine Streak-Daten vorhanden.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-xs text-gray-500">
                  <th className="text-left px-4 py-3">Rang</th>
                  <th className="text-left px-4 py-3">Fahrer</th>
                  <th className="text-right px-4 py-3">Aktuell 🔥</th>
                  <th className="text-right px-4 py-3">Rekord</th>
                  <th className="text-right px-4 py-3">Pünktlichkeit</th>
                  <th className="text-right px-4 py-3">Multiplikator</th>
                  <th className="text-right px-4 py-3">Letzte Lieferung</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.leaderboard.map((e: StreakLeaderboardEntry, idx) => (
                  <tr key={e.driverId} className={`border-t ${idx < 3 ? 'bg-orange-50/40' : ''}`}>
                    <td className="px-4 py-3 font-bold text-gray-400">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${e.streakRank}`}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">{e.driverName}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="flex items-center justify-end gap-1 font-bold">
                        {e.currentStreak > 0 && <FlameIcon size={14} lit={e.currentStreak >= 5} />}
                        {e.currentStreak}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">{e.longestStreak}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`${e.onTimeRatePct >= 90 ? 'text-green-600' : e.onTimeRatePct >= 75 ? 'text-yellow-600' : 'text-red-500'} font-medium`}>
                        {e.onTimeRatePct}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right"><MultiplierBadge mult={e.currentMultiplier} /></td>
                    <td className="px-4 py-3 text-right text-gray-400 text-xs">
                      {e.lastDeliveryAt ? new Date(e.lastDeliveryAt).toLocaleString('de', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Milestones Tab */}
      {!loading && tab === 'milestones' && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          {(!dashboard?.milestones?.length) ? (
            <div className="p-8 text-center text-gray-400">Noch keine Meilensteine erreicht.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-xs text-gray-500">
                  <th className="text-left px-4 py-3">Fahrer</th>
                  <th className="text-center px-4 py-3">Meilenstein</th>
                  <th className="text-center px-4 py-3">Streak</th>
                  <th className="text-right px-4 py-3">Zeitpunkt</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.milestones.map((e, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="px-4 py-3 font-medium text-gray-800">{e.driverName ?? '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="bg-orange-100 text-orange-700 font-bold text-xs px-3 py-1 rounded-full">
                        🎯 {e.milestoneHit} Stops
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-orange-600">{e.streakAfter} 🔥</td>
                    <td className="px-4 py-3 text-right text-gray-400 text-xs">
                      {new Date(e.deliveredAt).toLocaleString('de', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Config Tab */}
      {!loading && tab === 'config' && (
        <div className="bg-white rounded-xl shadow-sm border p-5 space-y-5">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={editEnabled} onChange={(e) => setEditEnabled(e.target.checked)} className="w-4 h-4" />
              <span className="text-sm font-medium">Streak-Tracking aktiviert</span>
            </label>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Multiplikator-Stufen</h4>
            <div className="space-y-2">
              {editTiers.map((tier, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="text-gray-500 w-16">ab</span>
                  <input type="number" min={1} value={tier.threshold}
                    onChange={(e) => { const upd = [...editTiers]; upd[i] = { ...upd[i], threshold: Number(e.target.value) }; setEditTiers(upd); }}
                    className="border rounded px-2 py-1 w-20 text-center" />
                  <span className="text-gray-500">Stops →</span>
                  <input type="number" step="0.01" min={1} max={3} value={tier.multiplier}
                    onChange={(e) => { const upd = [...editTiers]; upd[i] = { ...upd[i], multiplier: Number(e.target.value) }; setEditTiers(upd); }}
                    className="border rounded px-2 py-1 w-20 text-center" />
                  <span className="text-gray-500">×</span>
                  <button onClick={() => setEditTiers(editTiers.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                </div>
              ))}
              <button onClick={() => setEditTiers([...editTiers, { threshold: 100, multiplier: 2.0 }])}
                className="text-xs text-blue-600 hover:underline mt-1">+ Stufe hinzufügen</button>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Meilenstein-Boni (einmalig)</h4>
            <div className="space-y-2">
              {editMilestones.map((m, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="text-gray-500 w-16">bei</span>
                  <input type="number" min={1} value={m.milestone}
                    onChange={(e) => { const upd = [...editMilestones]; upd[i] = { ...upd[i], milestone: Number(e.target.value) }; setEditMilestones(upd); }}
                    className="border rounded px-2 py-1 w-20 text-center" />
                  <span className="text-gray-500">Stops →</span>
                  <input type="number" step="0.50" min={0} value={m.bonus_eur}
                    onChange={(e) => { const upd = [...editMilestones]; upd[i] = { ...upd[i], bonus_eur: Number(e.target.value) }; setEditMilestones(upd); }}
                    className="border rounded px-2 py-1 w-24 text-center" />
                  <span className="text-gray-500">€</span>
                  <button onClick={() => setEditMilestones(editMilestones.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                </div>
              ))}
              <button onClick={() => setEditMilestones([...editMilestones, { milestone: 100, bonus_eur: 50 }])}
                className="text-xs text-blue-600 hover:underline mt-1">+ Meilenstein hinzufügen</button>
            </div>
          </div>

          <button onClick={handleSaveConfig} disabled={saving}
            className="bg-orange-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
            {saving ? 'Speichert …' : 'Konfiguration speichern'}
          </button>
        </div>
      )}
    </div>
  );
}
