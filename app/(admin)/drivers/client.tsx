'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, dateTimeDE } from '@/lib/utils';
import {
  AlertCircle, Bike, Check, Copy, ExternalLink, Loader2, Mail, Package, Phone, Plus, Send, ShieldCheck, Store, UserPlus, Wifi, WifiOff, X,
} from 'lucide-react';
import { CompliancePanel } from './compliance-panel';

type Driver = {
  id: string;
  vorname: string;
  nachname: string;
  email: string;
  telefon: string | null;
  fahrzeug_praeferenz: string | null;
  status: string;
  location_id: string;
  created_at: string;
  driver_status: { ist_online: boolean; fahrzeug: string; online_seit: string | null; last_update: string | null }[] | null;
};

type Location = { id: string; name: string };

const VEHICLE_EMOJI: Record<string, string> = {
  bike: '🚲',
  ebike: '🛵',
  scooter: '🛴',
  auto: '🚗',
};
const VEHICLE_LABEL: Record<string, string> = {
  bike: 'Fahrrad',
  ebike: 'E-Bike',
  scooter: 'Roller',
  auto: 'Auto',
};

export function DriversClient({
  drivers, locations, defaultLocationId, resendReady, tenant, orderStats,
}: {
  drivers: Driver[];
  locations: Location[];
  defaultLocationId: string | null;
  resendReady: boolean;
  tenant: { name: string; slug: string; theme_primary: string | null; theme_accent: string | null };
  orderStats: { internal: number; external: number; sources: string[] };
}) {
  const router = useRouter();
  const [showInvite, setShowInvite] = useState(false);
  const [activeTab, setActiveTab] = useState<'drivers' | 'compliance'>('drivers');
  const online = drivers.filter((d) => d.driver_status?.[0]?.ist_online);
  const offline = drivers.filter((d) => !d.driver_status?.[0]?.ist_online);

  // Build name lookup for CompliancePanel (employee_id → name)
  const driverNames: Record<string, string> = {};
  for (const d of drivers) {
    driverNames[d.id] = `${d.vorname} ${d.nachname}`;
  }

  const primary = tenant.theme_primary ?? '#14532d';
  const accent = tenant.theme_accent ?? '#4ae68a';
  const PLATFORM_EMOJI: Record<string, string> = {
    lieferando: '🧡', ubereats: '🟩', wolt: '💙', deliverect: '🔗',
  };

  return (
    <div className="space-y-5">
      {/* Shop-Connection Header */}
      <div
        className="rounded-3xl p-5 md:p-6 text-white overflow-hidden relative"
        style={{ background: `linear-gradient(135deg, ${primary} 0%, ${primary}dd 70%, ${accent}33 100%)` }}
      >
        <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full blur-3xl opacity-30" style={{ backgroundColor: accent }} />
        <div className="relative flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div
              className="h-14 w-14 rounded-2xl flex items-center justify-center text-2xl font-display font-bold shadow-lg shrink-0"
              style={{ backgroundColor: accent, color: primary }}
            >
              🛵
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.25em] opacity-70">Liefer-Cockpit</div>
              <div className="font-display text-xl md:text-2xl font-bold truncate">{tenant.name}</div>
              <div className="text-xs opacity-80 font-mono">mise.app/order/{tenant.slug}</div>
            </div>
          </div>

          <a
            href={`/order/${tenant.slug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/20 transition shrink-0"
          >
            <Store size={14} /> Bestellseite öffnen <ExternalLink size={12} />
          </a>
        </div>

        {/* Quellen-Chips */}
        <div className="relative mt-5 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest opacity-60 mr-1">Orders aus:</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
            🍵 Eigener Shop
            {orderStats.internal > 0 && <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">{orderStats.internal}</span>}
          </span>
          {orderStats.sources.length === 0 && (
            <span className="text-xs opacity-60 italic">noch keine externe Plattform verbunden</span>
          )}
          {orderStats.sources.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold capitalize">
              {PLATFORM_EMOJI[s] ?? '🔌'} {s}
            </span>
          ))}
          {orderStats.external > 0 && (
            <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">+{orderStats.external} extern</span>
          )}
          <a
            href="/settings/platforms"
            className="ml-auto text-xs font-semibold opacity-80 hover:opacity-100 underline"
          >
            Plattformen verwalten
          </a>
        </div>
      </div>

      {/* Tab Nav */}
      <div className="flex items-center gap-1 border-b">
        <TabButton active={activeTab === 'drivers'} onClick={() => setActiveTab('drivers')}>
          <Bike size={14} /> Fahrer
        </TabButton>
        <TabButton active={activeTab === 'compliance'} onClick={() => setActiveTab('compliance')}>
          <ShieldCheck size={14} /> Compliance
        </TabButton>
      </div>

      {activeTab === 'drivers' && (
        <>
          {/* Resend-Warning */}
          {!resendReady && (
            <Card className="p-4 border-amber-300 bg-amber-50 flex items-start gap-3">
              <AlertCircle size={18} className="text-amber-700 shrink-0 mt-0.5" />
              <div className="flex-1 text-sm">
                <strong className="text-amber-900">E-Mail noch nicht verbunden.</strong>
                <p className="text-amber-800 mt-1">
                  Ohne Resend kannst du trotzdem Fahrer anlegen — die Zugangsdaten werden dir direkt angezeigt, du musst sie manuell weitergeben.
                  <a href="/settings/email" className="underline font-semibold ml-1">Jetzt einrichten →</a>
                </p>
              </div>
            </Card>
          )}

          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <StatPill label="Online" value={online.length} tone="accent" />
              <StatPill label="Gesamt" value={drivers.length} />
            </div>
            <button
              onClick={() => setShowInvite(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-matcha-900 text-matcha-50 px-4 py-2.5 text-sm font-bold hover:bg-matcha-800"
            >
              <UserPlus size={14} /> Fahrer einladen
            </button>
          </div>

          {/* Drivers */}
          {drivers.length === 0 ? (
            <Card className="p-10 text-center">
              <div className="h-14 w-14 mx-auto rounded-full bg-matcha-100 text-matcha-700 flex items-center justify-center mb-3">
                <Bike size={22} />
              </div>
              <div className="font-display text-lg font-bold">Noch keine Fahrer</div>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                Lade deinen ersten Fahrer ein. Er bekommt per E-Mail einen Link zur Fahrer-App + Login-Daten.
              </p>
              <button
                onClick={() => setShowInvite(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-matcha-900 text-matcha-50 px-5 py-2.5 text-sm font-bold"
              >
                <UserPlus size={14} /> Ersten Fahrer einladen
              </button>
            </Card>
          ) : (
            <>
              {online.length > 0 && (
                <DriversSection title="Online" tone="accent" drivers={online} locations={locations} />
              )}
              {offline.length > 0 && (
                <DriversSection title="Offline / Eingeladen" tone="muted" drivers={offline} locations={locations} />
              )}
            </>
          )}
        </>
      )}

      {activeTab === 'compliance' && defaultLocationId && (
        <CompliancePanel locationId={defaultLocationId} driverNames={driverNames} />
      )}
      {activeTab === 'compliance' && !defaultLocationId && (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Keine Location ausgewählt. Bitte zuerst eine Location zuweisen.
        </Card>
      )}

      {showInvite && (
        <InviteDriverDialog
          locations={locations}
          defaultLocationId={defaultLocationId}
          resendReady={resendReady}
          onClose={() => setShowInvite(false)}
          onInvited={() => { setShowInvite(false); router.refresh(); }}
        />
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition',
        active
          ? 'border-matcha-700 text-matcha-900'
          : 'border-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function DriversSection({ title, tone, drivers, locations }: { title: string; tone: 'accent' | 'muted'; drivers: Driver[]; locations?: Location[] }) {
  return (
    <section>
      <h2 className={cn('text-xs font-bold uppercase tracking-[0.2em] mb-2 px-1', tone === 'accent' ? 'text-matcha-700' : 'text-muted-foreground')}>
        {title} · {drivers.length}
      </h2>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {drivers.map((d) => <DriverCard key={d.id} driver={d} locations={locations} />)}
      </div>
    </section>
  );
}

function DriverCard({ driver: d, locations }: { driver: Driver; locations?: Location[] }) {
  const ds = d.driver_status?.[0];
  const online = ds?.ist_online ?? false;
  const veh = ds?.fahrzeug ?? d.fahrzeug_praeferenz ?? 'ebike';
  const initials = `${d.vorname[0] ?? ''}${d.nachname[0] ?? ''}`.toUpperCase();
  const locationName = locations?.find((l) => l.id === d.location_id)?.name;

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <div className="h-12 w-12 rounded-full bg-matcha-700 text-white flex items-center justify-center font-display font-bold">
            {initials}
          </div>
          <div className={cn(
            'absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-card flex items-center justify-center',
            online ? 'bg-matcha-500' : 'bg-muted',
          )}>
            {online ? <Wifi className="h-2.5 w-2.5 text-white" /> : <WifiOff className="h-2.5 w-2.5 text-white" />}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-display font-bold">{d.vorname} {d.nachname}</span>
            <span className="text-xl">{VEHICLE_EMOJI[veh] ?? '🚲'}</span>
          </div>
          <div className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
            <Mail size={10} />
            {d.email}
          </div>
          {d.telefon && (
            <div className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
              <Phone size={10} />
              {d.telefon}
            </div>
          )}
          {locationName && (
            <div className="text-xs text-matcha-700 truncate flex items-center gap-1 mt-1 font-semibold">
              <Store size={10} />
              liefert für {locationName}
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs">
        <Badge variant={online ? 'accent' : 'muted'} className="h-5 px-2 text-[10px]">
          {online ? `Online · ${VEHICLE_LABEL[veh]}` : 'Offline'}
        </Badge>
        {ds?.last_update && (
          <span className="text-muted-foreground">
            {online ? `seit ${timeAgo(ds.online_seit ?? ds.last_update)}` : `zuletzt ${timeAgo(ds.last_update)}`}
          </span>
        )}
      </div>
      <VehiclePicker driverId={d.id} initial={d.fahrzeug_praeferenz ?? 'ebike'} />
    </Card>
  );
}

function VehiclePicker({ driverId, initial }: { driverId: string; initial: string }) {
  const supabase = createClient();
  const [veh, setVeh] = useState(initial);
  const [saving, setSaving] = useState(false);
  const opts = [
    { id: 'fuss',    label: 'Fuß',     emoji: '🚶' },
    { id: 'fahrrad', label: 'Rad',     emoji: '🚲' },
    { id: 'ebike',   label: 'E-Bike',  emoji: '🛵' },
    { id: 'roller',  label: 'Roller',  emoji: '🛺' },
    { id: 'auto',    label: 'Auto',    emoji: '🚗' },
  ];
  async function change(v: string) {
    setVeh(v); setSaving(true);
    await supabase.from('employees').update({ fahrzeug_praeferenz: v }).eq('id', driverId);
    setSaving(false);
  }
  return (
    <div className="mt-2 -mx-1 flex items-center gap-1">
      {opts.map((o) => (
        <button
          key={o.id}
          onClick={() => change(o.id)}
          disabled={saving}
          className={cn(
            'flex-1 rounded-lg px-1.5 py-1.5 text-[10px] border-2 transition',
            veh === o.id ? 'bg-matcha-700 border-matcha-700 text-white' : 'bg-muted/40 border-transparent text-muted-foreground hover:bg-muted',
          )}
          title={o.label}
        >
          <div className="text-sm leading-none">{o.emoji}</div>
          <div className="mt-0.5 font-semibold">{o.label}</div>
        </button>
      ))}
    </div>
  );
}

function StatPill({ label, value, tone }: { label: string; value: number; tone?: 'accent' }) {
  return (
    <div className={cn('rounded-full px-3 py-1 text-xs border bg-card inline-flex items-center gap-2', tone === 'accent' && 'border-matcha-500')}>
      <span className={cn('font-display font-bold', tone === 'accent' && 'text-matcha-700')}>{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function InviteDriverDialog({
  locations, defaultLocationId, resendReady, onClose, onInvited,
}: {
  locations: Location[];
  defaultLocationId: string | null;
  resendReady: boolean;
  onClose: () => void;
  onInvited: () => void;
}) {
  const [vorname, setVorname] = useState('');
  const [nachname, setNachname] = useState('');
  const [email, setEmail] = useState('');
  const [telefon, setTelefon] = useState('');
  const [fahrzeug, setFahrzeug] = useState<'bike' | 'ebike' | 'scooter' | 'auto'>('ebike');
  const [locationId, setLocationId] = useState(defaultLocationId ?? locations[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [result, setResult] = useState<{ email_sent: boolean; credentials?: { email: string; password: string; app_url: string } | null } | null>(null);

  function submit() {
    setError(null);
    if (!email || !vorname) return setError('E-Mail und Vorname sind Pflicht');
    startSaving(async () => {
      try {
        const res = await fetch('/api/drivers/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, vorname, nachname, telefon, fahrzeug, location_id: locationId }),
        });
        const json = await res.json();
        if (!res.ok) return setError(json.error ?? 'Fehler');
        setResult({ email_sent: json.email_sent, credentials: json.credentials });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Netzwerk');
      }
    });
  }

  // Result-Modal nach erfolgreicher Einladung
  if (result) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
        <div className="bg-card rounded-3xl max-w-md w-full p-6 shadow-strong" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <div className="h-12 w-12 rounded-2xl bg-matcha-500 text-white flex items-center justify-center">
              <Check size={22} />
            </div>
            <button onClick={onInvited} className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-muted">
              <X size={16} />
            </button>
          </div>
          <h3 className="font-display text-xl font-bold mt-4">
            {result.email_sent ? 'Einladung versendet' : 'Fahrer angelegt'}
          </h3>
          {result.email_sent ? (
            <p className="text-sm text-muted-foreground mt-2">
              {vorname} hat eine E-Mail mit der Fahrer-App + Login-Daten bekommen.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mt-2">
                Resend ist noch nicht verbunden — gib diese Zugangsdaten manuell an {vorname} weiter:
              </p>
              {result.credentials && (
                <div className="mt-4 space-y-2">
                  <CredsRow label="E-Mail" value={result.credentials.email} />
                  <CredsRow label="Passwort" value={result.credentials.password} strong />
                  <CredsRow label="App-Link" value={result.credentials.app_url} />
                </div>
              )}
            </>
          )}
          <button
            onClick={onInvited}
            className="mt-6 w-full rounded-xl bg-matcha-900 text-matcha-50 py-2.5 font-bold"
          >
            Fertig
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-card rounded-3xl max-w-lg w-full max-h-[95vh] flex flex-col shadow-strong" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-display text-lg font-bold">Neuen Fahrer einladen</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-muted"><X size={16} /></button>
        </header>
        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vorname *" value={vorname} onChange={setVorname} placeholder="Mira" autoFocus />
            <Field label="Nachname" value={nachname} onChange={setNachname} placeholder="Meier" />
          </div>
          <Field label="E-Mail *" value={email} onChange={setEmail} placeholder="mira@beispiel.de" type="email" />
          <Field label="Telefon (optional)" value={telefon} onChange={setTelefon} placeholder="0151 1234567" />

          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Fahrzeug</label>
            <div className="mt-1.5 grid grid-cols-4 gap-2">
              {(['bike', 'ebike', 'scooter', 'auto'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setFahrzeug(v)}
                  className={cn(
                    'flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition text-xs',
                    fahrzeug === v ? 'border-matcha-700 bg-matcha-50' : 'border-border hover:bg-muted/40',
                  )}
                >
                  <span className="text-xl">{VEHICLE_EMOJI[v]}</span>
                  <span className="font-semibold">{VEHICLE_LABEL[v]}</span>
                </button>
              ))}
            </div>
          </div>

          {locations.length > 1 && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Filiale</label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="mt-1.5 w-full h-10 rounded-xl border bg-background px-3"
              >
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          )}

          {/* Preview */}
          <div className="rounded-2xl bg-matcha-50/50 border border-matcha-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              {resendReady ? <Mail size={14} className="text-matcha-700" /> : <AlertCircle size={14} className="text-amber-700" />}
              <span className="text-xs font-bold">
                {resendReady ? 'Welcome-Email wird versendet' : 'Zugangsdaten werden angezeigt'}
              </span>
            </div>
            <ul className="text-xs text-matcha-800 space-y-1">
              <li>• Temporäres Passwort wird generiert</li>
              <li>• Auth-User + Fahrer-Profil wird angelegt</li>
              <li>• {resendReady ? 'Email mit Login + App-Link geht automatisch raus' : 'Login-Daten erscheinen hier für manuelle Weitergabe'}</li>
              <li>• Fahrzeug-Status wird initialisiert (offline)</li>
            </ul>
          </div>

          {error && (
            <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
          )}
        </div>
        <footer className="border-t px-6 py-4 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm">Abbrechen</button>
          <button
            onClick={submit}
            disabled={saving || !email || !vorname}
            className="inline-flex items-center gap-2 rounded-xl bg-matcha-900 text-matcha-50 px-5 py-2.5 text-sm font-bold hover:bg-matcha-800 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {resendReady ? 'Einladung senden' : 'Fahrer anlegen'}
          </button>
        </footer>
      </div>
    </div>
  );
}

function CredsRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-1 flex gap-2">
        <code className={cn('flex-1 px-3 py-2 rounded-lg bg-muted text-sm font-mono', strong && 'font-bold')}>{value}</code>
        <button
          onClick={copy}
          className="h-9 px-3 rounded-lg bg-matcha-900 text-matcha-50 text-xs font-bold hover:bg-matcha-800 inline-flex items-center gap-1"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Kopiert' : 'Kopieren'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', autoFocus }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 outline-none focus:border-matcha-700 focus:ring-2 focus:ring-matcha-500/20"
      />
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'jetzt';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
