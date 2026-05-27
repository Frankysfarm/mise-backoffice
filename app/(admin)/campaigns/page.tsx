import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, Bell, Mail, Plus, Send, Users } from 'lucide-react';
import { CampaignsList } from './client';

export const dynamic = 'force-dynamic';

export default async function CampaignsPage() {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empT } = await sb.from('employees').select('tenant_id').eq('id', emp.id).maybeSingle();
  if (!empT?.tenant_id) redirect('/start');

  const [{ data: tenant }, { data: campaigns }, { data: audience }] = await Promise.all([
    svc.from('tenants').select('resend_verified_at, resend_from_email').eq('id', empT.tenant_id).single(),
    svc.from('email_campaigns').select('*').eq('tenant_id', empT.tenant_id).order('created_at', { ascending: false }),
    svc.rpc('campaign_audience', { p_tenant_id: empT.tenant_id, p_audience: 'all_customers' }),
  ]);

  const resendReady = !!tenant?.resend_verified_at;
  const audienceCount = (audience as any[])?.length ?? 0;

  return (
    <>
      <PageHeader
        title="Kampagnen"
        description="E-Mails und Push-Nachrichten an deine Kunden — Angebote, News, Stammkunden-Infos."
        actions={
          <div className="flex gap-2">
            <Link href="/campaigns/push">
              <Button variant="outline" className="gap-2">
                <Bell className="h-4 w-4" /> Push senden
              </Button>
            </Link>
            {resendReady ? (
              <Link href="/campaigns/new">
                <Button className="gap-2">
                  <Plus className="h-4 w-4" /> Neue Kampagne
                </Button>
              </Link>
            ) : null}
          </div>
        }
      />

      {!resendReady && (
        <Card className="p-5 border-amber-300 bg-amber-50 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-bold text-amber-900">Erst Resend verbinden</div>
              <p className="text-sm text-amber-800 mt-1">
                Um Kampagnen zu versenden, benötigst du einen Resend-Account mit verifizierter Domain.
              </p>
              <Link href="/settings/email" className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-900 text-white px-4 py-2 text-sm font-bold hover:bg-amber-800">
                Jetzt einrichten →
              </Link>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-matcha-100 text-matcha-700 flex items-center justify-center">
              <Users size={18} />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Empfänger gesamt</div>
              <div className="font-display text-2xl font-bold">{audienceCount}</div>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-matcha-100 text-matcha-700 flex items-center justify-center">
              <Mail size={18} />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Kampagnen gesamt</div>
              <div className="font-display text-2xl font-bold">{campaigns?.length ?? 0}</div>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-matcha-100 text-matcha-700 flex items-center justify-center">
              <Send size={18} />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Versendet (alle Kampagnen)</div>
              <div className="font-display text-2xl font-bold">
                {(campaigns as any[])?.reduce((s, c) => s + (c.versendet_count ?? 0), 0) ?? 0}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <CampaignsList campaigns={(campaigns as any[]) ?? []} resendReady={resendReady} />
    </>
  );
}
