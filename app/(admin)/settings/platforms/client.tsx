'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Check, Copy, Eye, EyeOff, Loader2, RefreshCw, Send, X, Hourglass, Bell,
} from 'lucide-react';

type Config = {
  id: string;
  tenant_id: string;
  source: string;
  webhook_secret: string;
  external_store_id: string | null;
  default_location_id: string | null;
  aktiv: boolean;
  zuletzt_empfangen: string | null;
};

type PlatformMeta = {
  name: string;
  icon: string;
  color: string;
  desc: string;
  howto: string;
  status: 'ready' | 'coming_soon';
  eta?: string;
};

const PLATFORMS: Record<string, PlatformMeta> = {
  lieferando: {
    name: 'Lieferando',
    icon: '🧡',
    color: 'bg-orange-100 text-orange-900',
    desc: 'Just Eat Takeaway — Deutschland, Benelux',
    howto: 'Lieferando vergibt API-Zugänge nur an offizielle Integration-Partner. Wir sind im Onboarding-Prozess bei Just Eat Takeaway.',
    status: 'coming_soon',
    eta: 'Q3 2026',
  },
  ubereats: {
    name: 'Uber Eats',
    icon: '🟩',
    color: 'bg-emerald-100 text-emerald-900',
    desc: 'Uber Eats Orders API — Integration Partner',
    howto: 'Wir sind im Integration-Partner-Prozess bei Uber Eats. Sobald freigegeben, kannst du deinen Store hier direkt verbinden.',
    status: 'coming_soon',
    eta: 'Q2 2026',
  },
  wolt: {
    name: 'Wolt',
    icon: '💙',
    color: 'bg-blue-100 text-blue-900',
    desc: 'Wolt Merchant API — Nordics, DACH',
    howto: 'Direktanbindung via Wolt Partner-Programm. Wir stehen in Kontakt mit Wolt Partnerships.',
    status: 'coming_soon',
    eta: 'Q3 2026',
  },
  deliverect: {
    name: 'Deliverect',
    icon: '🔗',
    color: 'bg-purple-100 text-purple-900',
    desc: 'Multi-Channel Middleware — deckt Lieferando + Uber + Wolt ab',
    howto: 'In Deliverect → Integrations → Custom Webhook anlegen. URL & Secret kopieren.',
    status: 'ready',
  },
};

const DEFAULT_META: PlatformMeta = {
  name: '', icon: '🔌', color: 'bg-muted', desc: '', howto: '', status: 'ready',
};

