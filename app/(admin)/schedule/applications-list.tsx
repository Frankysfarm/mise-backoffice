'use client';

import * as React from 'react';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { toastError, toastSuccess } from '@/components/ui/toaster';
import { Check, X, Loader2, MessageCircle } from 'lucide-react';

type Application = {
  id: string;
  shift_id: string;
  employee_id: string;
  status: 'offen' | 'angenommen' | 'abgelehnt' | 'zurückgezogen';
  notiz: string | null;
  created_at: string;
  employee: { vorname: string | null; nachname: string | null; rolle: string | null } | null;
};

export function ApplicationsList({ shiftId }: { shiftId: string }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [apps, setApps] = React.useState<Application[]>([]);
  const [pending, start] = useTransition();

  const load = React.useCallback(async () => {
    setLoading(true);
    const { data } = await createClient()
      .from('shift_applications')
      .select('id,shift_id,employee_id,status,notiz,created_at,employee:employees!shift_applications_employee_id_fkey(vorname,nachname,rolle)')
      .eq('shift_id', shiftId)
      .order('created_at');
    setApps((data as any[]) ?? []);
    setLoading(false);
  }, [shiftId]);

  React.useEffect(() => { load(); }, [load]);

  function decide(app: Application, decision: 'angenommen' | 'abgelehnt') {
    start(async () => {
      const { error } = await createClient()
        .from('shift_applications')
        .update({ status: decision, entschieden_am: new Date().toISOString() })
        .eq('id', app.id);
      if (error) { toastError('Entscheidung fehlgeschlagen', error.message); return; }
      toastSuccess(decision === 'angenommen' ? 'Bewerbung angenommen' : 'Bewerbung abgelehnt');
      await load();
      router.refresh();
    });
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Bewerbungen werden geladen …
      </div>
    );
  }

  if (apps.length === 0) {
    return (
      <div className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
        Noch keine Bewerbungen. Sobald jemand sich bewirbt, erscheint er hier.
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="text-xs font-semibold text-matcha-700">
        {apps.filter(a => a.status === 'offen').length} offene · {apps.length} gesamt
      </div>
      {apps.map(a => (
        <div
          key={a.id}
          className={`flex items-start justify-between gap-2 rounded-md border p-2 text-xs ${
            a.status === 'angenommen' ? 'border-matcha-300 bg-matcha-50' :
            a.status === 'abgelehnt'  ? 'border-border bg-muted/40 opacity-60' :
            a.status === 'zurückgezogen' ? 'border-border bg-muted/30 opacity-50' :
                                        'bg-card'
          }`}
        >
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-medium">
                {a.employee?.vorname} {a.employee?.nachname}
              </span>
              {a.employee?.rolle && <span className="text-[10px] text-muted-foreground">({a.employee.rolle})</span>}
              <StatusBadge status={a.status} />
            </div>
            {a.notiz && (
              <div className="mt-0.5 flex items-start gap-1 text-muted-foreground">
                <MessageCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                <span className="italic">„{a.notiz}"</span>
              </div>
            )}
            <div className="text-[10px] text-muted-foreground">
              {new Date(a.created_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          {a.status === 'offen' && (
            <div className="flex gap-1">
              <Button size="sm" variant="secondary" disabled={pending} onClick={() => decide(a, 'angenommen')}>
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => decide(a, 'abgelehnt')}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    offen:         'bg-gold/15 text-gold',
    angenommen:    'bg-matcha-600/15 text-matcha-800',
    abgelehnt:     'bg-destructive/10 text-destructive',
    zurückgezogen: 'bg-muted text-muted-foreground',
  };
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${map[status] ?? 'bg-muted'}`}>
      {status}
    </span>
  );
}
