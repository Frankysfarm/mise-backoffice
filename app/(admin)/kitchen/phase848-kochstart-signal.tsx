'use client';

import { useEffect, useState } from 'react';
import { Flame, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KochstartEintrag {
  orderId: string;
  bestellnummer: string;
  kundeName: string;
  prepMin: number;
  pickupAt: string;
  cookStartAt: string;
  status: 'ueberfaellig' | 'jetzt' | 'bald' | 'ok';
  verbleibendSek: number;
}

interface KochstartData {
  eintraege: KochstartEintrag[];
  aktualisiert: string;
}

const MOCK: KochstartData = {
  aktualisiert: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
  eintraege: [
    {
      orderId: 'a1', bestellnummer: '1042', kundeName: 'Müller', prepMin: 12,
      pickupAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      cookStartAt: new Date(Date.now() - 2 * 60_000).toISOString(),
      status: 'ueberfaellig', verbleibendSek: -120,
    },
    {
      orderId: 'b2', bestellnummer: '1043', kundeName: 'Schmidt', prepMin: 15,
      pickupAt: new Date(Date.now() + 12 * 60_000).toISOString(),
      cookStartAt: new Date(Date.now() + 1 * 60_000).toISOString(),
      status: 'jetzt', verbleibendSek: 60,
    },
    {
      orderId: 'c3', bestellnummer: '1044', kundeName: 'Weber', prepMin: 10,
      pickupAt: new Date(Date.now() + 18 * 60_000).toISOString(),
      cookStartAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      status: 'bald', verbleibendSek: 300,
    },
  ],
};

function secsToLabel(secs: number): string {
  if (secs < 0) return `${Math.abs(Math.round(secs / 60))} Min überfällig`;
  if (secs < 60) return `${secs}s`;
  return `${Math.round(secs / 60)} Min`;
}

export function KitchenPhase848KochstartSignal({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<KochstartData | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const tick = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(tick);
  }, []);

  const fetchData = async () => {
    if (!locationId) { setData(MOCK); return; }
    try {
      const res = await fetch(`/api/delivery/kitchen/queue?location_id=${locationId}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('fetch');
      const json = await res.json();
      const now = Date.now();

      const eintraege: KochstartEintrag[] = (json.queue ?? [])
        .filter((q: any) => q.status === 'scheduled' || q.status === 'notified')
        .map((q: any) => {
          const cookStartMs = new Date(q.cook_start_at).getTime();
          const verbleibendSek = Math.round((cookStartMs - now) / 1000);
          const status: KochstartEintrag['status'] =
            verbleibendSek < -60 ? 'ueberfaellig' :
            verbleibendSek <= 120 ? 'jetzt' :
            verbleibendSek <= 300 ? 'bald' : 'ok';
          return {
            orderId: q.order_id,
            bestellnummer: q.order_id.slice(-4),
            kundeName: '–',
            prepMin: q.prep_min,
            pickupAt: q.tour_pickup_at,
            cookStartAt: q.cook_start_at,
            status,
            verbleibendSek,
          };
        })
        .filter((e: KochstartEintrag) => e.status !== 'ok')
        .sort((a: KochstartEintrag, b: KochstartEintrag) => a.verbleibendSek - b.verbleibendSek)
        .slice(0, 6);

      setData({ eintraege, aktualisiert: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) });
    } catch {
      setData(MOCK);
    }
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 15_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data || data.eintraege.length === 0) return null;

  const statusStyle = {
    ueberfaellig: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-300',
      badge: 'bg-red-500 text-white',
      label: 'Überfällig',
      icon: AlertTriangle,
      iconColor: 'text-red-500',
    },
    jetzt: {
      bg: 'bg-orange-50 dark:bg-orange-900/20',
      border: 'border-orange-300',
      badge: 'bg-orange-500 text-white',
      label: 'JETZT starten',
      icon: Flame,
      iconColor: 'text-orange-500',
    },
    bald: {
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      border: 'border-amber-300',
      badge: 'bg-amber-400 text-white',
      label: 'Bald',
      icon: Clock,
      iconColor: 'text-amber-500',
    },
    ok: {
      bg: 'bg-matcha-50',
      border: 'border-matcha-200',
      badge: 'bg-matcha-500 text-white',
      label: 'OK',
      icon: CheckCircle2,
      iconColor: 'text-matcha-600',
    },
  };

  const dringend = data.eintraege.filter((e) => e.status === 'ueberfaellig' || e.status === 'jetzt');

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-orange-50 dark:bg-orange-900/10">
        <Flame className="h-4 w-4 text-orange-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-orange-800 dark:text-orange-300">
          Kochstart-Signal
        </span>
        {dringend.length > 0 && (
          <span className="ml-auto inline-flex items-center rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white animate-pulse">
            {dringend.length} dringend
          </span>
        )}
        {dringend.length === 0 && (
          <span className="ml-auto text-[10px] text-muted-foreground">{data.aktualisiert}</span>
        )}
      </div>
      <div className="divide-y">
        {data.eintraege.map((e) => {
          const st = statusStyle[e.status];
          const Icon = st.icon;
          const nowMs = Date.now();
          const verbleibend = Math.round((new Date(e.cookStartAt).getTime() - nowMs) / 1000);
          return (
            <div key={e.orderId} className={cn('flex items-center gap-3 px-4 py-2.5', st.bg)}>
              <Icon className={cn('h-4 w-4 shrink-0', st.iconColor)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold">#{e.bestellnummer}</span>
                  {e.kundeName !== '–' && (
                    <span className="text-[10px] text-muted-foreground truncate">{e.kundeName}</span>
                  )}
                  <span className="text-[9px] text-muted-foreground ml-auto shrink-0">
                    {e.prepMin} Min Prep
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Abholung: {new Date(e.pickupAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div className={cn('shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black', st.badge)}>
                {verbleibend < 0
                  ? `${Math.abs(Math.round(verbleibend / 60))}m verspätet`
                  : verbleibend < 60
                  ? `${verbleibend}s`
                  : `${Math.round(verbleibend / 60)}m`}
              </div>
            </div>
          );
        })}
      </div>
      <div className="px-4 py-1.5 bg-muted/30 border-t">
        <p className="text-[9px] text-muted-foreground">15s-Update · Smart Kochstart-Signal · Phase 848</p>
      </div>
    </div>
  );
}
