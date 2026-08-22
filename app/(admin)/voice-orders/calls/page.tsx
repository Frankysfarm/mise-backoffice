import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, Phone, AlertCircle } from 'lucide-react';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  in_progress: { label: 'läuft', color: 'bg-amber-100 text-amber-700' },
  completed: { label: 'beendet', color: 'bg-emerald-100 text-emerald-700' },
  failed: { label: 'fehlgeschlagen', color: 'bg-red-100 text-red-700' },
  escalated: { label: 'weitergeleitet', color: 'bg-violet-100 text-violet-700' },
};

export default async function VoiceCallsPage() {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const { data: empT } = await sb
    .from('employees').select('tenant_id').eq('id', emp.id).maybeSingle();
  if (!empT?.tenant_id) redirect('/start');

  const svc = createServiceClient();
  const { data: tenantModule } = await svc
    .from('tenant_modules').select('aktiv')
    .eq('tenant_id', empT.tenant_id).eq('module_id', 'voice_orders').maybeSingle();

  if (!tenantModule?.aktiv) redirect('/modules?locked=voice_orders');

  const { data: calls } = await svc
    .from('voice_calls')
    .select('id, conversation_id, status, started_at, duration_sec, caller_phone, order_id')
    .eq('tenant_id', empT.tenant_id)
    .order('started_at', { ascending: false })
    .limit(100);

  return (
    <>
      <PageHeader
        title="Anrufe"
        description="Eingehende Telefon-Bestellungen über die Voice-KI."
        backHref="/voice-orders"
      />

      {!calls || calls.length === 0 ? (
        <Card className="p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
            <Phone size={20} className="text-zinc-400" />
          </div>
          <p className="mt-3 text-sm font-medium">Noch keine Anrufe</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Sobald die ersten Anrufe reinkommen, erscheinen sie hier.
          </p>
          <Link
            href="/voice-orders"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900"
          >
            Zur Einrichtung <ArrowRight size={11} />
          </Link>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-zinc-50/60">
              <tr>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Zeit</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Anrufer</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Dauer</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Bestellung</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y">
              {calls.map((c) => {
                const s = STATUS_LABEL[c.status] ?? { label: c.status, color: 'bg-zinc-100 text-zinc-700' };
                return (
                  <tr key={c.id} className="hover:bg-zinc-50/40">
                    <td className="px-4 py-3 text-xs">
                      {new Date(c.started_at).toLocaleString('de-DE', {
                        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {c.caller_phone ?? <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums">
                      {c.duration_sec ? `${Math.floor(c.duration_sec / 60)}:${String(c.duration_sec % 60).padStart(2, '0')}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {c.order_id ? (
                        <Link href={`/dashboard?order=${c.order_id}`} className="text-emerald-700 underline-offset-2 hover:underline">
                          erfasst
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.color}`}>
                        {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/voice-orders/calls/${c.conversation_id}`}
                        className="text-xs text-zinc-500 hover:text-zinc-900"
                      >
                        ansehen <ArrowRight size={10} className="inline" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
