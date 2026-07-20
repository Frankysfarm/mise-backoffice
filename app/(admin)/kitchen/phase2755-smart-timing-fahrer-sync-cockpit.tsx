'use client';
import { useEffect, useState } from 'react';
import { ChefHat, Clock, Bike, AlertTriangle, CheckCircle2, Timer, Zap, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderTiming {
  order_id: string;
  bestellnummer: string;
  kunde: string;
  items_count: number;
  kochstart_am: string | null;
  prep_time_min: number;
  status: 'in_zubereitung' | 'fertig' | 'fertig_wartend';
  fahrer_name: string | null;
  fahrer_eta_min: number | null;
}

interface ApiData {
  orders: OrderTiming[];
  avg_prep_min: number;
  sync_rate: number;
}

function secsLeft(kochstartIso: string | null, prepMin: number): number | null {
  if (!kochstartIso) return null;
  return Math.floor((new Date(kochstartIso).getTime() + prepMin * 60_000 - Date.now()) / 1_000);
}

function fmtMmSs(sec: number): string {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sec < 0 ? '-' : ''}${m}:${String(s).padStart(2, '0')}`;
}

type Ampel = 'gruen' | 'gelb' | 'rot' | 'warten';

function getAmpel(secs: number | null, fahrerEta: number | null): Ampel {
  if (secs === null) return 'gelb';
  if (secs < 0) return 'rot';
  if (fahrerEta !== null && Math.abs(secs / 60 - fahrerEta) <= 2) return 'gruen';
  if (secs < 90) return 'gelb';
  return 'gruen';
}

const AMPEL_STYLES: Record<Ampel, { bg: string; text: string; border: string; dot: string }> = {
  gruen: { bg: 'bg-matcha-50', text: 'text-matcha-800', border: 'border-matcha-200', dot: 'bg-matcha-500' },
  gelb: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', dot: 'bg-amber-400' },
  rot: { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200', dot: 'bg-red-500' },
  warten: { bg: 'bg-stone-50', text: 'text-stone-600', border: 'border-stone-200', dot: 'bg-stone-400' },
};

const MOCK: ApiData = {
  orders: [
    { order_id: 'o1', bestellnummer: '#1042', kunde: 'Max M.', items_count: 3, kochstart_am: new Date(Date.now() - 8 * 60_000).toISOString(), prep_time_min: 12, status: 'in_zubereitung', fahrer_name: 'Tom K.', fahrer_eta_min: 4 },
    { order_id: 'o2', bestellnummer: '#1043', kunde: 'Sara K.', items_count: 2, kochstart_am: new Date(Date.now() - 16 * 60_000).toISOString(), prep_time_min: 15, status: 'in_zubereitung', fahrer_name: 'Anna B.', fahrer_eta_min: 2 },
    { order_id: 'o3', bestellnummer: '#1044', kunde: 'Tim B.', items_count: 4, kochstart_am: new Date(Date.now() - 2 * 60_000).toISOString(), prep_time_min: 10, status: 'in_zubereitung', fahrer_name: null, fahrer_eta_min: null },
    { order_id: 'o4', bestellnummer: '#1041', kunde: 'Julia F.', items_count: 1, kochstart_am: new Date(Date.now() - 20 * 60_000).toISOString(), prep_time_min: 8, status: 'fertig_wartend', fahrer_name: 'Lars P.', fahrer_eta_min: 6 },
  ],
  avg_prep_min: 11.2,
  sync_rate: 82,
};

export function KitchenPhase2755SmartTimingFahrerSyncCockpit({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [, setTick] = useState(0);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    const load = () =>
      fetch(`/api/delivery/admin/kitchen-countdown?location_id=${locationId ?? ''}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));

    if (!locationId) { setData(MOCK); return; }
    load();
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
  }, [locationId]);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1_000);
    return () => clearInterval(iv);
  }, []);

  if (!data) return null;

  const active = data.orders.filter(o => o.status === 'in_zubereitung');
  const waiting = data.orders.filter(o => o.status === 'fertig_wartend');
  const late = active.filter(o => (secsLeft(o.kochstart_am, o.prep_time_min) ?? 0) < 0).length;
  const synced = active.filter(o => {
    const s = secsLeft(o.kochstart_am, o.prep_time_min);
    return s !== null && o.fahrer_eta_min !== null && Math.abs(s / 60 - o.fahrer_eta_min) <= 2;
  }).length;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        className="flex w-full items-center gap-3 px-5 py-4"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha-100 text-matcha-700">
          <ChefHat className="h-4 w-4" />
        </div>
        <div className="flex-1 text-left">
          <div className="text-sm font-bold text-char">Smart-Timing &amp; Fahrer-Sync</div>
          <div className="text-[11px] text-stone-400">
            {active.length} in Zubereitung · {synced} synchron · {waiting.length} wartet auf Fahrer
          </div>
        </div>
        <div className="flex items-center gap-2">
          {late > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
              <AlertTriangle className="h-3 w-3" />{late} überfällig
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
            <Zap className="h-3 w-3" />{data.sync_rate}% Sync
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-stone-100 divide-y divide-stone-100">
          {data.orders.map(order => {
            const secs = secsLeft(order.kochstart_am, order.prep_time_min);
            const ampel = order.status === 'fertig_wartend' ? 'warten' : getAmpel(secs, order.fahrer_eta_min);
            const style = AMPEL_STYLES[ampel];
            const progress = secs !== null
              ? Math.max(0, Math.min(100, ((order.prep_time_min * 60 - Math.max(0, secs)) / (order.prep_time_min * 60)) * 100))
              : 0;

            return (
              <div key={order.order_id} className={cn('px-5 py-3', style.bg)}>
                <div className="flex items-center gap-3">
                  <div className={cn('h-2.5 w-2.5 rounded-full shrink-0', style.dot)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold tabular-nums">{order.bestellnummer}</span>
                      <span className="text-xs text-stone-500 truncate">{order.kunde}</span>
                      <span className="text-[10px] text-stone-400">{order.items_count} Pos.</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full rounded-full bg-white/60">
                      <div
                        className={cn('h-full rounded-full transition-all', ampel === 'rot' ? 'bg-red-500' : ampel === 'gelb' ? 'bg-amber-400' : ampel === 'gruen' ? 'bg-matcha-500' : 'bg-stone-300')}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {order.status === 'fertig_wartend' ? (
                      <div className="flex items-center gap-1 text-xs text-stone-500">
                        <CheckCircle2 className="h-3.5 w-3.5 text-matcha-500" />
                        <span className="font-semibold text-matcha-700">Fertig</span>
                      </div>
                    ) : (
                      <div className={cn('flex items-center gap-1 text-xs font-bold tabular-nums', style.text)}>
                        <Timer className="h-3.5 w-3.5" />
                        {secs !== null ? fmtMmSs(secs) : '—'}
                      </div>
                    )}
                    {order.fahrer_name ? (
                      <div className="flex items-center gap-1 text-[11px] text-stone-500">
                        <Bike className="h-3 w-3" />
                        <span>{order.fahrer_name}</span>
                        {order.fahrer_eta_min !== null && (
                          <span className="font-bold text-matcha-700">~{order.fahrer_eta_min} Min</span>
                        )}
                      </div>
                    ) : (
                      <div className="text-[11px] text-stone-400 flex items-center gap-1">
                        <Bike className="h-3 w-3" />Kein Fahrer
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          <div className="grid grid-cols-3 gap-4 px-5 py-3 bg-stone-50">
            <div className="text-center">
              <div className="text-lg font-black tabular-nums text-char">{data.avg_prep_min.toFixed(1)}</div>
              <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">Ø Prep-Zeit Min</div>
            </div>
            <div className="text-center">
              <div className={cn('text-lg font-black tabular-nums', late > 0 ? 'text-red-600' : 'text-matcha-700')}>{late}</div>
              <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">Überfällig</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-black tabular-nums text-matcha-700">{data.sync_rate}%</div>
              <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide flex items-center justify-center gap-1">
                <TrendingUp className="h-2.5 w-2.5" />Sync-Rate
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
