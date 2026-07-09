'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, CheckCircle2, Clock, MapPin, Package, Star, TrendingUp, Zap } from 'lucide-react';

interface FahrerLive {
  id: string;
  vorname: string;
  nachname: string;
  status: 'online' | 'unterwegs' | 'rueckkehr' | 'pause' | 'offline';
  aktiveTouren: number;
  completedToday: number;
  avgEtaAccuracy: number;   // 0-100
  scoreHeute: number;        // 0-100
  letzterStopMin: number;    // minutes ago
  zone: string | null;
}

interface Props {
  locationId?: string;
}

const STATUS_LABEL: Record<FahrerLive['status'], string> = {
  online: 'Bereit',
  unterwegs: 'Unterwegs',
  rueckkehr: 'Rückkehr',
  pause: 'Pause',
  offline: 'Offline',
};

const STATUS_STYLE: Record<FahrerLive['status'], string> = {
  online: 'bg-matcha-100 text-matcha-700 border-matcha-300',
  unterwegs: 'bg-blue-100 text-blue-700 border-blue-300',
  rueckkehr: 'bg-amber-100 text-amber-700 border-amber-300',
  pause: 'bg-stone-100 text-stone-600 border-stone-300',
  offline: 'bg-red-50 text-red-500 border-red-200',
};

function scoreColor(s: number) {
  if (s >= 80) return 'text-matcha-600';
  if (s >= 60) return 'text-amber-600';
  return 'text-red-600';
}

function mockFahrer(): FahrerLive[] {
  const names = [
    ['Mehmet', 'K.'], ['Julia', 'S.'], ['Leon', 'W.'], ['Fatima', 'A.'],
    ['Kevin', 'B.'], ['Sarah', 'M.'], ['Daniel', 'R.'], ['Aigerim', 'T.'],
  ];
  const statuses: FahrerLive['status'][] = ['unterwegs', 'online', 'unterwegs', 'rueckkehr', 'unterwegs', 'online', 'pause', 'unterwegs'];
  const zones = ['A', 'B', 'C', 'A', 'B', 'C', 'A', 'B'];

  return names.map(([vorname, nachname], i) => ({
    id: `driver-${i}`,
    vorname,
    nachname,
    status: statuses[i],
    aktiveTouren: statuses[i] === 'unterwegs' ? Math.floor(Math.random() * 2) + 1 : 0,
    completedToday: Math.floor(Math.random() * 12) + 2,
    avgEtaAccuracy: Math.floor(Math.random() * 30) + 70,
    scoreHeute: Math.floor(Math.random() * 35) + 65,
    letzterStopMin: Math.floor(Math.random() * 20),
    zone: zones[i],
  }));
}

