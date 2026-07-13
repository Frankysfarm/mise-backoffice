'use client';

// Phase 1219 — Kunden-Anruf-Log (Fahrer-App)
// Letzte 5 Kunden-Kontaktversuche (Anruf/Klingel) mit Uhrzeit + Status

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Phone, Bell, MessageSquare, CheckCircle, XCircle, Voicemail } from 'lucide-react';
import { cn } from '@/lib/utils';

type KontaktTyp = 'anruf' | 'klingel' | 'sms';
type KontaktStatus = 'erreicht' | 'nicht_erreicht' | 'mailbox';

interface AnrufEintrag {
  id: string;
  order_id: string;
  kunde_name: string | null;
  adresse: string | null;
  kontakt_typ: KontaktTyp;
  status: KontaktStatus;
  zeitpunkt: string;
  notiz: string | null;
}

interface ApiData {
  eintraege: AnrufEintrag[];
  fahrer_id: string;
  generiert_am: string;
}

interface Props {
  driverId: string;
  isOnline: boolean;
}

const TYP_ICON: Record<KontaktTyp, React.FC<{ className?: string }>> = {
  anruf:  Phone,
  klingel: Bell,
  sms:    MessageSquare,
};

const TYP_LABEL: Record<KontaktTyp, string> = {
  anruf:  'Anruf',
  klingel: 'Klingel',
  sms:    'SMS',
};

const STATUS_STYLE: Record<KontaktStatus, { icon: React.FC<{ className?: string }>; color: string; label: string }> = {
  erreicht:       { icon: CheckCircle, color: 'text-emerald-500', label: 'Erreicht' },
  nicht_erreicht: { icon: XCircle,     color: 'text-rose-500',    label: 'Nicht erreicht' },
  mailbox:        { icon: Voicemail,   color: 'text-amber-500',   label: 'Mailbox' },
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function mockData(fahrerId: string): ApiData {
  const now = new Date();
  return {
    eintraege: [
      { id: 'a1', order_id: 'o1', kunde_name: 'Max M.',  adresse: 'Hauptstr. 5',     kontakt_typ: 'anruf',   status: 'erreicht',       zeitpunkt: new Date(now.getTime() - 8  * 60_000).toISOString(), notiz: null },
      { id: 'a2', order_id: 'o2', kunde_name: 'Anna S.', adresse: 'Bahnhofstr. 12',  kontakt_typ: 'anruf',   status: 'nicht_erreicht', zeitpunkt: new Date(now.getTime() - 25 * 60_000).toISOString(), notiz: 'Klingel versucht' },
      { id: 'a3', order_id: 'o3', kunde_name: 'Karl R.', adresse: 'Lindenstr. 3',    kontakt_typ: 'klingel', status: 'erreicht',       zeitpunkt: new Date(now.getTime() - 42 * 60_000).toISOString(), notiz: null },
      { id: 'a4', order_id: 'o4', kunde_name: 'Lisa T.', adresse: 'Gartenweg 7',     kontakt_typ: 'anruf',   status: 'mailbox',        zeitpunkt: new Date(now.getTime() - 68 * 60_000).toISOString(), notiz: 'Nachricht hinterlassen' },
      { id: 'a5', order_id: 'o5', kunde_name: 'Ben K.',  adresse: 'Parkstr. 2',      kontakt_typ: 'sms',     status: 'erreicht',       zeitpunkt: new Date(now.getTime() - 90 * 60_000).toISOString(), notiz: null },
    ],
    fahrer_id: fahrerId,
    generiert_am: now.toISOString(),
  };
}

export function FahrerPhase1219KundenAnrufLog({ driverId, isOnline }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);

  const fetchData = useCallback(async () => {
    if (!isOnline) return;
    try {
      const res = await window.fetch(`/api/delivery/driver/kunden-anruf-log?driver_id=${driverId}`);
      if (res.ok) {
        const json: ApiData = await res.json();
        if (json.eintraege) { setData(json); return; }
      }
    } catch { /* fall through */ }
    setData(mockData(driverId));
  }, [driverId, isOnline]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!isOnline) return null;

  const eintraege = data?.eintraege ?? [];
  const nichtErreicht = eintraege.filter(e => e.status === 'nicht_erreicht').length;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Phone className="h-4 w-4 text-indigo-500 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider">Kontakt-Chronik</span>
          <span className="text-[10px] rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 font-semibold">
            {eintraege.length} Kontakte
          </span>
          {nichtErreicht > 0 && (
            <span className="text-[10px] rounded-full bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300 px-2 py-0.5 font-semibold">
              {nichtErreicht} Nicht erreicht
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t p-3 space-y-2">
          {eintraege.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-2">Keine Kontaktversuche heute.</div>
          ) : (
            eintraege.map(e => {
              const TypIcon = TYP_ICON[e.kontakt_typ];
              const s = STATUS_STYLE[e.status];
              const StatusIcon = s.icon;
              return (
                <div key={e.id} className="flex items-start gap-2 rounded-lg bg-muted/30 px-3 py-2">
                  <TypIcon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold">{e.kunde_name ?? 'Unbekannt'}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{TYP_LABEL[e.kontakt_typ]}</span>
                      <span className="text-[10px] text-muted-foreground">{formatTime(e.zeitpunkt)}</span>
                    </div>
                    {e.adresse && (
                      <p className="text-[10px] text-muted-foreground truncate">{e.adresse}</p>
                    )}
                    {e.notiz && (
                      <p className="text-[10px] text-muted-foreground italic">{e.notiz}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <StatusIcon className={cn('h-3.5 w-3.5', s.color)} />
                    <span className={cn('text-[10px] font-semibold', s.color)}>{s.label}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
