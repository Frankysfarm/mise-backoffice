'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  Clock,
  CreditCard,
  Globe,
  Loader2,
  MapPin,
  User,
  X,
} from 'lucide-react';
import type { CheckoutForm, OrderType, PaymentMethod } from './types';
import { AddressAutocomplete, type AddressValue } from './address-autocomplete';

type Props = {
  open: boolean;
  onClose: () => void;
  orderType: OrderType;
  total: number;
  loading: boolean;
  onSubmit: (data: CheckoutForm) => void;
  /** Filial-Koordinaten zum Biasing der Adress-Suche */
  locationCoords?: { lat: number; lng: number } | null;
  /** Filial-Stadt als Default */
  defaultCity?: string;
  /** Verfügbare Zahlungsarten (gefiltert nach Tenant-Config) */
  paymentMethods?: {
    method: string;
    label: string | null;
    enabled_lieferung: boolean;
    enabled_abholung: boolean;
    enabled_vor_ort: boolean;
  }[];
  /** Für Voucher-Einlösung */
  locationId?: string;
  subtotal?: number;
  voucher?: { voucher_id: string; code: string; typ: string; rabatt: number; beschreibung: string | null } | null;
  onVoucherChange?: (v: { voucher_id: string; code: string; typ: string; rabatt: number; beschreibung: string | null } | null) => void;
};

