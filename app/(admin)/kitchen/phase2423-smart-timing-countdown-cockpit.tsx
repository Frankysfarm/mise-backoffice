'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Clock, Flame, CheckCircle2, AlertTriangle, Zap } from 'lucide-react';

interface OrderTiming {
  order_id: string;
  bestellnummer: string;
  kunde_name: string;
  sekunden_verbleibend: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  on_time: boolean;
  zubereitung_min: number;
}

interface ApiData {
  orders: OrderTiming[];
  on_time_quote: number;
  avg_verbleibend_sek: number;
  alert_count: number;
}

function ampelBg(a: string) {
  if (a === 'gruen') return 'bg-green-100 border-green-300 text-green-800';
  if (a === 'gelb') return 'bg-amber-100 border-amber-300 text-amber-800';
  return 'bg-red-100 border-red-300 text-red-800';
}

function formatCountdown(sek: number) {
  if (sek <= 0) return '00:00';
  const m = Math.floor(sek / 60);
  const s = sek % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function KitchenPhase2423SmartTimingCountdownCockpit({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);
  const [tick, setTick] = useState(0);

  async function load() {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/kitchen/queue?location_id=${locationId}`);
      if (!r.ok) return;
      const raw = await r.json();
      const orders: OrderTiming[] = (raw.orders ?? raw.queue ?? []).map((o: any) => {
        const zubereitungSek = (o.geschaetzte_zubereitung_min ?? o.zubereitung_min ?? 15) * 60;
        const elapsedSek = o.elapsed_sek ?? 0;
        const verbleibend = Math.max(0, zubereitungSek - elapsedSek);
        const ampel: 'gruen' | 'gelb' | 'rot' = verbleibend > 300 ? 'gruen' : verbleibend > 60 ? 'gelb' : 'rot';
        return {
          order_id: o.id ?? o.order_id,
          bestellnummer: o.bestellnummer ?? '#–',
          kunde_name: o.kunde_name ?? 'Gast',
          sekunden_verbleibend: verbleibend,
          ampel,
          on_time: verbleibend > 0,
          zubereitung_min: o.geschaetzte_zubereitung_min ?? 15,
        };
      });
      const on_time_quote = orders.length > 0
        ? Math.round((orders.filter(o => o.on_time).length / orders.length) * 100)
        : 100;
      const avg_verbleibend_sek = orders.length > 0
        ? Math.round(orders.reduce((s, o) => s + o.sekunden_verbleibend, 0) / orders.length)
        : 0;
      setData({ orders, on_time_quote, avg_verbleibend_sek, alert_count: orders.filter(o => o.ampel === 'rot').length });
    } catch {}
  }

  useEffect(() => {
    load();
    const poll = setInterval(load, 30_000);
    const countdown = setInterval(() => {
      setTick(t => t + 1);
      setData(d => {
        if (!d) return d;
        return {
          ...d,
          orders: d.orders.map(o => ({
            ...o,
            sekunden_verbleibend: Math.max(0, o.sekunden_verbleibend - 1),
            ampel: Math.max(0, o.sekunden_verbleibend - 1) > 300 ? 'gruen' : Math.max(0, o.sekunden_verbleibend - 1) > 60 ? 'gelb' : 'rot',
          })),
        };
      });
    }, 1_000);
    return () => { clearInterval(poll); clearInterval(countdown); };
  }, [locationId]);

  const hasAlert = (data?.alert_count ?? 0) > 0;

  return (
    <div className={`rounded-xl border mb-3 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-matcha-200 bg-matcha-50'}`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <Clock size={16} className={hasAlert ? 'text-red-600' : 'text-matcha-600'} />
          <span className={`font-semibold text-sm ${hasAlert ? 'text-red-800' : 'text-matcha-800'}`}>
            Smart-Timing Countdown
            {data ? ` — On-Time ${data.on_time_quote} %` : ''}
          </span>
          {hasAlert && (
            <span className="text-xs bg-red-200 text-red-800 rounded-full px-2 py-0.5">
              {data!.alert_count} überfällig
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {!data ? (
            <p className="text-xs text-gray-500">Lade…</p>
          ) : data.orders.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-matcha-700 bg-matcha-100 rounded-lg p-2">
              <CheckCircle2 size={13} />
              <span>Keine aktiven Bestellungen in Zubereitung.</span>
            </div>
          ) : (
            <>
              {/* KPI strip */}
              <div className="grid grid-cols-3 gap-2 mb-2">
                <div className="bg-white border border-matcha-100 rounded-lg p-2 text-center">
                  <div className="text-lg font-black tabular-nums text-matcha-700">{data.on_time_quote}%</div>
                  <div className="text-[10px] text-gray-500">On-Time</div>
                </div>
                <div className="bg-white border border-blue-100 rounded-lg p-2 text-center">
                  <div className="text-lg font-black tabular-nums text-blue-700">{data.orders.length}</div>
                  <div className="text-[10px] text-gray-500">Aktiv</div>
                </div>
                <div className={`rounded-lg p-2 text-center ${hasAlert ? 'bg-red-100 border border-red-200' : 'bg-white border border-gray-100'}`}>
                  <div className={`text-lg font-black tabular-nums ${hasAlert ? 'text-red-700' : 'text-gray-700'}`}>{data.alert_count}</div>
                  <div className="text-[10px] text-gray-500">Alarm</div>
                </div>
              </div>

              {/* Order list with countdown */}
              <div className="space-y-1.5">
                {data.orders.slice(0, 8).map(o => (
                  <div key={o.order_id} className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${ampelBg(o.ampel)}`}>
                    <div className="flex items-center gap-2">
                      {o.ampel === 'rot' ? <Flame size={12} /> : o.ampel === 'gelb' ? <AlertTriangle size={12} /> : <Zap size={12} />}
                      <span className="font-mono font-bold">{o.bestellnummer.replace('FF-', '#')}</span>
                      <span className="truncate max-w-[80px]">{o.kunde_name}</span>
                    </div>
                    <div className="font-mono font-black text-sm tabular-nums">
                      {formatCountdown(o.sekunden_verbleibend)}
                    </div>
                  </div>
                ))}
                {data.orders.length > 8 && (
                  <p className="text-[10px] text-gray-500 text-center">+{data.orders.length - 8} weitere</p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
