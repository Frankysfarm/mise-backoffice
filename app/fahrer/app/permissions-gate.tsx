'use client';

import { useEffect, useState } from 'react';
import { Bell, MapPin, Check, Loader2, ArrowRight, AlertCircle } from 'lucide-react';

/**
 * Pflicht-Setup: Mitteilungen + Standort erlauben vor allem anderen.
 * Wird angezeigt solange eine Permission fehlt.
 */
export function PermissionsGate({
  vapidPublic,
  driverId,
  children,
}: {
  vapidPublic: string;
  driverId: string;
  children: React.ReactNode;
}) {
  const [pushStatus, setPushStatus] = useState<'unknown' | 'granted' | 'denied' | 'default'>('unknown');
  const [gpsStatus, setGpsStatus] = useState<'unknown' | 'granted' | 'denied' | 'prompt'>('unknown');
  const [loading, setLoading] = useState<'push' | 'gps' | null>(null);

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setPushStatus(Notification.permission as any);
    }
    // GPS-Status (Chrome) — iOS kann nur bei watch fragen
    if ('permissions' in navigator) {
      (navigator.permissions as any).query({ name: 'geolocation' })
        .then((r: any) => setGpsStatus(r.state))
        .catch(() => setGpsStatus('unknown'));
    }
  }, []);

  async function requestPush() {
    setLoading('push');
    try {
      // 0) PWA-Check: auf iOS MUSS die App vom Homescreen laufen
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches
        || (navigator as any).standalone === true;
      const isIOS = /iP(hone|od|ad)/.test(navigator.userAgent);
      if (isIOS && !isStandalone) {
        alert('Auf iPhone musst du die App vom Homescreen-Icon starten (nicht Safari). Sonst blockiert iOS Push-Nachrichten.');
        setLoading(null); return;
      }

      if (typeof Notification === 'undefined') {
        alert('Dein Browser unterstützt keine Push-Nachrichten.');
        setLoading(null); return;
      }

      const perm = await Notification.requestPermission();
      setPushStatus(perm as any);
      if (perm !== 'granted') {
        alert(`Mitteilungen sind ${perm === 'denied' ? 'abgelehnt — iPhone-Einstellungen → Mise → Mitteilungen einschalten' : 'nicht erlaubt'}.`);
        setLoading(null); return;
      }

      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        alert('Service Worker fehlt. App ist nicht richtig installiert.');
        setLoading(null); return;
      }

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        // iOS Safari akzeptiert nur Uint8Array; manche Browser auch Base64-String.
        // Wir probieren beides, String-Fallback bei Fehler.
        try {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublic).buffer as ArrayBuffer,
          });
        } catch (subErr: any) {
          // Fallback: mit String versuchen
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: vapidPublic as any,
          });
        }
      }
      const res = await fetch('/api/drivers/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      const json = await res.json();
      if (!json.ok) alert('Server-Fehler beim Speichern: ' + (json.error ?? 'unbekannt'));
    } catch (e: any) {
      alert('Push-Fehler: ' + (e?.message ?? String(e)));
    } finally {
      setLoading(null);
    }
  }

  async function requestGps() {
    setLoading('gps');
    try {
      await new Promise<void>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          () => { setGpsStatus('granted'); resolve(); },
          () => { setGpsStatus('denied'); reject(); },
          { enableHighAccuracy: true, timeout: 15000 },
        );
      });
    } catch {}
    setLoading(null);
  }

  const pushOk = pushStatus === 'granted';
  const gpsOk = gpsStatus === 'granted';
  const allOk = pushOk && gpsOk;
  const [skipped, setSkipped] = useState(false);

  // Wenn bereits beide erlaubt ODER übersprungen: App anzeigen
  if (allOk || skipped) return <>{children}</>;

  return (
    <div className="min-h-screen bg-matcha-900 text-white flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex h-16 w-16 rounded-2xl bg-accent text-matcha-900 items-center justify-center mb-4">
              <Bell size={32} />
            </div>
            <h1 className="font-display text-3xl font-black tracking-tight">
              Einmal einrichten
            </h1>
            <p className="mt-3 text-matcha-200 text-sm leading-relaxed">
              Damit du bei neuen Touren sofort Bescheid bekommst, brauchen wir Mitteilungen und deinen Standort.
            </p>
          </div>

          <div className="space-y-3">
            <PermissionCard
              icon={<Bell size={20} />}
              title="Mitteilungen"
              body="Ein Klingeln wenn neue Touren kommen — auch wenn die App zu ist."
              status={pushStatus === 'granted' ? 'granted' : pushStatus === 'denied' ? 'denied' : 'pending'}
              loading={loading === 'push'}
              onActivate={requestPush}
            />
            <PermissionCard
              icon={<MapPin size={20} />}
              title="Standort"
              body="Für Routen-Berechnung und Live-Tracking zum Kunden."
              status={gpsStatus === 'granted' ? 'granted' : gpsStatus === 'denied' ? 'denied' : 'pending'}
              loading={loading === 'gps'}
              onActivate={requestGps}
            />
          </div>

          {(pushStatus === 'denied' || gpsStatus === 'denied') && (
            <div className="mt-6 rounded-2xl bg-amber-500/10 border-2 border-amber-400 p-4 text-sm">
              <div className="flex items-start gap-2">
                <AlertCircle size={18} className="text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-amber-200">Bereits abgelehnt?</div>
                  <div className="text-amber-100 mt-1 leading-relaxed">
                    Öffne <strong>iPhone → Einstellungen → Mise → Mitteilungen / Ort</strong> und erlaube beides. Dann App neu starten.
                  </div>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={() => setSkipped(true)}
            className="mt-6 w-full h-12 rounded-xl bg-white/10 text-matcha-100 text-sm font-bold"
          >
            Später einrichten — jetzt zur App
          </button>

          <div className="mt-3 text-[10px] text-matcha-400 text-center">
            Status: Push = {pushStatus} · GPS = {gpsStatus}
          </div>
        </div>
      </div>
    </div>
  );
}

function PermissionCard({
  icon, title, body, status, loading, onActivate,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  status: 'granted' | 'denied' | 'pending';
  loading: boolean;
  onActivate: () => void;
}) {
  return (
    <div className={`rounded-2xl border-2 p-4 transition ${
      status === 'granted' ? 'border-accent bg-accent/10' :
      status === 'denied' ? 'border-red-500/40 bg-red-500/10' :
      'border-white/10 bg-white/5'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`h-10 w-10 rounded-xl grid place-items-center shrink-0 ${
          status === 'granted' ? 'bg-accent text-matcha-900' : 'bg-white/10 text-accent'
        }`}>
          {status === 'granted' ? <Check size={20} /> : icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold">{title}</div>
          <p className="text-xs text-matcha-200 mt-0.5 leading-relaxed">{body}</p>
        </div>
      </div>
      {status !== 'granted' && (
        <button
          onClick={onActivate}
          disabled={loading}
          className={`mt-3 w-full h-11 rounded-xl font-display font-bold text-sm inline-flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 ${
            status === 'denied' ? 'bg-white/10 text-matcha-200' : 'bg-accent text-matcha-900'
          }`}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : (status === 'denied' ? 'Erneut versuchen' : 'Erlauben')}
          {!loading && <ArrowRight size={14} />}
        </button>
      )}
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
