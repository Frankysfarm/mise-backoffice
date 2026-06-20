'use client';

// Phase 350 — DispatchEngagementRanglistePanel
// Mini-Rangliste im Dispatch-Dashboard (Top 5 Fahrer diese Woche)

import { useEffect, useState } from 'react';
import { Trophy, Medal } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface Entry {
  rank: number;
  driverId: string;
  driverName: string | null;
  weeklyPoints: number;
  deliveries: number;
  onTimeRate: number | null;
  badgesCount: number;
}

interface Props {
  locationId: string | null;
}

function rankEmoji(r: number) {
  if (r === 1) return '🥇';
  if (r === 2) return '🥈';
  if (r === 3) return '🥉';
  return `#${r}`;
}

function initials(name: string | null) {
  if (!name) return '??';
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

export function DispatchEngagementRanglistePanel({ locationId }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    if (!locationId) return;
    let alive = true;

    const load = async () => {
      try {
        const res = await fetch(
          `/api/delivery/admin/driver-engagement?action=leaderboard&limit=5&location_id=${locationId}`,
        );
        if (!res.ok || !alive) return;
        setEntries(await res.json() as Entry[]);
      } catch {
        // silent
      }
    };

    void load();
    const iv = setInterval(load, 90_000);
    return () => { alive = false; clearInterval(iv); };
  }, [locationId]);

  if (!entries.length) return null;

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="h-4 w-4 text-amber-500" />
        <span className="font-semibold text-sm">Top-Fahrer diese Woche</span>
      </div>
      <div className="space-y-2">
        {entries.map((e) => (
          <div key={e.driverId ?? e.rank} className="flex items-center gap-2">
            <span className="text-base w-8 text-center">{rankEmoji(e.rank)}</span>
            <div className="h-7 w-7 rounded-full bg-matcha-100 text-matcha-800 flex items-center justify-center text-xs font-bold shrink-0">
              {initials(e.driverName)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{e.driverName ?? 'Fahrer'}</div>
              <div className="text-[11px] text-muted-foreground">
                {e.deliveries} Liefg.
                {e.onTimeRate !== null ? ` · ${e.onTimeRate.toFixed(0)}% p.` : ''}
              </div>
            </div>
            <div className="text-sm font-black text-matcha-700">{e.weeklyPoints} Pts</div>
            {e.badgesCount > 0 && (
              <div className="flex items-center gap-0.5">
                <Medal className="h-3 w-3 text-amber-400" />
                <span className="text-[11px] text-amber-700">{e.badgesCount}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