export function PlatformsSettings({
  tenantId, defaultLocationId, configs, locations,
}: {
  tenantId: string;
  defaultLocationId: string | null;
  configs: Config[];
  locations: { id: string; name: string }[];
}) {
  const [items, setItems] = useState(configs);
  const [waitlist, setWaitlist] = useState<Set<string>>(new Set());

  const readyItems = items.filter((c) => (PLATFORMS[c.source]?.status ?? 'ready') === 'ready');
  const comingSoonSources = Object.entries(PLATFORMS).filter(([, m]) => m.status === 'coming_soon');

  async function joinWaitlist(source: string) {
    const supabase = createClient();
    await supabase.from('platform_waitlist').insert({ tenant_id: tenantId, source }).select();
    setWaitlist((s) => new Set(s).add(source));
  }

  return (
    <div className="space-y-6">
      <Card className="p-5 bg-matcha-50/50 border-matcha-200">
        <div className="text-sm text-matcha-900">
          <strong>So funktioniert&apos;s:</strong> Die Plattform ruft unsere Webhook-URL mit deinem Secret auf. Wir validieren,
          mappen in unser Bestellsystem, und deine Küche sieht die Order. Deliverect funktioniert sofort und deckt
          Lieferando, Uber Eats & Wolt gleichzeitig ab. Direkt-Anbindungen kommen Schritt für Schritt dazu.
        </div>
      </Card>

      {/* Aktive / sofort nutzbare Plattformen */}
      {readyItems.length > 0 && (
        <section>
          <h3 className="font-display text-lg font-bold mb-3 px-1">Verfügbar</h3>
          <div className="space-y-4">
            {readyItems.map((c) => (
              <PlatformCard
                key={c.id}
                config={c}
                meta={PLATFORMS[c.source] ?? { ...DEFAULT_META, name: c.source }}
                locations={locations}
                defaultLocationId={defaultLocationId}
                onUpdate={(next) => setItems((xs) => xs.map((x) => x.id === c.id ? next : x))}
              />
            ))}
          </div>
        </section>
      )}

      {/* Coming Soon */}
      {comingSoonSources.length > 0 && (
        <section>
          <h3 className="font-display text-lg font-bold mb-3 px-1 flex items-center gap-2">
            <Hourglass className="h-4 w-4 text-muted-foreground" />
            In Vorbereitung
          </h3>
          <div className="grid gap-4 md:grid-cols-3">
            {comingSoonSources.map(([source, meta]) => (
              <ComingSoonCard
                key={source}
                source={source}
                meta={meta}
                joined={waitlist.has(source)}
                onJoin={() => joinWaitlist(source)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ComingSoonCard({
  source, meta, joined, onJoin,
}: {
  source: string;
  meta: PlatformMeta;
  joined: boolean;
  onJoin: () => void;
}) {
  return (
    <Card className="p-5 relative overflow-hidden border-dashed">
      <div className="absolute top-3 right-3">
        <Badge variant="muted">
          <Hourglass className="h-3 w-3 mr-1" />
          {meta.eta ?? 'Bald'}
        </Badge>
      </div>

      <div className={cn('h-12 w-12 rounded-2xl flex items-center justify-center text-2xl mb-3', meta.color)}>
        {meta.icon}
      </div>

      <h4 className="font-display text-lg font-bold">{meta.name}</h4>
      <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{meta.desc}</p>

      <div className="mt-3 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 leading-relaxed">
        {meta.howto}
      </div>

      <button
        onClick={onJoin}
        disabled={joined}
        className={cn(
          'mt-4 w-full h-11 rounded-xl font-bold text-sm inline-flex items-center justify-center gap-2 transition',
          joined
            ? 'bg-matcha-50 text-matcha-900 border border-matcha-200 cursor-default'
            : 'bg-matcha-900 text-matcha-50 hover:bg-matcha-800',
        )}
      >
        {joined ? (
          <>
            <Check className="h-4 w-4" />
            Wir sagen Bescheid
          </>
        ) : (
          <>
            <Bell className="h-4 w-4" />
            Benachrichtigen, wenn live
          </>
        )}
      </button>
    </Card>
  );
}

function PlatformCard({
  config, meta, locations, defaultLocationId, onUpdate,
}: {
  config: Config;
  meta: { name: string; icon: string; color: string; desc: string; howto: string };
  locations: { id: string; name: string }[];
  defaultLocationId: string | null;
  onUpdate: (next: Config) => void;
}) {
  const supabase = createClient();
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [storeId, setStoreId] = useState(config.external_store_id ?? '');
  const [locId, setLocId] = useState(config.default_location_id ?? defaultLocationId ?? '');
  const [saving, startSaving] = useTransition();

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://mise.app';
  const webhookUrl = `${origin}/api/orders/external`;

  async function saveField(field: string, value: any) {
    startSaving(async () => {
      const { data } = await supabase
        .from('tenant_platform_configs')
        .update({ [field]: value })
        .eq('id', config.id)
        .select()
        .single();
      if (data) onUpdate(data as any);
    });
  }

  async function toggleActive() {
    await saveField('aktiv', !config.aktiv);
  }

  async function regenerateSecret() {
    if (!confirm(`Neues Secret generieren? Alle ${meta.name}-Webhook-Aufrufe mit dem alten Secret schlagen dann fehl.`)) return;
    const newSecret = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    await saveField('webhook_secret', newSecret);
  }

  async function copy(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  async function testPing() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': config.webhook_secret,
          'X-Source': config.source,
          'X-Location-Id': locId,
        },
        body: JSON.stringify({
          ping: true,
          channelOrderId: `test-${Date.now()}`,
          customer: { name: 'Test-Ping', phoneNumber: '+49 0000' },
          items: [],
          orderType: 'delivery',
          total: 0,
          payment: { type: 'ONLINE', isPaid: true },
        }),
      });
      const json = await res.json();
      setTestResult({
        ok: res.ok,
        msg: res.ok ? 'Verbindung erfolgreich. Secret + URL akzeptiert.' : `Fehler: ${json.error ?? res.status}`,
      });
    } catch (e) {
      setTestResult({ ok: false, msg: e instanceof Error ? e.message : 'Netzwerkfehler' });
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card className={cn('overflow-hidden', config.aktiv && 'ring-2 ring-matcha-500/30')}>
      <header className="flex items-start justify-between gap-4 p-5 border-b">
        <div className="flex items-center gap-3">
          <div className={cn('h-12 w-12 rounded-2xl flex items-center justify-center text-2xl', meta.color)}>
            {meta.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <div className="font-display text-lg font-bold">{meta.name}</div>
              {config.aktiv
                ? <Badge variant="accent">aktiv</Badge>
                : <Badge variant="muted">inaktiv</Badge>}
              {config.zuletzt_empfangen && (
                <span className="text-xs text-muted-foreground">
                  letzter Eingang: {new Date(config.zuletzt_empfangen).toLocaleString('de-DE')}
                </span>
              )}
            </div>
            <div className="text-sm text-muted-foreground">{meta.desc}</div>
          </div>
        </div>
        <button
          onClick={toggleActive}
          className={cn(
            'inline-flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition',
            config.aktiv ? 'bg-muted text-muted-foreground hover:bg-red-100 hover:text-red-800' : 'bg-matcha-900 text-matcha-50 hover:bg-matcha-800',
          )}
        >
          {config.aktiv ? <X size={14} /> : <Check size={14} />}
          {config.aktiv ? 'Deaktivieren' : 'Aktivieren'}
        </button>
      </header>

      <div className="p-5 space-y-4">
        {/* Webhook-URL */}
        <KeyValueRow
          label="Webhook-URL"
          value={webhookUrl}
          onCopy={() => copy(webhookUrl, 'url')}
          copied={copied === 'url'}
          mono
        />

        {/* Secret */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Webhook-Secret</div>
            <button
              onClick={regenerateSecret}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <RefreshCw size={10} /> Neu generieren
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center bg-muted rounded-xl overflow-hidden">
              <code className="flex-1 px-3 py-2.5 text-xs font-mono truncate">
                {showSecret ? config.webhook_secret : '•'.repeat(48)}
              </code>
              <button
                onClick={() => setShowSecret(!showSecret)}
                className="h-10 w-10 flex items-center justify-center hover:bg-black/5"
                aria-label={showSecret ? 'Verstecken' : 'Anzeigen'}
              >
                {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <button
              onClick={() => copy(config.webhook_secret, 'secret')}
              className="h-10 px-3 rounded-xl bg-matcha-900 text-matcha-50 text-xs font-semibold hover:bg-matcha-800 inline-flex items-center gap-1"
            >
              {copied === 'secret' ? <Check size={12} /> : <Copy size={12} />}
              {copied === 'secret' ? 'Kopiert' : 'Kopieren'}
            </button>
          </div>
        </div>

        {/* Config-Fields */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-1">
              Filiale
            </div>
            <select
              value={locId}
              onChange={(e) => { setLocId(e.target.value); saveField('default_location_id', e.target.value); }}
              className="w-full h-10 rounded-xl border bg-background px-3"
            >
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-1">
              Externe Store-ID (optional)
            </div>
            <input
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              onBlur={() => saveField('external_store_id', storeId || null)}
              placeholder="z.B. 12345"
              className="w-full h-10 rounded-xl border bg-background px-3 font-mono text-xs"
            />
          </div>
        </div>

        {/* How-to */}
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-900">
          <strong>Setup:</strong> {meta.howto}
        </div>

        {/* Test-Ping */}
        <div className="flex items-center gap-2">
          <button
            onClick={testPing}
            disabled={!config.aktiv || testing || !locId}
            className="inline-flex items-center gap-2 rounded-lg bg-muted hover:bg-muted/80 px-3 py-2 text-xs font-semibold disabled:opacity-40"
          >
            {testing ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            Test-Ping senden
          </button>
          {testResult && (
            <div className={cn(
              'text-xs px-3 py-1 rounded-lg',
              testResult.ok ? 'bg-matcha-50 text-matcha-900' : 'bg-red-50 text-red-900',
            )}>
              {testResult.msg}
            </div>
          )}
          {saving && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
        </div>
      </div>
    </Card>
  );
}

function KeyValueRow({
  label, value, onCopy, copied, mono,
}: {
  label: string; value: string; onCopy: () => void; copied: boolean; mono?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <code className={cn(
          'flex-1 px-3 py-2.5 rounded-xl bg-muted text-xs truncate',
          mono && 'font-mono',
        )}>
          {value}
        </code>
        <button
          onClick={onCopy}
          className="h-10 px-3 rounded-xl bg-matcha-900 text-matcha-50 text-xs font-semibold hover:bg-matcha-800 inline-flex items-center gap-1 shrink-0"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Kopiert' : 'Kopieren'}
        </button>
      </div>
    </div>
  );
}
