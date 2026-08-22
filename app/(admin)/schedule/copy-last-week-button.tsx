'use client';

import * as React from 'react';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Copy, Loader2 } from 'lucide-react';
import { toastError, toastSuccess } from '@/components/ui/toaster';

export function CopyLastWeekButton({
  weekStart, locationId,
}: {
  weekStart: Date;
  locationId?: string;
}) {
  const router = useRouter();
  const [isPending, start] = useTransition();

  async function onCopy() {
    const prevStart = new Date(weekStart); prevStart.setDate(prevStart.getDate() - 7);
    const prevEnd = new Date(weekStart);

    const sb = createClient();
    let q = sb.from('shifts')
      .select('employee_id,department_id,location_id,start_zeit,end_zeit,pause_minuten,position,typ,notiz')
      .gte('start_zeit', prevStart.toISOString())
      .lt('start_zeit', prevEnd.toISOString());
    if (locationId) q = q.eq('location_id', locationId);

    const { data: src, error: readErr } = await q;
    if (readErr) { toastError('Fehler beim Lesen', readErr.message); return; }
    if (!src || src.length === 0) {
      toastError('Keine Schichten in Vorwoche', 'Nichts zu kopieren.');
      return;
    }

    // Check: gibt es bereits Schichten in der Zielwoche?
    const targetEnd = new Date(weekStart); targetEnd.setDate(targetEnd.getDate() + 7);
    let existsQ = sb.from('shifts').select('id', { count: 'exact', head: true })
      .gte('start_zeit', weekStart.toISOString())
      .lt('start_zeit', targetEnd.toISOString());
    if (locationId) existsQ = existsQ.eq('location_id', locationId);
    const { count } = await existsQ;

    const confirmMsg = count && count > 0
      ? `In dieser Woche gibt es bereits ${count} Schicht(en). ${src.length} aus der Vorwoche zusätzlich übernehmen?`
      : `${src.length} Schichten aus der Vorwoche übernehmen?`;
    if (!confirm(confirmMsg)) return;

    start(async () => {
      const rows = (src as any[]).map(s => {
        const newStart = new Date(s.start_zeit); newStart.setDate(newStart.getDate() + 7);
        const newEnd = new Date(s.end_zeit); newEnd.setDate(newEnd.getDate() + 7);
        return {
          employee_id: s.employee_id,
          department_id: s.department_id,
          location_id: s.location_id,
          start_zeit: newStart.toISOString(),
          end_zeit: newEnd.toISOString(),
          pause_minuten: s.pause_minuten,
          position: s.position,
          typ: s.typ ?? 'normal',
          notiz: s.notiz,
          status: s.employee_id ? 'bestätigt' : 'geplant',
        };
      });
      const { error } = await sb.from('shifts').insert(rows);
      if (error) { toastError('Kopieren fehlgeschlagen', error.message); return; }
      toastSuccess(`${rows.length} Schichten übernommen`, 'Aus der Vorwoche kopiert.');
      router.refresh();
    });
  }

  return (
    <Button variant="outline" onClick={onCopy} disabled={isPending}>
      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
      Letzte Woche kopieren
    </Button>
  );
}
