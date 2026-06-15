'use client';

import { useState } from 'react';
import type { StreakLeaderboardEntry } from '@/lib/delivery/driver-streaks';

interface Props {
  leaderboard: StreakLeaderboardEntry[];
}

function FlameBar({ streak, max }: { streak: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (streak / max) * 100) : 0;
  const color = streak >= 20 ? 'bg-orange-500' : streak >= 10 ? 'bg-amber-400' : 'bg-matcha-400';
  return (
    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function MultiplierBadge({ mult }: { mult: number }) {
  if (mult <= 1) return <span className="text-xs text-gray-400">1.00×</span>;
  const bg = mult >= 1.5 ? 'bg-orange-100 text-orange-700' : mult >= 1.25 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700';
  return <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${bg}`}>{mult.toFixed(2)}×</span>;
}

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-base">🥇</span>;
  if (rank === 2) return <span className="text-base">🥈</span>;
  if (rank === 3) return <span className="text-base">🥉</span>;
  return <span className="text-xs text-gray-400 font-mono w-5 text-center inline-block">#{rank}</span>;
}

type SortKey = 'streak' | 'longest' | 'ontime' | 'mult';

export function StreakLeaderboardDetail({ leaderboard }: Props) {
  const [sort, setSort] = useState<SortKey>('streak');
  const [search, setSearch] = useState('');

  const filtered = leaderboard
    .filter((e) => e.driverName.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'streak') return b.currentStreak - a.currentStreak;
      if (sort === 'longest') return b.longestStreak - a.longestStreak;
      if (sort === 'ontime') return b.onTimeRatePct - a.onTimeRatePct;
      return b.currentMultiplier - a.currentMultiplier;
    });

  const maxStreak = Math.max(...leaderboard.map((e) => e.currentStreak), 1);

  const cols: { key: SortKey; label: string }[] = [
    { key: 'streak', label: 'Akt. Streak' },
    { key: 'longest', label: 'Rekord' },
    { key: 'ontime', label: 'Pünktlich %' },
    { key: 'mult', label: 'Bonus' },
  ];

  if (!leaderboard.length) {
    return (
      <div className="rounded-xl border bg-white p-6 text-center text-sm text-gray-400 shadow-sm">
        Noch keine Streak-Daten vorhanden.
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-800">Streak-Rangliste — Detailansicht</h3>
        <input
          type="text"
          placeholder="Fahrer suchen…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-xs border rounded-lg px-2.5 py-1 w-36 focus:outline-none focus:ring-1 focus:ring-matcha-400"
        />
      </div>

      {/* Sort Tabs */}
      <div className="flex gap-1 px-3 py-2 border-b bg-gray-50">
        {cols.map((c) => (
          <button
            key={c.key}
            onClick={() => setSort(c.key)}
            className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${sort === c.key ? 'bg-matcha-500 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-400 border-b text-left">
              <th className="pl-4 pr-2 py-2 font-medium w-8">#</th>
              <th className="px-2 py-2 font-medium">Fahrer</th>
              <th className="px-2 py-2 font-medium text-right">Streak</th>
              <th className="px-2 py-2 font-medium text-right hidden sm:table-cell">Rekord</th>
              <th className="px-2 py-2 font-medium text-right hidden sm:table-cell">Pünktl.</th>
              <th className="pr-4 pl-2 py-2 font-medium text-right">Bonus</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry, idx) => (
              <tr
                key={entry.driverId}
                className={`border-b last:border-0 hover:bg-gray-50 transition-colors ${entry.currentStreak >= 20 ? 'bg-orange-50/40' : ''}`}
              >
                <td className="pl-4 pr-2 py-2.5">
                  <RankMedal rank={idx + 1} />
                </td>
                <td className="px-2 py-2.5">
                  <div className="font-medium text-gray-800">{entry.driverName}</div>
                  <FlameBar streak={entry.currentStreak} max={maxStreak} />
                  {entry.lastDeliveryAt && (
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      Zuletzt: {new Date(entry.lastDeliveryAt).toLocaleDateString('de', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </td>
                <td className="px-2 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {entry.currentStreak >= 10 && <span className="text-sm">🔥</span>}
                    <span className={`font-bold ${entry.currentStreak >= 20 ? 'text-orange-600' : entry.currentStreak >= 10 ? 'text-amber-600' : 'text-gray-700'}`}>
                      {entry.currentStreak}
                    </span>
                  </div>
                </td>
                <td className="px-2 py-2.5 text-right text-gray-500 hidden sm:table-cell">{entry.longestStreak}</td>
                <td className="px-2 py-2.5 text-right text-gray-500 hidden sm:table-cell">
                  <span className={entry.onTimeRatePct >= 90 ? 'text-green-600 font-semibold' : entry.onTimeRatePct >= 75 ? 'text-amber-600' : 'text-red-500'}>
                    {entry.onTimeRatePct.toFixed(0)}%
                  </span>
                </td>
                <td className="pr-4 pl-2 py-2.5 text-right">
                  <MultiplierBadge mult={entry.currentMultiplier} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="py-6 text-center text-xs text-gray-400">Keine Fahrer gefunden.</div>
      )}
    </div>
  );
}
