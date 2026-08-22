'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Bluetooth, Check, ExternalLink, Info, Plus, Printer,
  RefreshCw, Smartphone, Trash2, X, Zap,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { isNativePOS, nativeBridge } from '@/lib/mise-pos-native';
import { PrinterPairingDialog } from '../terminal/printer-pairing-dialog';
import { cn } from '@/lib/utils';

interface Props {
  tenantName: string;
  tenantAddress: string;
  tenantTaxId: string;
  locationName: string;
}

export function PrintersClient({ tenantName, tenantAddress, tenantTaxId, locationName }: Props) {
  const [native, setNative] = useState(false);
  const [paired, setPaired] = useState<{ deviceId: string; name: string | null } | null>(null);
  const [pairingOpen, setPairingOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    const isNat = isNativePOS();
    setNative(isNat);
    if (!isNat) return;
    const b = nativeBridge();
    if (!b) return;
    const p = await b.getPairedPrinter();
    setPaired(p);
  }

  async function testPrint() {
    const b = nativeBridge();
    if (!b) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await b.printReceipt({
        restaurantName: tenantName,
        restaurantAddress: tenantAddress,
        restaurantTaxId: tenantTaxId,
        orderNumber: 'TEST-001',
        bestelltAm: new Date(),
        items: [
          { qty: 1, name: 'Test-Bon', unitPrice: 0, total: 0 },
        ],
        subtotal: 0,
        total: 0,
        paymentMethod: 'bar',
        paperWidthMm: 80,
      });
      if (result.ok) {
        setTestResult({ ok: true, msg: `Test-Bon gedruckt (${result.bytesSent} Bytes)` });
      } else {
        setTestResult({ ok: false, msg: result.error });
      }
    } catch (e) {
      setTestResult({ ok: false, msg: e instanceof Error ? e.message : 'Druck fehlgeschlagen' });
    } finally {
      setTesting(false);
    }
  }

  async function unpair() {
    if (!confirm('Drucker wirklich entfernen?')) return;
    const b = nativeBridge();
    if (!b) return;
    setRemoving(true);
    try {
      await b.forgetPrinter();
      setPaired(null);
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bondrucker"
        description={`Verbinde deinen Bondrucker mit der Mise POS-App · ${locationName}`}
      />

      {!native && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <Smartphone className="h-6 w-6 text-amber-700 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-display font-black text-lg text-amber-900 mb-1">
                Diese Funktion läuft nur in der Mise POS-App
              </h3>
              <p className="text-sm text-amber-900 leading-relaxed mb-3">
                Bondrucker werden per Bluetooth mit der nativen Mise-App auf iPad oder iPhone verbunden.
                Im Browser kannst du <Link href="/pos/settings#bon" className="underline font-bold">E-Mail-Bons</Link> oder{' '}
                <Link href="/pos/settings#bon" className="underline font-bold">QR-Code-Bons</Link> nutzen.
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  href="https://testflight.apple.com/join/REPLACE_TESTFLIGHT_LINK"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-700 text-white text-sm font-bold hover:bg-amber-800"
                >
                  <ExternalLink className="h-4 w-4" />
                  Mise POS App via TestFlight installieren
                </a>
                <Link
                  href="/pos/settings#bon"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-amber-700 text-amber-900 text-sm font-bold hover:bg-amber-100"
                >
                  E-Mail-Bon einrichten
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border-2 border-zinc-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
          <div>
            <h2 className="font-display font-black text-lg">Verbundene Drucker</h2>
            <p className="text-xs text-zinc-600 mt-0.5">Bluetooth-Bondrucker (ESC/POS, 80mm oder 58mm)</p>
          </div>
          {native && (
            <button
              onClick={() => setPairingOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-sm font-bold hover:bg-zinc-700"
            >
              <Plus className="h-4 w-4" />
              Drucker hinzufügen
            </button>
          )}
        </div>

        <div className="p-5">
          {!paired ? (
            <div className="text-center py-8 text-zinc-500">
              <Printer className="h-12 w-12 mx-auto mb-3 text-zinc-300" />
              <p className="text-sm">Noch kein Drucker verbunden.</p>
              {native && (
                <button
                  onClick={() => setPairingOpen(true)}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700"
                >
                  <Bluetooth className="h-4 w-4" />
                  Jetzt verbinden
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4">
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-xl bg-emerald-600 text-white grid place-items-center shrink-0">
                  <Printer className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-display font-black text-emerald-900 truncate">
                      {paired.name || 'Bluetooth-Drucker'}
                    </h3>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold uppercase">
                      <Check className="h-3 w-3" />
                      Verbunden
                    </span>
                  </div>
                  <p className="text-xs text-emerald-700 font-mono truncate">ID: {paired.deviceId}</p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={testPrint}
                      disabled={testing}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-sm font-bold hover:bg-emerald-800 disabled:opacity-50"
                    >
                      <Zap className={cn('h-4 w-4', testing && 'animate-pulse')} />
                      {testing ? 'Drucke …' : 'Test-Bon drucken'}
                    </button>
                    <button
                      onClick={refresh}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 text-emerald-900 text-sm font-bold hover:bg-emerald-100"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Status prüfen
                    </button>
                    <button
                      onClick={unpair}
                      disabled={removing}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-300 text-red-700 text-sm font-bold hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Entfernen
                    </button>
                  </div>

                  {testResult && (
                    <div
                      className={cn(
                        'mt-3 px-3 py-2 rounded-lg text-sm font-bold flex items-start gap-2',
                        testResult.ok
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-red-100 text-red-900',
                      )}
                    >
                      {testResult.ok ? <Check className="h-4 w-4 mt-0.5 shrink-0" /> : <X className="h-4 w-4 mt-0.5 shrink-0" />}
                      <span>{testResult.msg}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 p-5">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-700 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900 leading-relaxed">
            <h4 className="font-display font-black mb-2">So funktioniert Bondruck in Mise:</h4>
            <ol className="list-decimal list-inside space-y-1.5">
              <li><strong>Drucker einschalten</strong> — am besten Star TSP143IIIBI oder Epson TM-m30III (Bluetooth-Modelle)</li>
              <li><strong>Pairing-Modus</strong> — Power-Knopf gedrückt halten bis Drucker blinkt</li>
              <li><strong>In Mise POS-App</strong> — &bdquo;Drucker hinzufügen&ldquo; → Drucker erscheint in Liste → tippen</li>
              <li><strong>Test-Bon drucken</strong> — bestätigt dass alles läuft</li>
              <li><strong>Fertig</strong> — alle Bestellungen drucken automatisch (egal ob POS, QR-Tisch oder Lieferung)</li>
            </ol>
            <p className="mt-3 pt-3 border-t border-blue-200">
              <strong>Cloud-Drucker (Star CloudPRNT, Epson Server Direct)</strong> kommen in Phase 2 — für Restaurants
              ohne iPad-POS oder mit mehreren Standorten.
            </p>
          </div>
        </div>
      </div>

      {pairingOpen && <PrinterPairingDialog onClose={() => { setPairingOpen(false); refresh(); }} />}
    </div>
  );
}