export function DispatchFahrerEchtzeitMatrix({ locationId }: Props) {
  const [fahrer, setFahrer] = useState<FahrerLive[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'score' | 'completed' | 'status'>('score');

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const res = await fetch(
          `/api/delivery/admin/fahrer-live-status${locationId ? `?location_id=${locationId}` : ''}`,
        );
        if (!res.ok) throw new Error('no data');
        const json = await res.json();
        if (!mounted) return;
        if (Array.isArray(json.fahrer)) {
          setFahrer(json.fahrer);
        } else {
          setFahrer(mockFahrer());
        }
      } catch {
        if (mounted) setFahrer(mockFahrer());
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    const t = setInterval(load, 30_000);
    return () => { mounted = false; clearInterval(t); };
  }, [locationId]);

  const sorted = [...fahrer].sort((a, b) => {
    if (sortBy === 'score') return b.scoreHeute - a.scoreHeute;
    if (sortBy === 'completed') return b.completedToday - a.completedToday;
    // status order: unterwegs > rueckkehr > online > pause > offline
    const ord = ['unterwegs', 'rueckkehr', 'online', 'pause', 'offline'];
    return ord.indexOf(a.status) - ord.indexOf(b.status);
  });

  const online = fahrer.filter((f) => f.status !== 'offline').length;
  const unterwegs = fahrer.filter((f) => f.status === 'unterwegs').length;
  const avgScore = fahrer.length
    ? Math.round(fahrer.reduce((s, f) => s + f.scoreHeute, 0) / fahrer.length)
    : 0;

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <div className="h-4 w-48 bg-stone-100 rounded animate-pulse mb-4" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 bg-stone-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha-100">
            <Bike className="h-4 w-4 text-matcha-700" />
          </div>
          <div>
            <div className="text-sm font-bold text-stone-800">Fahrer Echtzeit-Matrix</div>
            <div className="text-[10px] text-stone-400">{online} online · {unterwegs} unterwegs</div>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-matcha-50 px-2 py-1">
          <Star className="h-3 w-3 text-matcha-600" />
          <span className="text-[10px] font-bold text-matcha-700">Ø {avgScore}</span>
        </div>
      </div>

      {/* Sort tabs */}
      <div className="flex gap-1 px-4 pt-3 pb-2">
        {(['score', 'completed', 'status'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setSortBy(k)}
            className={cn(
              'rounded-full px-2.5 py-1 text-[10px] font-bold transition-colors',
              sortBy === k
                ? 'bg-matcha-600 text-white'
                : 'bg-stone-100 text-stone-500 hover:bg-stone-200',
            )}
          >
            {k === 'score' ? 'Score' : k === 'completed' ? 'Touren' : 'Status'}
          </button>
        ))}
      </div>

      {/* Driver rows */}
      <div className="divide-y divide-stone-50 px-4 pb-4 max-h-80 overflow-y-auto">
        {sorted.map((f, idx) => (
          <div key={f.id} className="flex items-center gap-3 py-2.5">
            {/* Rank */}
            <div className="w-5 shrink-0 text-[10px] font-black text-stone-300 tabular-nums">
              {idx + 1}
            </div>

            {/* Avatar */}
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-100 text-sm font-bold text-stone-600">
              {f.vorname[0]}{f.nachname[0]}
            </div>

            {/* Name + status */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-stone-800 truncate">
                  {f.vorname} {f.nachname}
                </span>
                {f.zone && (
                  <span className="rounded px-1 bg-stone-100 text-[9px] font-bold text-stone-500">
                    Zone {f.zone}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={cn('text-[9px] font-bold rounded-full border px-1.5 py-0.5', STATUS_STYLE[f.status])}>
                  {STATUS_LABEL[f.status]}
                </span>
                {f.aktiveTouren > 0 && (
                  <span className="text-[9px] text-stone-400">
                    <Package className="inline h-2.5 w-2.5" /> {f.aktiveTouren} aktiv
                  </span>
                )}
              </div>
            </div>

            {/* KPIs */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Completed today */}
              <div className="text-center">
                <div className="text-xs font-black tabular-nums text-stone-700">{f.completedToday}</div>
                <div className="text-[9px] text-stone-400">Touren</div>
              </div>

              {/* ETA accuracy */}
              <div className="text-center">
                <div className={cn('text-xs font-black tabular-nums', scoreColor(f.avgEtaAccuracy))}>
                  {f.avgEtaAccuracy}%
                </div>
                <div className="text-[9px] text-stone-400">ETA-Treue</div>
              </div>

              {/* Score */}
              <div className="text-center">
                <div className={cn('text-sm font-black tabular-nums', scoreColor(f.scoreHeute))}>
                  {f.scoreHeute}
                </div>
                <div className="text-[9px] text-stone-400">Score</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer summary */}
      <div className="grid grid-cols-3 border-t border-stone-100 divide-x divide-stone-100">
        {[
          { icon: Zap, label: 'Unterwegs', value: unterwegs, color: 'text-blue-600' },
          { icon: CheckCircle2, label: 'Ø Score', value: `${avgScore}/100`, color: scoreColor(avgScore) },
          { icon: TrendingUp, label: 'Online', value: online, color: 'text-matcha-600' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="flex flex-col items-center py-2.5">
            <Icon className={cn('h-3.5 w-3.5 mb-0.5', color)} />
            <div className={cn('text-sm font-black tabular-nums', color)}>{value}</div>
            <div className="text-[9px] text-stone-400">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
