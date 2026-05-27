'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ChefHat, Loader2, Wifi } from 'lucide-react';

/**
 * Kitchen-Display Pairing — "Lightspeed-Style":
 * 1. Display öffnet /kitchen/pair → wählt Station (oder es wird automatisch eine gefunden)
 * 2. Zeigt 6-stelligen Code an
 * 3. Manager gibt Code im Backoffice unter /pos/stations/{id}/devices ein
 * 4. Device ist gekoppelt → Display lädt /kitchen/device/{device_token}
 */
export function PairingScreen() {
  const supabase = createClient();
  const router = useRouter();
  const [stage, setStage] = useState<'choose-station' | 'waiting' | 'paired'>('choose-station');
  const [stations, setStations] = useState<{ id: string; name: string; farbe: string | null }[]>([]);
  const [loadingStations, setLoadingStations] = useState(true);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [deviceToken, setDeviceToken] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState('');
  const [err, setErr] = useState<string | null>(null);

  // Public stations fetch (RLS allows select where aktiv=true)
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('kitchen_stations').select('id, name, farbe').eq('aktiv', true);
      setStations((data as any[]) ?? []);
      setLoadingStations(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function requestCode(stationId: string) {
    setErr(null);
    const { data, error } = await supabase.rpc('request_kds_pairing_code', {
      p_station_id: stationId,
      p_name: deviceName || null,
    });
    if (error || !(data as any)?.ok) {
      setErr(error?.message ?? (data as any)?.error ?? 'Fehler');
      return;
    }
    setPairingCode((data as any).code);
    setDeviceToken(null);
    setStage('waiting');

    // Pollen: sobald gepaart, device_token holen und redirect
    const deviceId = (data as any).device_id;
    const poll = setInterval(async () => {
      const { data: d } = await supabase.from('kitchen_display_devices')
        .select('device_token, gepaart_am').eq('id', deviceId).maybeSingle();
      if ((d as any)?.gepaart_am) {
        clearInterval(poll);
        setDeviceToken((d as any).device_token);
        setStage('paired');
        setTimeout(() => {
          router.push(`/kitchen/device/${(d as any).device_token}`);
        }, 1200);
      }
    }, 2000);

    // Timeout 10 Min
    setTimeout(() => { clearInterval(poll); }, 600_000);
  }

  // --- Stage: waiting for pairing
  if (stage === 'waiting' && pairingCode) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] text-white grid place-items-center p-6">
        <div className="text-center max-w-lg">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-white/10 grid place-items-center mb-6">
            <Wifi className="h-8 w-8 text-accent animate-pulse" />
          </div>
          <div className="text-[10px] font-bold uppercase tracking-[0.4em] opacity-60 mb-3">Pairing-Code</div>
          <div className="font-display font-black tracking-[0.25em] text-8xl md:text-9xl mb-6 text-accent">
            {pairingCode}
          </div>
          <div className="text-lg opacity-80 leading-relaxed">
            Gib diesen Code in der Kasse ein:
          </div>
          <div className="mt-4 rounded-2xl bg-white/5 border border-white/10 p-4 text-sm text-white/80">
            <strong>Backoffice → Kasse → Küchen-Stationen → Display verbinden</strong>
          </div>
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-white/60">
            <Loader2 className="h-3 w-3 animate-spin" /> Warte auf Verbindung · Code 10 Min gültig
          </div>
        </div>
      </div>
    );
  }

  // --- Stage: paired → kurze Bestätigung bevor redirect
  if (stage === 'paired') {
    return (
      <div className="min-h-screen bg-[#0f0f0f] text-white grid place-items-center p-6">
        <div className="text-center">
          <div className="mx-auto h-20 w-20 rounded-full bg-matcha-600 grid place-items-center mb-4 animate-bounce">
            <ChefHat className="h-10 w-10 text-white" />
          </div>
          <div className="font-display text-3xl font-black">Verbunden</div>
          <div className="text-sm text-white/60 mt-2">Lade Küchen-Display …</div>
        </div>
      </div>
    );
  }

  // --- Stage: choose station
  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white p-6">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-2xl bg-accent text-matcha-900 grid place-items-center">
            <ChefHat className="h-6 w-6" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-matcha-200">Mise Küchen-Display</div>
            <div className="font-display text-2xl font-black">Neu verbinden</div>
          </div>
        </div>

        <p className="text-white/70 mb-6">
          Welche Station soll dieses Display anzeigen? Nach der Auswahl bekommst du einen Code — den gibst du einmalig in deiner Kasse ein.
        </p>

        <input
          value={deviceName}
          onChange={(e) => setDeviceName(e.target.value)}
          placeholder="Name (optional) — z. B. iPad Küche 1"
          className="w-full h-12 rounded-2xl bg-white/5 border border-white/15 text-white px-4 mb-4 focus:outline-none focus:border-accent"
        />

        {loadingStations ? (
          <div className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-white/60" /></div>
        ) : stations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/20 p-6 text-center">
            <div className="text-white/70">Keine Stationen gefunden.</div>
            <div className="text-xs text-white/50 mt-2">Der Restaurant-Besitzer muss im Backoffice unter <strong>Kasse → Küchen-Stationen</strong> erst eine anlegen.</div>
          </div>
        ) : (
          <div className="space-y-2">
            {stations.map((s) => (
              <button
                key={s.id}
                onClick={() => requestCode(s.id)}
                className="w-full rounded-2xl bg-white/5 border-2 border-white/10 hover:border-accent hover:bg-white/10 transition p-4 text-left flex items-center gap-4"
              >
                <div
                  className="h-12 w-12 rounded-2xl grid place-items-center text-2xl shrink-0"
                  style={{ background: s.farbe ?? '#14532d' }}
                >
                  👨‍🍳
                </div>
                <div className="flex-1">
                  <div className="font-display font-bold">{s.name}</div>
                  <div className="text-xs text-white/60">Tippen zum Verbinden</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {err && <div className="mt-4 text-sm text-red-400">{err}</div>}
      </div>
    </div>
  );
}
