'use client';
import { useEffect, useState } from 'react';
import { Timer, ChevronDown, ChevronUp, Minus, TrendingDown, TrendingUp } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_sec: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_sec: number;
  gesamt: number;
}

const MOCK: ApiData = {
  fahrer: [{ fahrer_id: 'me', fahrer_name: 'Ich', rang: 2, avg_sec: 72, rank_delta: -1, ampel: 'gruen', alert_bottom: false }],
  team_avg_sec: 108,
  gesamt: 4,
};

function fmtSek(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return sec > 0 ? `${m}m ${sec}s` : `${m}m`;
}

function ampelCls(a: string) {
  if (a === 'rot')  return { text: 'text-red-600 dark:text-red-400',     bar: 'bg-red-500',   bg: 'bg-red-50 dark:bg-red-900/20'     };
  if (a === 'gelb') return { text: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' };
  return                   { text: 'text-green-600 dark:text-green-400', bar: 'bg-green-500', bg: 'bg-green-50 dark:bg-green-900/20' };
}

function tip(ampel: string): string {
  if (ampel === 'rot')  return 'Deine Stoppdauer ist sehr hoch. Bereite Übergaben vor und optimiere den Aushändigungsprozess.';
  if (ampel === 'gelb') return 'Deine Stoppdauer liegt im Mittelfeld. Kurze Checkliste an der Tür und vorbereitetes Wechselgeld können helfen.';
  return 'Sehr gut! Deine Stoppdauer gehört zu den kürzesten im Team — weiter so!';
}

function DeltaIcon({ delta }: { delta: number }) {
  if (delta < 0) return <TrendingDown size={13} className="text-green-500" />;
  if (delta > 0) return <TrendingUp   size={13} className="text-red-400"   />;
  return               <Minus         size={13} className="text-gray-400"  />;
}

export function FahrerPhase3247MeineStoppdauer({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!isOnline) return;
    let active = true;
    const load = async () => {
      try {
        const params = new URLSearchParams();
        if (locationId) params.set('location_id', locationId);
        if (driverId)   params.set('driver_id', driverId);
        const res = await fetch(`/api/delivery/admin/fahrer-stoppdauer-ranking?${params}`);
        if (res.ok && active) setData(await res.json());
      } catch {
        if (active) setData(MOCK);
      }
    };
    load();
    const iv = setInterval(load, 30 * 60 * 1000);
    return () => { active = false; clearInterval(iv); };
  }, [driverId, locationId, isOnline]);

  if (!isOnline) return null;

  const d = data ?? MOCK;
  const me = d.fahrer[0];
  if (!me) return null;
  const cls = ampelCls(me.ampel);
  const gesamt = d.gesamt || 4;
  const barWidth = Math.max(((gesamt - me.rang + 1) / gesamt) * 100, 4);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-3 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Timer size={15} className="text-blue-500" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Meine Ø-Stoppdauer</span>
        </div>
        {open ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
      </button>

      {open && (
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-center gap-6">
            <div className="text-center">
              <div className={`text-4xl font-black ${cls.text}`}>{me.rang}</div>
              <div className="text-xs text-gray-500 mt-0.5">Rang</div>
            </div>
            <div className="text-center">
              <div className={`text-4xl font-black ${cls.text}`}>{fmtSek(me.avg_sec)}</div>
              <div className="text-xs text-gray-500 mt-0.5">Ø-Stoppdauer</div>
            </div>
          </div>

          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all ${cls.bar}`}
              style={{ width: `${barWidth}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>Rang 1 (kürzeste)</span>
            <span>Rang {gesamt} (längste)</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-center">
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2">
              <div className="text-gray-400 mb-0.5 flex items-center justify-center gap-1">
                <DeltaIcon delta={me.rank_delta} /> Rang-Δ
              </div>
              <div className={`font-bold text-sm ${me.rank_delta < 0 ? 'text-green-600 dark:text-green-400' : me.rank_delta > 0 ? 'text-red-500' : 'text-gray-500'}`}>
                {me.rank_delta === 0 ? '±0' : me.rank_delta > 0 ? `+${me.rank_delta}` : `${me.rank_delta}`}
              </div>
            </div>
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-2">
              <div className="text-gray-400 mb-0.5">Team-Ø</div>
              <div className="font-bold text-sm text-blue-600 dark:text-blue-400">{fmtSek(Math.round(d.team_avg_sec))}</div>
            </div>
          </div>

          <div className={`rounded-lg px-3 py-2 text-xs ${cls.bg} ${cls.text}`}>
            {tip(me.ampel)}
          </div>
        </div>
      )}
    </div>
  );
}
