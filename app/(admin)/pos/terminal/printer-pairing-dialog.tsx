'use client';

import { useEffect, useState } from 'react';
import { Bluetooth, Check, Loader2, Printer, RefreshCw, X, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isNativePOS, nativeBridge } from '@/lib/mise-pos-native';

interface ScanResult {
  deviceId: string;
  name: string | null;
  rssi?: number;
}

export function PrinterPairingDialog({ onClose }: { onClose: () => void }) {
  const [native] = useState(() => isNativePOS());
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<ScanResult[]>([]);
  const [pairingId, setPairingId] = useState<string | null>(null);
  const [pairedId, setPairedId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function scan() {
    const b = nativeBridge();
    if (!b) return;
    setErr(null);
    setScanning(true);
    setDevices([]);
    try {
      const list = await b.listPrinters(8000);
      setDevices(list);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Scan fehlgeschlagen');
    } finally {
      setScanning(false);
    }
  }

  async function pair(deviceId: string) {
    const b = nativeBridge();
    if (!b) return;
    setPairingId(deviceId);
    setErr(null);
    try {
      const result = await b.pairPrinter(deviceId);
      setPairedId(result.deviceId);
      setTimeout(onClose, 1200);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Pairing fehlgeschlagen');
    } finally {
      setPairingId(null);
    }
  }

  useEffect(() => {
    if (native) scan();
  }, [native]); // eslint-disable-line

  return (
    <div className="fixed inset-0 z-[60] bg-black/85 grid items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden flex flex-col max-h-[92vh]">
        <header className="px-5 py-4 border-b flex items-center gap-3 bg-gradient-to-br from-blue-50 to-blue-100 shrink-0">
          <div className="h-11 w-11 rounded-xl bg-blue-600 text-white grid place-items-center">
            <Printer className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Hardware</div>
            <h2 className="font-display text-xl font-black">Bondrucker verbinden</h2>
          </div>
          <button onClick={onClose} className="h-9 w-9 rounded-full hover:bg-white/60 grid place-items-center" aria-label="Schließen">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="p-5 flex-1 overflow-y-auto">
          {!native ? (
            <NotNativeFallback />
          ) : (
            <>
              <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 leading-relaxed">
                <strong>So geht&apos;s:</strong> Schalte deinen Bondrucker ein und halte den Power-Knopf gedrückt bis er blinkt (Pairing-Modus). Tippe ihn dann unten in der Liste an.
              </div>

              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm">Gefundene Geräte</h3>
                <button
                  onClick={scan}
                  disabled={scanning}
                  className="text-xs font-bold text-blue-700 hover:underline inline-flex items-center gap-1 disabled:opacity-50"
                >
                  {scanning ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  {scanning ? 'Suche…' : 'Neu scannen'}
                </button>
              </div>

              {scanning && devices.length === 0 ? (
                <div className="py-10 text-center text-gray-500">
                  <div className="relative inline-block mb-3">
                    <Bluetooth className="h-8 w-8 mx-auto text-blue-500 animate-pulse" />
                    <div className="absolute inset-0 rounded-full border-2 border-blue-200 animate-ping" />
                  </div>
                  <p className="text-sm">Suche nach Bluetooth-Druckern…</p>
                  <p className="text-xs mt-1 text-gray-400">Das dauert ca. 8 Sekunden</p>
                </div>
              ) : devices.length === 0 ? (
                <div className="py-10 text-center text-gray-500">
                  <Printer className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">Kein Drucker gefunden</p>
                  <p className="text-xs mt-2 text-gray-500 leading-relaxed max-w-xs mx-auto">
                    Drucker eingeschaltet? Pairing-Modus aktiv? Bluetooth am iPad an?
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {devices.map((d) => {
                    const isPairing = pairingId === d.deviceId;
                    const isPaired = pairedId === d.deviceId;
                    return (
                      <button
                        key={d.deviceId}
                        onClick={() => pair(d.deviceId)}
                        disabled={pairingId !== null}
                        className={cn(
                          'w-full p-3 rounded-xl border text-left transition flex items-center gap-3',
                          isPaired ? 'bg-emerald-50 border-emerald-300' : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50',
                          'disabled:opacity-50 disabled:cursor-not-allowed',
                        )}
                      >
                        <div className={cn(
                          'h-10 w-10 rounded-lg grid place-items-center shrink-0',
                          isPaired ? 'bg-emerald-500 text-white' : 'bg-blue-100 text-blue-700',
                        )}>
                          {isPaired ? <Check className="h-5 w-5" /> : <Printer className="h-5 w-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm truncate">
                            {d.name || 'Unbenannter Drucker'}
                          </div>
                          <div className="text-[11px] text-gray-500 font-mono truncate">
                            {d.deviceId}
                          </div>
                        </div>
                        {isPairing ? (
                          <Loader2 className="h-5 w-5 animate-spin text-blue-600 shrink-0" />
                        ) : (
                          <div className="text-[10px] text-gray-400 shrink-0">
                            {d.rssi !== undefined && `${d.rssi} dBm`}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {err && (
                <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                  {err}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function NotNativeFallback() {
  return (
    <div className="space-y-4 text-center py-4">
      <div className="h-16 w-16 rounded-2xl bg-amber-100 text-amber-700 grid place-items-center mx-auto">
        <Printer className="h-8 w-8" />
      </div>
      <div className="space-y-1">
        <h3 className="font-display text-xl font-black">Bondruck nur in der App</h3>
        <p className="text-sm text-gray-600 leading-relaxed max-w-sm mx-auto">
          Bondrucker per Bluetooth funktioniert in der <strong>Mise POS</strong>-App.
          Im Browser läuft alles andere — Bons werden per E-Mail oder QR-Code an die Gäste verschickt.
        </p>
      </div>
      <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2 text-sm">
        <div className="font-bold">Mise POS App holen:</div>
        <ul className="space-y-1 text-gray-700">
          <li>• iOS: App Store → &bdquo;Mise POS&ldquo; suchen</li>
          <li>• Android: Play Store → &bdquo;Mise POS&ldquo; suchen</li>
        </ul>
      </div>
      <a
        href="https://mise-gastro.de/app"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-sm font-bold text-blue-700 hover:underline"
      >
        App-Store-Links <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}
