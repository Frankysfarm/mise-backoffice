'use client';

// Phase 350 — FahrerMeinEngagement
// Persönliche Engagement-Ansicht: Punkte, Abzeichen, Rang dieser Woche

import { useEffect, useState } from 'react';
import { Trophy, Zap, Star, Medal } from 'lucide-react';

interface EarnedBadge {
  badge: { name: string; icon: string };
  earnedAt: string;
}

interface Profile {
  driverName: string | null;
  totalPointsAllTime: number;
  weeklyPoints: number;
  deliveriesAllTime: number;
  onTimeRatePct: number | null;
  earnedBadges: EarnedBadge[];
  weeklyRank: number | null;
  currentStreak: number;
}

interface Props {
  driverId: string | null;
  locationId: string | null;
}

function rankLabel(rank: number | null) {
  if (rank === null) return '–';
  if (rank === 1) return '🥇 Platz 1';
  if (rank === 2) return '🥈 Platz 2';
  if (rank === 3) return '🥉 Platz 3';
  return `Platz ${rank}`;
}

export function FahrerMeinEngagement({ driverId, locationId }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!driverId || !locationId) return;
    let alive = true;

    const load = async () => {
      try {
        const res = await fetch(
          `/api/delivery/admin/driver-engagement?action=profile&driver_id=${driverId}&location_id=${locationId}`,
        );
        if (!res.ok || !alive) return;
        setProfile(await res.json() as Profile);
      } catch {
        // silent
      }
    };

    void load();
    const iv = setInterval(load, 300_000);
    return () => { alive = false; clearInterval(iv); };
  }, [driverId, locationId]);

  if (!profile) return null;

  const hasPoints = profile.weeklyPoints > 0 || profile.totalPointsAllTime > 0;
  if (!hasPoints && !profile.earnedBadges.length) return null;

  return (
    <div className="mx-4 mb-3 rounded-2xl border bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="h-5 w-5 text-amber-500" />
        <span className="font-bold text-amber-900">Mein Engagement</span>
        {profile.weeklyRank !== null && (
          <span className="ml-auto text-sm font-semibold text-amber-700">
            {rankLabel(profile.weeklyRank)}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-xl bg-white/70 p-2 text-center">
          <div className="flex justify-center mb-0.5">
            <Zap className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-lg font-black text-blue-700">{profile.weeklyPoints}</div>
          <div className="text-[10px] text-stone-500">Punkte Woche</div>
        </div>
        <div className="rounded-xl bg-white/70 p-2 text-center">
          <div className="flex justify-center mb-0.5">
            <Star className="h-4 w-4 text-matcha-600" />
          </div>
          <div className="text-lg font-black text-matcha-700">{profile.totalPointsAllTime.toLocaleString('de-DE')}</div>
          <div className="text-[10px] text-stone-500">Punkte gesamt</div>
        </div>
        <div className="rounded-xl bg-white/70 p-2 text-center">
          <div className="flex justify-center mb-0.5">
            <Medal className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-lg font-black text-amber-700">{profile.earnedBadges.length}</div>
          <div className="text-[10px] text-stone-500">Abzeichen</div>
        </div>
      </div>

      {profile.earnedBadges.length > 0 && (
        <div>
          <div className="text-[11px] text-stone-500 mb-1">Meine Abzeichen</div>
          <div className="flex flex-wrap gap-1">
            {profile.earnedBadges.map((eb, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 text-[11px] bg-amber-100 text-amber-800 rounded-full px-2 py-0.5 font-medium"
              >
                ⭐ {eb.badge.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {profile.currentStreak > 0 && (
        <div className="mt-2 text-xs text-stone-500 text-center">
          🔥 Aktuelle Streak: <strong>{profile.currentStreak}</strong> pünktliche Lieferungen
        </div>
      )}
    </div>
  );
}
