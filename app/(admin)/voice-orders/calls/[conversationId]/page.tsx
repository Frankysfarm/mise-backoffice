import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Bot, User, Download, AlertCircle } from 'lucide-react';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { Card } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export default async function CallDetailPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const { data: empT } = await sb
    .from('employees').select('tenant_id').eq('id', emp.id).maybeSingle();
  if (!empT?.tenant_id) redirect('/start');

  const svc = createServiceClient();
  const { data: call } = await svc
    .from('voice_calls')
    .select(
      'id, conversation_id, status, started_at, ended_at, duration_sec, caller_phone, transcript, recording_url, notes, order_id',
    )
    .eq('tenant_id', empT.tenant_id)
    .eq('conversation_id', conversationId)
    .maybeSingle();

  if (!call) notFound();

  const transcript = (call.transcript as Array<{ role: string; content: string }> | null) ?? [];

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/voice-orders/calls"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={14} /> Zur Anruf-Liste
      </Link>

      <Card className="mb-4 p-5">
        <div className="text-sm font-semibold">
          Anruf von {call.caller_phone ?? <span className="text-muted-foreground">unbekannter Nummer</span>}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {new Date(call.started_at).toLocaleString('de-DE', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
          })}
          {call.duration_sec && (
            <> · {Math.floor(call.duration_sec / 60)}:{String(call.duration_sec % 60).padStart(2, '0')} Min</>
          )}
          {call.order_id && (
            <> · <Link href={`/dashboard?order=${call.order_id}`} className="text-emerald-700 underline-offset-2 hover:underline">Bestellung erfasst</Link></>
          )}
        </div>

        {call.recording_url && (
          <div className="mt-4 border-t pt-4">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-semibold">Aufzeichnung</span>
              <a
                href={call.recording_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <Download size={11} /> Download
              </a>
            </div>
            <audio controls className="w-full">
              <source src={call.recording_url} />
            </audio>
          </div>
        )}

        {call.notes && (
          <div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
            <strong>Hinweis:</strong> {call.notes}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 text-sm font-semibold">Transkript</h2>
        {transcript.length === 0 ? (
          <p className="text-xs text-muted-foreground">Kein Transkript verfügbar.</p>
        ) : (
          <div className="space-y-3">
            {transcript.map((t, i) => {
              const isAgent = t.role === 'agent';
              return (
                <div
                  key={i}
                  className={`flex items-start gap-2 ${isAgent ? 'justify-start' : 'justify-end'}`}
                >
                  {isAgent && (
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white">
                      <Bot size={13} />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                      isAgent
                        ? 'rounded-tl-md bg-zinc-100 text-zinc-900'
                        : 'rounded-tr-md bg-blue-600 text-white'
                    }`}
                  >
                    {t.content}
                  </div>
                  {!isAgent && (
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                      <User size={13} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
