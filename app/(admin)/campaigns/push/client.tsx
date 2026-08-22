'use client';

import { useState, useTransition } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Bell, Check, Loader2, Send, Smartphone, Sparkles, Users } from 'lucide-react';

type Recent = {
  id: string; title: string; body: string;
  created_at: string; sent_at: string | null; error: string | null;
};

type Segment = 'all' | 'last_30' | 'new_3';

export function PushComposer({
  tenantId, totalSubscribers, recentCampaigns,
}: {
  tenantId: string;
  totalSubscribers: number;
  recentCampaigns: Recent[];
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl]   = useState('');
  const [segment, setSegment] = useState<Segment>('all');
  const [sending, startSending] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; msg: string; count?: number } | null>(null);

  const canSend = title.trim().length >= 2 && body.trim().length >= 4 && !sending && totalSubscribers > 0;

  const segmentCount =
    segment === 'all' ? totalSubscribers :
    segment === 'last_30' ? Math.round(totalSubscribers * 0.6) :
    Math.round(totalSubscribers * 0.2);

  async function send() {
    setResult(null);
    startSending(async () => {
      const res = await fetch('/api/push/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, title, body, url, segment }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setResult({ ok: false, msg: data.error ?? 'Fehler beim Senden' });
        return;
      }
      setResult({ ok: true, msg: 'Push wird versendet', count: data.queued });
      setTitle(''); setBody(''); setUrl('');
    });
  }

  async function testToMe() {
    setResult(null);
    const res = await fetch('/api/push/campaign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantId, title, body, url, segment: 'test' }),
    });
    const data = await res.json();
    setResult({ ok: res.ok, msg: res.ok ? 'Test gesendet — check dein Handy' : data.error ?? 'Test fehlgeschlagen' });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
      {/* Composer */}
      <div className="space-y-4">
        {/* Empfänger */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-matcha-700" />
            <h3 className="font-display font-bold">Empfänger</h3>
          </div>

          {totalSubscribers === 0 ? (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
              Noch keine Kunden abonniert. Nach der ersten Bestellung kann dein Kunde über den Tracking-Link Push aktivieren.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <SegmentButton active={segment === 'all'} onClick={() => setSegment('all')}
                  label="Alle" count={totalSubscribers} />
                <SegmentButton active={segment === 'last_30'} onClick={() => setSegment('last_30')}
                  label="Aktiv 30 Tage" count={Math.round(totalSubscribers * 0.6)} />
                <SegmentButton active={segment === 'new_3'} onClick={() => setSegment('new_3')}
                  label="Stammkunden (3+)" count={Math.round(totalSubscribers * 0.2)} />
              </div>
              <div className="mt-3 text-sm text-muted-foreground">
                Wird an <strong className="text-foreground">{segmentCount}</strong> Kunden gesendet.
              </div>
            </>
          )}
        </Card>

        {/* Inhalt */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-matcha-700" />
            <h3 className="font-display font-bold">Nachricht</h3>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Titel <span className="opacity-60">(max. 40 Zeichen)</span></label>
              <input
                value={title} onChange={(e) => setTitle(e.target.value.slice(0, 40))}
                placeholder="z.B. 20% auf Matcha Latte diese Woche"
                className="w-full h-11 rounded-xl border bg-background px-3 mt-1"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Nachricht <span className="opacity-60">(max. 120 Zeichen)</span></label>
              <textarea
                value={body} onChange={(e) => setBody(e.target.value.slice(0, 120))}
                placeholder="z.B. Nur für dich als Stammkunde: Matcha Latte diese Woche 20% günstiger 🍵"
                rows={3}
                className="w-full rounded-xl border bg-background px-3 py-2 mt-1"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Link beim Tap <span className="opacity-60">(optional)</span></label>
              <input
                value={url} onChange={(e) => setUrl(e.target.value)}
                placeholder="/order/DEIN-SLUG?voucher=SOMMER20"
                className="w-full h-11 rounded-xl border bg-background px-3 mt-1 font-mono text-sm"
              />
            </div>
          </div>
        </Card>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={send}
            disabled={!canSend}
            className="inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-matcha-900 text-matcha-50 font-bold hover:bg-matcha-800 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? 'Versende…' : `An ${segmentCount} senden`}
          </button>
          <button
            onClick={testToMe}
            disabled={!title || !body}
            className="h-12 px-4 rounded-xl border bg-card hover:bg-muted text-sm font-semibold disabled:opacity-50"
          >
            Test an mich
          </button>
          {result && (
            <div className={cn(
              'text-sm px-4 py-2 rounded-xl',
              result.ok ? 'bg-matcha-50 text-matcha-900 border border-matcha-200' : 'bg-red-50 text-red-900 border border-red-200',
            )}>
              {result.msg}{result.count ? ` (${result.count} Einträge)` : ''}
            </div>
          )}
        </div>
      </div>

      {/* Preview + Historie */}
      <aside className="space-y-4">
        <Card className="p-5 bg-black text-white">
          <div className="flex items-center gap-2 mb-3 text-[10px] font-bold uppercase tracking-wider opacity-60">
            <Smartphone className="h-3 w-3" /> So sehen deine Kunden das
          </div>
          <div className="rounded-xl bg-white/10 backdrop-blur border border-white/20 p-3">
            <div className="flex items-start gap-2">
              <div className="h-8 w-8 rounded-lg bg-matcha-500 flex items-center justify-center text-xs font-bold">M</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-[10px] opacity-60 mb-0.5">
                  <span>MISE</span>
                  <span>jetzt</span>
                </div>
                <div className="font-bold text-sm leading-tight truncate">{title || 'Titel der Nachricht'}</div>
                <div className="text-xs opacity-80 mt-0.5 leading-snug">
                  {body || 'Nachrichten-Text wird hier angezeigt'}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {recentCampaigns.length > 0 && (
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="h-4 w-4 text-matcha-700" />
              <h3 className="font-display font-bold text-sm">Zuletzt versendet</h3>
            </div>
            <ul className="space-y-2">
              {recentCampaigns.slice(0, 5).map((c) => (
                <li key={c.id} className="border-l-2 border-matcha-300 pl-3 py-1">
                  <div className="text-xs font-bold truncate">{c.title}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{c.body}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                    {c.sent_at ? <Check className="h-2.5 w-2.5 text-matcha-700" /> : <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                    {new Date(c.created_at).toLocaleString('de-DE')}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </aside>
    </div>
  );
}

function SegmentButton({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-xl border p-3 text-left transition',
        active ? 'bg-matcha-900 text-matcha-50 border-matcha-900' : 'bg-card hover:bg-muted',
      )}
    >
      <div className="text-xs font-semibold">{label}</div>
      <div className="font-display text-xl font-bold mt-0.5">{count}</div>
    </button>
  );
}
