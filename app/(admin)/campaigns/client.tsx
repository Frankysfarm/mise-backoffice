'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, dateTimeDE } from '@/lib/utils';
import { ChevronRight, Clock, Mail, Send, Sparkles, TrendingUp } from 'lucide-react';

type Campaign = {
  id: string;
  name: string;
  betreff: string;
  status: string;
  empfaenger_count: number;
  versendet_count: number;
  geoeffnet_count: number;
  geklickt_count: number;
  sent_at: string | null;
  scheduled_at: string | null;
  created_at: string;
  voucher_code: string | null;
};

export function CampaignsList({ campaigns, resendReady }: { campaigns: Campaign[]; resendReady: boolean }) {
  if (campaigns.length === 0) {
    return (
      <Card className="p-12 text-center">
        <div className="h-16 w-16 mx-auto rounded-2xl bg-matcha-100 text-matcha-700 flex items-center justify-center mb-4">
          <Mail size={24} />
        </div>
        <h2 className="font-display text-xl font-bold">Noch keine Kampagnen</h2>
        <p className="text-muted-foreground mt-2 max-w-md mx-auto">
          Starte mit einer Welcome-Kampagne — 10 % Rabatt-Code an alle Bestellkunden der letzten 30 Tage.
        </p>
        {resendReady && (
          <Link
            href="/campaigns/new"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-matcha-900 text-matcha-50 px-5 py-2.5 text-sm font-bold"
          >
            <Sparkles size={14} /> Erste Kampagne erstellen
          </Link>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {campaigns.map((c) => <CampaignRow key={c.id} campaign={c} />)}
    </div>
  );
}

function CampaignRow({ campaign: c }: { campaign: Campaign }) {
  const openRate = c.versendet_count > 0 ? Math.round((c.geoeffnet_count / c.versendet_count) * 100) : 0;
  const clickRate = c.versendet_count > 0 ? Math.round((c.geklickt_count / c.versendet_count) * 100) : 0;

  return (
    <Link href={`/campaigns/${c.id}`}>
      <Card className="p-5 hover:shadow-soft transition group">
        <div className="flex items-start gap-4">
          <div className={cn(
            'h-11 w-11 rounded-xl flex items-center justify-center shrink-0',
            c.status === 'gesendet' && 'bg-matcha-500 text-white',
            c.status === 'geplant' && 'bg-gold text-matcha-900',
            c.status === 'entwurf' && 'bg-muted text-muted-foreground',
            c.status === 'fehler' && 'bg-red-500 text-white',
          )}>
            {c.status === 'gesendet' ? <Send size={18} /> :
             c.status === 'geplant' ? <Clock size={18} /> :
             <Mail size={18} />}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-display font-bold">{c.name}</h3>
              <StatusBadge status={c.status} />
              {c.voucher_code && (
                <span className="inline-flex items-center rounded-full bg-gold/20 text-matcha-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                  {c.voucher_code}
                </span>
              )}
            </div>
            <div className="mt-1 text-sm text-muted-foreground truncate">{c.betreff}</div>

            <div className="mt-3 flex items-center gap-4 text-xs">
              <span className="text-muted-foreground">
                {c.status === 'gesendet' && c.sent_at && `Versendet ${dateTimeDE(c.sent_at)}`}
                {c.status === 'geplant' && c.scheduled_at && `Geplant für ${dateTimeDE(c.scheduled_at)}`}
                {c.status === 'entwurf' && `Entwurf · erstellt ${dateTimeDE(c.created_at)}`}
              </span>
            </div>

            {c.status === 'gesendet' && c.versendet_count > 0 && (
              <div className="mt-3 flex gap-4 pt-3 border-t text-xs">
                <Metric label="Empfänger" value={c.empfaenger_count.toString()} />
                <Metric label="Versendet" value={c.versendet_count.toString()} />
                <Metric label="Öffnung" value={`${openRate}%`} positive={openRate > 30} />
                <Metric label="Click" value={`${clickRate}%`} positive={clickRate > 5} />
              </div>
            )}
          </div>

          <ChevronRight className="text-muted-foreground shrink-0 mt-2 transition-transform group-hover:translate-x-0.5" size={18} />
        </div>
      </Card>
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    entwurf: { label: 'Entwurf', cls: 'bg-muted text-muted-foreground' },
    geplant: { label: 'Geplant', cls: 'bg-gold/20 text-matcha-900' },
    versand: { label: 'Wird versendet', cls: 'bg-blue-100 text-blue-800 animate-pulse' },
    gesendet: { label: 'Versendet', cls: 'bg-matcha-500/20 text-matcha-800' },
    fehler: { label: 'Fehler', cls: 'bg-red-100 text-red-800' },
  };
  const s = map[status] ?? map.entwurf;
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', s.cls)}>{s.label}</span>;
}

function Metric({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={cn('font-display font-bold', positive && 'text-matcha-700')}>{value}</div>
    </div>
  );
}
