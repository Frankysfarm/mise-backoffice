'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Calendar, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

type UpcomingShift = {
  id: string;
  planned_start: string;
  planned_end: string;
  status: string;
};

type OfflineBundle = {
  lastUpdated: string;
  upcomingShifts: UpcomingShift[];
  driver: { name: string };
  restaurant: { name: string; address: string; phone: string | null } | null;
};

function fmt(iso: string) {
  const d = new Date(iso);
  const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const day = days[d.getDay()];
  const date = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return { day, date, time };
}

export function OfflineNetworkBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [bundle, setBundle] = useState<OfflineBundle | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => {
      setIsOffline(true);
      // Fetch from SW cache
      fetch('/api/delivery/driver/offline-bundle')
        .then((r) => r.ok ? r.json() : null)
        .then((d) => { if (d && !d.error) setBundle(d as OfflineBundle); })
        .catch(() => {});
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    // Check initial state
    if (!navigator.onLine) {
      setIsOffline(true);
      fetch('/api/delivery/driver/offline-bundle')
        .then((r) => r.ok ? r.json() : null)
        .then((d) => { if (d && !d.error) setBundle(d as OfflineBundle); })
        .catch(() => {});
    }

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (!isOffline) return null;

  const lastUpdated = bundle?.lastUpdated
    ? new Date(bundle.lastUpdated).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[60]">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full bg-red-600 text-white px-4 py-2.5 flex items-center gap-3"
      >
        <WifiOff size={16} className="shrink-0 animate-pulse" />
        <span className="flex-1 text-left text-sm font-bold">Kein Internet</span>
        {lastUpdated && (
          <span className="text-[10px] text-white/70">Cache {lastUpdated}</span>
        )}
      </button>

      {expanded && bundle && (
        <div className="bg-matcha-800 border-b border-white/10 px-4 pb-3 pt-1">
          {/* Restaurant-Info */}
          {bundle.restaurant && (
            <div className="mb-2 rounded-lg bg-white/5 px-3 py-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-matcha-400">Restaurant</div>
              <div className="text-sm font-bold text-matcha-100 mt-0.5">{bundle.restaurant.name}</div>
              <div className="text-[11px] text-matcha-300">{bundle.restaurant.address}</div>
              {bundle.restaurant.phone && (
                <a href={`tel:${bundle.restaurant.phone}`} className="text-[11px] text-accent">{bundle.restaurant.phone}</a>
              )}
            </div>
          )}

          {/* Upcoming Shifts */}
          {bundle.upcomingShifts.length > 0 ? (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-matcha-400 mb-1.5 flex items-center gap-1.5">
                <Calendar size={10} /> Nächste Schichten
              </div>
              <div className="space-y-1.5">
                {bundle.upcomingShifts.map((s) => {
                  const start = fmt(s.planned_start);
                  const end = fmt(s.planned_end);
                  return (
                    <div key={s.id} className="flex items-center gap-3 rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                      <div className="text-center shrink-0">
                        <div className="text-[10px] font-bold text-matcha-400">{start.day}</div>
                        <div className="text-sm font-black text-accent leading-none">{start.date}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 text-[12px] font-bold text-matcha-100">
                          <Clock size={10} className="text-matcha-400" />
                          {start.time} – {end.time}
                        </div>
                        <div className={cn(
                          'text-[10px] font-bold mt-0.5',
                          s.status === 'active' ? 'text-accent' : 'text-matcha-400',
                        )}>
                          {s.status === 'active' ? 'Aktiv' : s.status === 'scheduled' ? 'Geplant' : s.status}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-matcha-400 text-center py-1">
              Keine geplanten Schichten
            </div>
          )}
        </div>
      )}
    </div>
  );
}