function formatEuro(n: number): string {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const QUICK_REPLIES = ['An der Tür klingeln', 'Bei Nachbar abgeben', 'Ans Gartentor', 'Kontaktlos vor die Tür'];

export function CheckoutSheet({ open, onClose, orderType, total, loading, onSubmit, locationCoords, defaultCity, paymentMethods, locationId, subtotal, voucher, onVoucherChange }: Props) {
  const steps = orderType === 'lieferung' ? ['Adresse', 'Kontakt', 'Bezahlen'] : ['Kontakt', 'Bezahlen'];
  const [step, setStep] = React.useState(0);

  // Form state
  const [name, setName] = React.useState('');
  const [telefon, setTelefon] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [address, setAddress] = React.useState<AddressValue>({
    strasse: '',
    plz: '',
    stadt: defaultCity ?? '',
    lat: null,
    lng: null,
  });
  const [etage, setEtage] = React.useState('');
  const [tuercode, setTuercode] = React.useState('');
  const [lieferhinweis, setLieferhinweis] = React.useState('');
  const [zahlungsart, setZahlungsart] = React.useState<PaymentMethod>('online');
  const [marketingOptin, setMarketingOptin] = React.useState(false);

  // Live-ETA vom Server holen (Küchenauslastung-basiert)
  const [liveEta, setLiveEta] = React.useState<{
    eta_min: number; load: string; active_orders?: number; drivers_online?: number;
  } | null>(null);
  React.useEffect(() => {
    if (orderType !== 'lieferung' || !locationId || !open) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch(`/api/delivery/eta/live?location_id=${locationId}`);
        if (r.ok && !cancelled) setLiveEta(await r.json());
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [open, orderType, locationId]);

  // Lieferzone-Check: wenn Filial-Koordinaten + Adress-Koordinaten vorhanden
  const deliveryDistanceKm = React.useMemo(() => {
    if (!locationCoords || address.lat == null || address.lng == null) return null;
    return haversineKm(locationCoords, { lat: address.lat, lng: address.lng });
  }, [locationCoords, address.lat, address.lng]);

  const outOfRange = deliveryDistanceKm != null && deliveryDistanceKm > 8;

  React.useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  // Voucher-Code aus sessionStorage einlösen (z.B. vom Bon-QR)
  const [voucherInput, setVoucherInput] = React.useState('');
  const [voucherLoading, setVoucherLoading] = React.useState(false);
  const [voucherError, setVoucherError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open || !locationId || voucher) return;
    try {
      const pending = sessionStorage.getItem(`pending_voucher:${locationId}`);
      if (pending) {
        setVoucherInput(pending);
        void redeemVoucher(pending);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, locationId]);

  async function redeemVoucher(code: string) {
    if (!locationId || !subtotal || subtotal <= 0) {
      setVoucherError('Warenkorb ist leer');
      return;
    }
    setVoucherLoading(true);
    setVoucherError(null);
    try {
      const res = await fetch('/api/vouchers/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_id: locationId,
          code,
          bestellwert: subtotal,
          kunde_email: email || undefined,
          kunde_telefon: telefon || undefined,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setVoucherError(json.error ?? 'Code ungültig');
        return;
      }
      onVoucherChange?.(json);
      setVoucherInput(json.code);
    } catch (e) {
      setVoucherError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setVoucherLoading(false);
    }
  }

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const isLastStep = step === steps.length - 1;

  const canAdvance = (() => {
    if (orderType === 'lieferung' && step === 0) {
      if (outOfRange) return false;
      return (
        address.strasse.trim().length > 3 &&
        address.plz.trim().length >= 4 &&
        address.stadt.trim().length > 1
      );
    }
    const contactStep = orderType === 'lieferung' ? 1 : 0;
    if (step === contactStep) {
      return name.trim().length > 1 && telefon.trim().length >= 5;
    }
    return true;
  })();

  const handleNext = () => {
    if (isLastStep) {
      onSubmit({
        name,
        telefon,
        email: email || undefined,
        adresse: orderType === 'lieferung' ? address.strasse : undefined,
        plz: orderType === 'lieferung' ? address.plz : undefined,
        stadt: orderType === 'lieferung' ? address.stadt : undefined,
        lat: orderType === 'lieferung' ? address.lat : undefined,
        lng: orderType === 'lieferung' ? address.lng : undefined,
        etage: etage || undefined,
        tuercode: tuercode || undefined,
        lieferhinweis: lieferhinweis || undefined,
        zahlungsart,
        marketing_optin: marketingOptin,
      });
    } else {
      setStep((s) => s + 1);
    }
  };

  // Payment-Methods aus Tenant-Config filtern; Fallback (kein Config geladen) = alle drei
  const typCol = orderType === 'lieferung' ? 'enabled_lieferung' : orderType === 'abholung' ? 'enabled_abholung' : 'enabled_vor_ort';
  const enabledSet = new Set(
    (paymentMethods ?? []).filter((pm) => pm[typCol]).map((pm) => {
      // DB-method → unser UI-PaymentMethod-Typ
      if (pm.method === 'stripe') return 'online';
      if (pm.method === 'karte') return 'karte';
      if (pm.method === 'bar') return 'bar';
      return pm.method;
    }),
  );
  const noConfig = !paymentMethods || paymentMethods.length === 0;

  const paymentOptions: { id: PaymentMethod; label: string; icon: React.ReactNode; hint: string; show: boolean }[] = [
    {
      id: 'online',
      label: 'Online bezahlen',
      icon: <Globe className="h-5 w-5" />,
      hint: 'Kreditkarte, PayPal, Apple Pay',
      show: noConfig || enabledSet.has('online'),
    },
    {
      id: 'karte',
      label: 'Karte vor Ort',
      icon: <CreditCard className="h-5 w-5" />,
      hint: orderType === 'lieferung' ? 'Beim Fahrer' : 'Im Café',
      show: noConfig || enabledSet.has('karte'),
    },
    {
      id: 'bar',
      label: 'Bar',
      icon: <Banknote className="h-5 w-5" />,
      hint: orderType === 'lieferung' ? 'Beim Fahrer' : 'Im Café',
      show: noConfig || enabledSet.has('bar'),
    },
  ];

  // Wenn aktuelle Auswahl nicht mehr verfügbar ist, auf erste verfügbare Option switchen
  React.useEffect(() => {
    if (!open) return;
    const firstAvail = paymentOptions.find((p) => p.show);
    if (firstAvail && !paymentOptions.find((p) => p.id === zahlungsart && p.show)) {
      setZahlungsart(firstAvail.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orderType, paymentMethods]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-matcha-900/60 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal
      aria-label="Bestellung abschließen"
    >
      <div
        className={cn(
          'relative w-full max-w-lg overflow-hidden bg-surface shadow-strong',
          'h-[90vh] rounded-t-3xl sm:h-auto sm:max-h-[92vh] sm:rounded-3xl',
          'flex flex-col',
          'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-8 motion-safe:duration-300',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-black/5 px-5 py-4">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              aria-label="Zurück"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-matcha-900/70 transition hover:bg-black/5"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : (
            <div className="h-9 w-9" />
          )}
          <div className="flex-1 text-center">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-matcha-600">
              Schritt {step + 1} von {steps.length}
            </div>
            <div className="font-display text-lg font-bold text-matcha-900">{steps[step]}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-matcha-900/70 transition hover:bg-black/5"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Stepper bar */}
        <div className="flex gap-1.5 px-5 pt-3">
          {steps.map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors duration-300',
                i <= step ? 'bg-matcha-700' : 'bg-black/10',
              )}
            />
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {orderType === 'lieferung' && step === 0 && (
            <section className="space-y-4">
              <AddressAutocomplete
                value={address}
                onChange={setAddress}
                bias={locationCoords ?? undefined}
                autoFocus
              />

              {deliveryDistanceKm != null && (
                <div
                  className={cn(
                    'rounded-xl border px-3 py-2.5 text-xs flex items-center gap-2',
                    outOfRange
                      ? 'border-red-300 bg-red-50 text-red-900'
                      : 'border-matcha-300 bg-matcha-50 text-matcha-900',
                  )}
                  role="status"
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {outOfRange ? (
                    <span>
                      <strong>Außerhalb Liefergebiet.</strong> Du bist ca. {deliveryDistanceKm.toFixed(1)} km entfernt — wir liefern aktuell bis 8 km. Probier&apos;s mit Abholung.
                    </span>
                  ) : (
                    <span>
                      <strong>Im Liefergebiet.</strong> {deliveryDistanceKm.toFixed(1)} km von unserem Laden.
                    </span>
                  )}
                </div>
              )}

              {/* Live-ETA Widget — visuelle Aufschlüsselung */}
              {liveEta && (() => {
                const prepMin = liveEta.load === 'busy' ? 20 : liveEta.load === 'quiet' ? 12 : 15;
                const rideMin = Math.max(5, liveEta.eta_min - prepMin);
                const arrivalMin = new Date(Date.now() + liveEta.eta_min * 60_000);
                const arrivalStr = arrivalMin.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                const loadColor = liveEta.load === 'quiet' ? { border: 'border-matcha-300', bg: 'bg-matcha-50', dot: 'bg-matcha-500', text: 'text-matcha-800' } :
                                  liveEta.load === 'busy'  ? { border: 'border-orange-300', bg: 'bg-orange-50', dot: 'bg-orange-500', text: 'text-orange-800' } :
                                                             { border: 'border-blue-200', bg: 'bg-blue-50', dot: 'bg-blue-500', text: 'text-blue-800' };
                const loadLabel = liveEta.load === 'quiet' ? 'Wenig los' : liveEta.load === 'busy' ? 'Viel los' : 'Normal';
                return (
                  <div className={cn('rounded-xl border p-3', loadColor.border, loadColor.bg)}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className={cn('h-2 w-2 rounded-full', loadColor.dot)} />
                        <span className={cn('text-[10px] font-bold uppercase tracking-wider', loadColor.text)}>{loadLabel}</span>
                      </div>
                      <div className={cn('font-display text-lg font-black leading-none', loadColor.text)}>
                        ca. {liveEta.eta_min} Min.
                      </div>
                    </div>
                    {/* Breakdown Bar */}
                    <div className="flex rounded-lg overflow-hidden h-2 mb-1.5">
                      <div
                        className="bg-matcha-400"
                        style={{ width: `${(prepMin / liveEta.eta_min) * 100}%` }}
                        title={`Zubereitung: ~${prepMin} Min`}
                      />
                      <div
                        className="bg-orange-400"
                        style={{ width: `${(rideMin / liveEta.eta_min) * 100}%` }}
                        title={`Fahrzeit: ~${rideMin} Min`}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-matcha-700/60">
                      <span className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-matcha-400 inline-block" />
                        Küche ~{prepMin} Min
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-orange-400 inline-block" />
                        Fahrt ~{rideMin} Min
                      </span>
                      <span className="font-semibold text-matcha-900">≈ {arrivalStr} Uhr</span>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Etage (optional)" value={etage} onChange={setEtage} placeholder="3. OG" />
                <Field label="Türcode (optional)" value={tuercode} onChange={setTuercode} placeholder="1234" />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-matcha-600">Lieferhinweis (optional)</label>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {QUICK_REPLIES.map((q) => (
                    <button
                      type="button"
                      key={q}
                      onClick={() => setLieferhinweis((v) => (v ? `${v} · ${q}` : q))}
                      className="rounded-full bg-white px-3 py-1 text-xs font-medium text-matcha-900 shadow-subtle transition hover:bg-matcha-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={2}
                  value={lieferhinweis}
                  onChange={(e) => setLieferhinweis(e.target.value)}
                  placeholder="Alles was uns hilft, dich schnell zu finden."
                  className={cn(
                    'mt-2 w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
                  )}
                />
              </div>
            </section>
          )}

          {((orderType === 'lieferung' && step === 1) || (orderType === 'abholung' && step === 0)) && (
            <section className="space-y-4">
              <Field label="Dein Name" value={name} onChange={setName} placeholder="z.B. Franka" autoFocus icon={<User className="h-4 w-4" />} />
              <Field label="Telefon" value={telefon} onChange={setTelefon} placeholder="0151 1234567" inputMode="tel" />
              <Field label="E-Mail (optional)" value={email} onChange={setEmail} placeholder="für die Bestellbestätigung" inputMode="email" />

              {email && (
                <label className="flex items-start gap-3 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={marketingOptin}
                    onChange={(e) => setMarketingOptin(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-black/20 accent-matcha-700"
                  />
                  <span className="text-xs text-matcha-800">
                    Ja, ich möchte gelegentlich Rabatt-Codes und Aktionen per E-Mail bekommen.
                    Kann ich jederzeit widerrufen. <span className="text-matcha-800/60">(optional)</span>
                  </span>
                </label>
              )}

              <p className="text-xs text-matcha-800/60">
                Wir nutzen deine Daten nur für diese Bestellung. Keine Werbung, wenn du nicht zustimmst.
              </p>
            </section>
          )}

          {isLastStep && (
            <section className="space-y-4">
              {/* Gutschein-Code */}
              <div className="rounded-2xl border border-dashed border-matcha-700/30 bg-matcha-50/50 p-4">
                {voucher ? (
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-matcha-700 text-white flex items-center justify-center">
                      <Check className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-matcha-900">
                        <span className="font-mono">{voucher.code}</span> eingelöst
                      </div>
                      <div className="text-xs text-matcha-700">
                        {voucher.beschreibung ??
                          (voucher.typ === 'prozent' ? `${voucher.rabatt.toFixed(2).replace('.', ',')} € Rabatt` :
                           voucher.typ === 'fix' ? `${voucher.rabatt.toFixed(2).replace('.', ',')} € Rabatt` :
                           'Gratis-Lieferung')}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { onVoucherChange?.(null); setVoucherInput(''); }}
                      className="text-xs text-matcha-700 underline"
                    >
                      Entfernen
                    </button>
                  </div>
                ) : (
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-matcha-700">Gutschein-Code</label>
                    <div className="mt-1.5 flex gap-2">
                      <input
                        value={voucherInput}
                        onChange={(e) => { setVoucherInput(e.target.value.toUpperCase()); setVoucherError(null); }}
                        placeholder="WELCOME10"
                        className="flex-1 rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm font-mono outline-none focus:border-matcha-700"
                      />
                      <button
                        type="button"
                        onClick={() => voucherInput && redeemVoucher(voucherInput)}
                        disabled={voucherLoading || !voucherInput}
                        className="rounded-xl bg-matcha-900 text-matcha-50 px-4 text-sm font-bold hover:bg-matcha-800 disabled:opacity-40"
                      >
                        {voucherLoading ? '…' : 'Einlösen'}
                      </button>
                    </div>
                    {voucherError && (
                      <div className="mt-2 text-xs text-red-700">{voucherError}</div>
                    )}
                  </div>
                )}
              </div>

              <div className="text-sm text-matcha-800/70">
                Wähle, wie du zahlen möchtest. Alle Optionen sind sicher.
              </div>
              <div className="space-y-2">
                {paymentOptions.filter((p) => p.show).map((p) => {
                  const active = zahlungsart === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setZahlungsart(p.id)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-2xl border bg-white px-4 py-3 text-left transition',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
                        active
                          ? 'border-matcha-700 ring-2 ring-matcha-700/30'
                          : 'border-black/10 hover:border-matcha-700/40',
                      )}
                    >
                      <div className={cn('flex h-10 w-10 items-center justify-center rounded-full', active ? 'bg-matcha-700 text-white' : 'bg-matcha-50 text-matcha-700')}>
                        {p.icon}
                      </div>
                      <div className="flex-1">
                        <div className="font-display text-sm font-bold text-matcha-900">{p.label}</div>
                        <div className="text-xs text-matcha-800/60">{p.hint}</div>
                      </div>
                      <div
                        className={cn(
                          'flex h-5 w-5 items-center justify-center rounded-full border transition',
                          active ? 'border-matcha-700 bg-matcha-700 text-white' : 'border-black/20',
                        )}
                      >
                        {active && <Check className="h-3 w-3" />}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="rounded-2xl bg-matcha-50 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-matcha-800">Summe</span>
                  <span className="font-display text-xl font-bold text-matcha-900">{formatEuro(total)}&nbsp;€</span>
                </div>
                <p className="mt-1 text-xs text-matcha-800/60">
                  Inkl. MwSt. {orderType === 'lieferung' ? '· inkl. 2,90 € Lieferung' : '· Abholung im Café'}
                </p>
              </div>
            </section>
          )}
        </div>

        {/* Footer CTA */}
        <div className="border-t border-black/5 bg-white/80 px-5 py-4 backdrop-blur">
          <button
            type="button"
            onClick={handleNext}
            disabled={!canAdvance || loading}
            className={cn(
              'flex h-14 w-full items-center justify-between rounded-2xl px-5 font-display text-base font-bold shadow-soft transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-white',
              canAdvance && !loading
                ? 'bg-matcha-900 text-matcha-50 hover:bg-matcha-800'
                : 'cursor-not-allowed bg-matcha-100 text-matcha-900/40',
            )}
          >
            <span className="inline-flex items-center gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading
                ? 'Wird aufgegeben …'
                : isLastStep
                ? `Zahlungspflichtig bestellen`
                : 'Weiter'}
            </span>
            <span className="inline-flex items-center gap-1 font-mono tabular-nums">
              {formatEuro(total)}&nbsp;€
              {!loading && <ArrowRight className="h-4 w-4" />}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/* ------------------------------------------------------------------ */
/*  Form field                                                         */
/* ------------------------------------------------------------------ */

function Field({
  label,
  value,
  onChange,
  placeholder,
  icon,
  inputMode,
  autoFocus,
  small,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  autoFocus?: boolean;
  small?: boolean;
}) {
  return (
    <div className={small ? 'w-[96px]' : undefined}>
      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-matcha-600">{label}</label>
      <div className="relative mt-1.5">
        {icon && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-matcha-700/60">
            {icon}
          </span>
        )}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          inputMode={inputMode}
          autoFocus={autoFocus}
          className={cn(
            'h-12 w-full rounded-xl border border-black/10 bg-white px-4 text-sm text-matcha-900 placeholder:text-matcha-900/30',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
            icon && 'pl-10',
          )}
        />
      </div>
    </div>
  );
}
