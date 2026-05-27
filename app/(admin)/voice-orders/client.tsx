'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Phone, Sparkles, Mic, MessageSquare, Volume2, Check,
  Loader2, ArrowRight, History, AlertCircle, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { VOICE_PROFILES } from '@/lib/voice-orders/voices';

interface Props {
  tenantName: string;
  currentVoiceId: string | null;
  currentFirstMessage: string | null;
  agentId: string | null;
  phoneNumberId: string | null;
  twilioPhone: string | null;
  setupCompletedAt: string | null;
  callCount: number;
}

export function VoiceOrdersSetup(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [voiceSlug, setVoiceSlug] = useState<string>(
    VOICE_PROFILES.find((v) => v.voiceId === props.currentVoiceId)?.slug ?? 'sophia',
  );
  const [greeting, setGreeting] = useState<string>(props.currentFirstMessage ?? '');
  const [twilioPhone, setTwilioPhone] = useState(props.twilioPhone ?? '');
  const [twilioSid, setTwilioSid] = useState('');
  const [twilioToken, setTwilioToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testUrl, setTestUrl] = useState<string | null>(null);

  async function handleSetup() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await fetch('/api/voice-orders/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceSlug,
          customFirstMessage: greeting || undefined,
          twilioPhoneNumber: twilioPhone || undefined,
          twilioAccountSid: twilioSid || undefined,
          twilioAuthToken: twilioToken || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.detail ?? json.error ?? 'Setup fehlgeschlagen');
        return;
      }
      setSuccess(
        `KI eingerichtet. Speisekarte mit ${json.menuItemsLoaded} Positionen geladen.${
          json.twilioRegistered ? ' Twilio-Nummer aktiv.' : ''
        }`,
      );
      router.refresh();
    });
  }

  async function handleTestCall() {
    setError(null);
    const res = await fetch('/api/voice-orders/test-url');
    const json = await res.json();
    if (!res.ok) {
      setError(json.detail ?? json.error ?? 'Test-URL nicht abrufbar');
      return;
    }
    setTestUrl(json.signedUrl);
  }

  const isReady = !!props.agentId;
  const hasTwilio = !!props.phoneNumberId;

  return (
    <div className="space-y-6">
      {/* Status */}
      <Card className="p-5">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-xl',
              isReady ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-500',
            )}
          >
            {isReady ? <Check size={22} /> : <Phone size={22} />}
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold">
              {isReady ? 'KI ist eingerichtet' : 'Telefon-KI einrichten'}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {isReady
                ? `Agent läuft seit ${props.setupCompletedAt ? new Date(props.setupCompletedAt).toLocaleDateString('de-DE') : '—'}. ${
                    hasTwilio
                      ? `Anrufer wählen ${props.twilioPhone}.`
                      : 'Verknüpfe noch deine Twilio-Nummer für echte Anrufe.'
                  }`
                : 'Wähle eine Stimme und (optional) verbinde deine Twilio-Nummer.'}
            </p>
          </div>
          {props.callCount > 0 && (
            <Link
              href="/voice-orders/calls"
              className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-sm font-medium hover:bg-zinc-50"
            >
              <History size={14} />
              {props.callCount} {props.callCount === 1 ? 'Anruf' : 'Anrufe'}
              <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </Card>

      {/* Voice */}
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Mic size={18} className="text-zinc-700" />
          <h3 className="font-semibold">1. Stimme wählen</h3>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {VOICE_PROFILES.map((v) => (
            <button
              key={v.slug}
              onClick={() => setVoiceSlug(v.slug)}
              className={cn(
                'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                voiceSlug === v.slug
                  ? 'border-zinc-900 bg-zinc-50 ring-2 ring-zinc-900/10'
                  : 'border-zinc-200 hover:bg-zinc-50',
              )}
            >
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                  v.gender === 'female' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700',
                )}
              >
                <Volume2 size={14} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {v.name}
                  {voiceSlug === v.slug && <Check size={12} className="text-emerald-600" />}
                </div>
                <div className="text-xs text-muted-foreground">{v.description}</div>
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* Greeting */}
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <MessageSquare size={18} className="text-zinc-700" />
          <h3 className="font-semibold">2. Begrüßung</h3>
        </div>
        <p className="mb-2 text-xs text-muted-foreground">
          Was sagt die KI, wenn jemand anruft? Leer lassen für Standard.
        </p>
        <textarea
          rows={3}
          value={greeting}
          onChange={(e) => setGreeting(e.target.value)}
          placeholder={`${props.tenantName}, guten Tag! Sie sprechen mit Ihrem digitalen Bestellassistenten. Was darf ich für Sie aufnehmen?`}
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
        />
      </Card>

      {/* Twilio */}
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Phone size={18} className="text-zinc-700" />
          <h3 className="font-semibold">3. Twilio-Nummer (optional)</h3>
          {hasTwilio && (
            <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
              Aktiv
            </span>
          )}
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Du brauchst einen eigenen <a href="https://www.twilio.com" target="_blank" rel="noreferrer" className="underline">Twilio-Account</a> mit gekaufter Nummer (~1 €/Monat). Trage Account-SID, Auth-Token + Nummer hier ein.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Telefonnummer (E.164)</label>
            <input
              type="tel"
              value={twilioPhone}
              onChange={(e) => setTwilioPhone(e.target.value)}
              placeholder="+491234567890"
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-mono focus:border-zinc-900 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Account-SID</label>
            <input
              type="text"
              value={twilioSid}
              onChange={(e) => setTwilioSid(e.target.value)}
              placeholder="ACxxxxxxxx…"
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-mono focus:border-zinc-900 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Auth-Token</label>
            <input
              type="password"
              value={twilioToken}
              onChange={(e) => setTwilioToken(e.target.value)}
              placeholder="••••••••"
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-mono focus:border-zinc-900 focus:outline-none"
            />
          </div>
        </div>
      </Card>

      {/* Action */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleSetup}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:opacity-60"
        >
          {pending ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Sparkles size={15} />
          )}
          {isReady ? 'KI aktualisieren' : 'KI einrichten'}
        </button>

        {isReady && (
          <button
            onClick={handleTestCall}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-5 py-2.5 text-sm font-medium hover:bg-zinc-50 disabled:opacity-60"
          >
            <Phone size={14} /> Browser-Test starten
          </button>
        )}
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50/50 p-4">
          <div className="flex items-start gap-2 text-sm text-red-900">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <div>{error}</div>
          </div>
        </Card>
      )}

      {success && (
        <Card className="border-emerald-200 bg-emerald-50/50 p-4">
          <div className="flex items-start gap-2 text-sm text-emerald-900">
            <Check size={16} className="mt-0.5 shrink-0" />
            <div>{success}</div>
          </div>
        </Card>
      )}

      {testUrl && (
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold">Browser-Test läuft</h3>
          <iframe
            src={testUrl}
            allow="microphone"
            className="h-64 w-full rounded-lg border border-zinc-200"
            title="ElevenLabs Test-Konversation"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Falls nichts passiert: Mikrofon-Berechtigung erlauben und neu laden.
          </p>
          <button
            onClick={() => setTestUrl(null)}
            className="mt-2 text-xs text-zinc-500 hover:text-zinc-900"
          >
            <RefreshCw size={11} className="inline" /> Schließen
          </button>
        </Card>
      )}
    </div>
  );
}
