'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';
import type { RampUpProfile, RampUpTier } from '@/lib/delivery/driver-ramp-up';

interface Props {
  driverId: string;
}

type ApiResponse = {
  ok: boolean;
  profile: RampUpProfile | null;
};

type HistoryPoint = { date: string; score: number };
type HistoryResponse = { ok: boolean; history: HistoryPoint[] };

function tierLabelDe(tier: RampUpTier): string {
  switch (tier) {
    case 'struggling': return 'Noch üben';
    case 'developing': return 'Auf dem Weg';
    case 'promising': return 'Sehr gut!';
    case 'graduated': return 'Profi';
  }
}

function tierRingColor(tier: RampUpTier): string {
  switch (tier) {
    case 'struggling': return 'border-red-400';
    case 'developing': return 'border-amber-400';
    case 'promising': return 'border-emerald-400';
    case 'graduated': return 'border-indigo-400';
  }
}

function tierTextColor(tier: RampUpTier): string {
  switch (tier) {
    case 'struggling': return 'text-red-300';
    case 'developing': return 'text-amber-300';
    case 'promising': return 'text-emerald-300';
    case 'graduated': return 'text-indigo-300';
  }
}

export function FahrerRampUpFortschritt({ driverId }: Props) {
  const [profile, setProfile] = useState<RampUpProfile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [history, setHistory] = useState<HistoryPoint[]>([]);

  useEffect(() => {
    if (!driverId) return;
    const base = new URL('/api/delivery/admin/driver-ramp-up', window.location.origin);
    base.searchParams.set('driver_id', driverId);

    const load = async () => {
      try {
        const profileUrl = new URL(base.toString());
        profileUrl.searchParams.set('action', 'profile');
        const res = await fetch(profileUrl.toString());
        if (!res.ok) return;
        const json = (await res.json()) as ApiResponse;
        if (json.ok && json.profile) setProfile(json.profile);
      } catch {
      } finally {
        setLoaded(true);
      }
    };

    const loadHistory = async () => {
      try {
        const histUrl = new URL(base.toString());
        histUrl.searchParams.set('action', 'history');
        const res = await fetch(histUrl.toString());
        if (!res.ok) return;
        const json = (await res.json()) as HistoryResponse;
        if (json.ok && Array.isArray(json.history) && json.history.length > 0) {
          setHistory(json.history);
        }
      } catch {}
    };

    load();
    loadHistory();
  }, [driverId]);

  if (!loaded || !profile) return null;

  const score = profile.rampUpScore;
  const ringDeg = Math.round((score / 100) * 360);

  return (
    <div className="rounded-2xl bg-white/10 p-4 space-y-4">
      <div className="flex flex-col items-center gap-2">
        <div className="relative w-24 h-24 flex items-center justify-center">
          <div
            className={cn(
              'absolute inset-0 rounded-full border-[6px]',
              tierRingColor(profile.rampUpTier),
            )}
            style={{
              background: `conic-gradient(currentColor ${ringDeg}deg, transparent ${ringDeg}deg)`,
              opacity: 0.3,
            }}
          />
          <div
            className={cn(
              'absolute inset-0 rounded-full border-[6px] border-white/10',
            )}
          />
          <div className="relative z-10 flex flex-col items-center">
            <span
              className={cn(
                'text-2xl font-bold',
                tierTextColor(profile.rampUpTier),
              )}
            >
              {score}
            </span>
            <span className="text-[10px] text-white/50 uppercase tracking-wide">Score</span>
          </div>
        </div>
        <span
          className={cn(
            'text-base font-semibold',
            tierTextColor(profile.rampUpTier),
          )}
        >
          {tierLabelDe(profile.rampUpTier)}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-white/5 rounded-lg py-2 px-1">
          <p className="text-xs text-white/50">Lieferungen</p>
          <p className="text-sm font-bold text-white">{profile.deliveriesInPeriod}</p>
        </div>
        <div className="bg-white/5 rounded-lg py-2 px-1">
          <p className="text-xs text-white/50">Pünktlichkeit</p>
          <p className="text-sm font-bold text-white">
            {profile.onTimeRatePct != null ? `${Math.round(profile.onTimeRatePct)} %` : '–'}
          </p>
        </div>
        <div className="bg-white/5 rounded-lg py-2 px-1">
          <p className="text-xs text-white/50">Tag</p>
          <p className="text-sm font-bold text-white">{profile.rampUpDay}</p>
        </div>
      </div>

      {profile.coachingFlag && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/20 border border-amber-500/30 px-3 py-2">
          <span className="text-amber-300 text-xs font-semibold mt-0.5 flex-shrink-0">
            Coaching empfohlen
          </span>
          {profile.coachingReason && (
            <span className="text-amber-300/70 text-xs">{profile.coachingReason}</span>
          )}
        </div>
      )}

      {profile.predictedRetention === 'high' && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 px-3 py-2">
          <span className="text-emerald-300 text-xs font-semibold">
            Starke Bindung prognostiziert
          </span>
        </div>
      )}

      {history.length >= 2 && (
        <div className="space-y-1">
          <p className="text-[10px] text-white/40 uppercase tracking-wide">Score-Verlauf (7 Tage)</p>
          <div className="h-12 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                <Tooltip
                  contentStyle={{ background: '#1a1a1a', border: 'none', borderRadius: 8, fontSize: 11 }}
                  formatter={(val: number) => [`${val}`, 'Score']}
                  labelFormatter={(label: string) => label.slice(5)}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  dot={false}
                  strokeWidth={2}
                  stroke={
                    profile.rampUpTier === 'graduated' ? '#818cf8'
                    : profile.rampUpTier === 'promising' ? '#34d399'
                    : profile.rampUpTier === 'developing' ? '#fbbf24'
                    : '#f87171'
                  }
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
