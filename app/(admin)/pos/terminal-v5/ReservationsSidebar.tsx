'use client';

import { useEffect, useState, useCallback } from 'react';
import { Calendar, Clock, Users, ChevronRight, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Reservation {
  id: string;
  tisch_id: string | null;
  zeit_von: string;
  zeit_bis: string;
  gast_name: string;
  gast_telefon: string | null;
  gast_anzahl: number;
  status: 'angefragt' | 'bestaetigt' | 'wartet' | 'platziert' | 'noshow' | 'storniert' | 'beendet';
  notiz: string | null;
  tisch_nummer: string | null;
  tisch_name: string | null;
  phase: string; // 'jetzt' | 'bald' | 'spaeter' | 'vorbei'
}

const STATUS_COLOR: Record<string, string> = {
  angefragt: '#D69638',     // warn
  bestaetigt: '#7A8C4A',    // ok
  wartet: '#E68A2C',        // action
  platziert: '#5C554C',     // dim
  noshow: '#B84A3A',        // err
  storniert: '#3A3631',
  beendet: '#5C554C',
};

const STATUS_LABEL: Record<string, string> = {
  angefragt: 'Angefragt',
  bestaetigt: 'Bestätigt',
  wartet: 'Wartet',
  platziert: 'Platziert',
  noshow: 'No-Show',
  storniert: 'Storno',
  beendet: 'Beendet',
};

const PHASE_BG: Record<string, string> = {
  jetzt: 'rgba(230, 138, 44, 0.18)',     // saffron-tint
  bald: 'rgba(214, 150, 56, 0.10)',      // mustard-soft
  spaeter: 'rgba(255, 255, 255, 0.02)',
  vorbei: 'rgba(184, 74, 58, 0.08)',     // err-soft
};

interface Props {
  initialReservations: Reservation[];
  tenantId: string;
  locationId: string;
}

export function ReservationsSidebar({ initialReservations, tenantId, locationId }: Props) {
  const supabase = createClient();
  const [reservations, setReservations] = useState<Reservation[]>(initialReservations);
  const [collapsed, setCollapsed] = useState(false);

  const reload = useCallback(async () => {
    try {
      const r = await fetch('/api/pos/reservations/today', { cache: 'no-store' });
      const d = await r.json();
      if (d.reservations) setReservations(d.reservations);
    } catch {}
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(`reservations-${locationId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'tisch_reservierungen',
        filter: `location_id=eq.${locationId}`,
      }, () => { reload(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, locationId, reload]);

  // Refresh every 60s to update phase (jetzt/bald/...)
  useEffect(() => {
    const t = setInterval(reload, 60000);
    return () => clearInterval(t);
  }, [reload]);

  const activeReservations = reservations.filter(
    (r) => !['storniert', 'beendet', 'noshow'].includes(r.status),
  );

  if (activeReservations.length === 0) return null;

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        aria-label="Reservierungen anzeigen"
        style={{
          position: 'fixed', top: 80, right: 0, zIndex: 40,
          padding: '12px 14px',
          backgroundColor: '#0A0908',
          color: '#F2EDE3',
          border: '1px solid #2A2724',
          borderRight: 'none',
          borderTopLeftRadius: 12,
          borderBottomLeftRadius: 12,
          cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
          fontSize: 10, fontWeight: 600, letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}
      >
        <Calendar size={16} style={{ color: '#E68A2C' }} />
        <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
          {activeReservations.length} Reservierungen
        </span>
      </button>
    );
  }

  return (
    <aside
      style={{
        position: 'fixed', top: 72, right: 16, bottom: 16,
        width: 300, zIndex: 40,
        backgroundColor: '#0A0908',
        border: '1px solid #2A2724',
        borderRadius: 16,
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0, 0, 0, 0.4)',
        overflow: 'hidden',
        fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      }}
    >
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid #2A2724',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <Calendar size={16} style={{ color: '#E68A2C' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            color: '#F2EDE3',
            fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em',
          }}>Heute</div>
          <div style={{
            color: '#8E8579',
            fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
            fontSize: 9, letterSpacing: '0.14em',
            textTransform: 'uppercase', marginTop: 2,
          }}>{activeReservations.length} Reservierungen</div>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          aria-label="Schließen"
          style={{
            width: 28, height: 28, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: '#1F1D1A', color: '#8E8579',
            border: '1px solid #2A2724',
            cursor: 'pointer',
          }}
        >
          <X size={14} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {activeReservations.map((r) => {
          const fmtTime = (t: string) => t.slice(0, 5);
          return (
            <div
              key={r.id}
              style={{
                padding: 12,
                marginBottom: 8,
                borderRadius: 10,
                backgroundColor: PHASE_BG[r.phase] ?? '#171614',
                border: `1px solid ${r.phase === 'jetzt' ? '#E68A2C' : '#2A2724'}`,
                display: 'flex', flexDirection: 'column', gap: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={12} style={{ color: '#8E8579' }} />
                <span style={{
                  color: '#F2EDE3',
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: 13, fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '-0.01em',
                }}>{fmtTime(r.zeit_von)}</span>
                <span style={{
                  marginLeft: 'auto',
                  padding: '2px 8px',
                  borderRadius: 999,
                  backgroundColor: STATUS_COLOR[r.status] + '22',
                  color: STATUS_COLOR[r.status],
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: 9, fontWeight: 600,
                  letterSpacing: '0.10em',
                  textTransform: 'uppercase',
                }}>{STATUS_LABEL[r.status]}</span>
              </div>
              <div style={{
                color: '#F2EDE3',
                fontSize: 14, fontWeight: 600,
                letterSpacing: '-0.01em',
              }}>{r.gast_name}</div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                fontFamily: 'ui-monospace, monospace',
                fontSize: 11, color: '#8E8579',
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Users size={11} /> {r.gast_anzahl} P.
                </span>
                {r.tisch_nummer && (
                  <span>T{r.tisch_nummer}</span>
                )}
                <span style={{ marginLeft: 'auto', textTransform: 'uppercase', letterSpacing: '0.10em', fontSize: 9 }}>
                  {r.phase === 'jetzt' ? '🟠 JETZT' : r.phase === 'bald' ? 'BALD' : r.phase === 'spaeter' ? '' : 'VORBEI'}
                </span>
              </div>
              {r.notiz && (
                <div style={{
                  padding: '6px 8px', borderRadius: 6,
                  backgroundColor: 'rgba(214, 150, 56, 0.10)',
                  color: '#D69638',
                  fontSize: 11, fontWeight: 500,
                }}>📝 {r.notiz}</div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
