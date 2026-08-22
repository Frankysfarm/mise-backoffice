'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

type Event = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

/**
 * Abonniert postgres_changes auf einer Tabelle. Ein Channel pro Hook-Instanz.
 * Führt `onChange` aus bei jedem Event — der Consumer entscheidet, ob
 * Re-Fetch, State-Merge oder router.refresh() nötig ist.
 */
export function useRealtimeTable<T = any>(opts: {
  channel: string;
  table: string;
  event?: Event;
  filter?: string;
  onChange: (payload: { eventType: Event; new: T; old: T }) => void;
}) {
  const { channel: name, table, event = '*', filter, onChange } = opts;

  useEffect(() => {
    const sb = createClient();
    const ch = sb.channel(name)
      .on(
        'postgres_changes' as any,
        { event, schema: 'public', table, ...(filter ? { filter } : {}) },
        (payload: any) => onChange({ eventType: payload.eventType, new: payload.new, old: payload.old }),
      )
      .subscribe();
    return () => { sb.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, table, event, filter]);
}
