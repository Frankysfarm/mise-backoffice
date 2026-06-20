'use client';

import { useState, useEffect, useCallback } from 'react';

interface DelayAlertStats {
  alertsToday: number;
  alertsTotal: number;
  suppressedTotal: number;
  criticalActiveNow: number;
  alreadyAlertedToday: number;
}

interface ScanResult {
  locationId: string;
  alerted: number;
  suppressed: number;
  errors: number;
}

export default function DelayAlertPushClient() {
  const [stats, setStats]       = useState<DelayAlertStats | null>(null);
  const [loading, setLoading]   = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError]       = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/delivery/admin/delay-alert-push?action=stats');
      const json = await res.json() as { ok: boolean; stats?: DelayAlertStats };
      if (json.ok && json.stats) setStats(json.stats);
    } catch {
      setError('Statistiken konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStats();
    const id = setInterval(() => { void fetchStats(); }, 60_000);
    return () => clearInterval(id);
  }, [fetchStats]);

  async function handleScanNow() {
    setScanning(true);
    setScanResult(null);
    setError(null);
    try {
      const res = await fetch('/api/delivery/admin/delay-alert-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scan_now' }),
      });
      const json = await res.json() as { ok: boolean; result?: ScanResult };
      if (json.ok && json.result) {
        setScanResult(json.result);
        void fetchStats();
      }
    } catch {
      setError('Scan fehlgeschlagen.');
    } finally {
      setScanning(false);
    }
  }

  async function handlePrune() {
    try {
      await fetch('/api/delivery/admin/delay-alert-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'prune', days_old: 30 }),
      });
      void fetchStats();
    } catch { /* silent */ }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Delay Alert Push</h1>
          <p className="text-sm text-gray-500 mt-1">
            Proaktive Push-Benachrichtigungen bei kritischem Verspätungsrisiko (Score ≥ 75)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void handleScanNow()}
            disabled={scanning}
            className="px-4 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 disabled:opacity-50 font-medium"
          >
            {scanning ? 'Scanne…' : 'Jetzt scannen'}
          </button>
          <button
            onClick={() => void handlePrune()}
            className="px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 font-medium"
          >
            Bereinigen
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {scanResult && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
          <strong>Scan abgeschlossen:</strong> {scanResult.alerted} gesendet
          {scanResult.suppressed > 0 && `, ${scanResult.suppressed} unterdrückt`}
          {scanResult.errors > 0 && `, ${scanResult.errors} Fehler`}
        </div>
      )}

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 h-24 animate-pulse" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <KpiCard
            label="Kritisch aktiv"
            value={stats.criticalActiveNow}
            color={stats.criticalActiveNow > 0 ? 'red' : 'green'}
          />
          <KpiCard
            label="Alerts heute"
            value={stats.alertsToday}
            color="orange"
          />
          <KpiCard
            label="Bereits gewarnt heute"
            value={stats.alreadyAlertedToday}
            color="gray"
          />
          <KpiCard
            label="Alerts gesamt"
            value={stats.alertsTotal}
            color="blue"
          />
          <KpiCard
            label="Unterdrückt gesamt"
            value={stats.suppressedTotal}
            color="gray"
          />
        </div>
      ) : null}

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">Wie funktioniert es?</p>
        <ul className="list-disc list-inside space-y-1 text-blue-700">
          <li>Alle 2 Minuten scannt der Cron aktive Bestellungen mit <strong>risk_level = critical</strong>.</li>
          <li>Kunden erhalten einmalig eine Browser-Push-Benachrichtigung mit Hinweis auf Verzögerung.</li>
          <li>Deduplizierung via <code>delay_push_alerts</code>-Tabelle — jede Bestellung wird nur einmal gewarnt.</li>
          <li>Terminal-Bestellungen (geliefert / storniert) werden automatisch übersprungen.</li>
        </ul>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: 'red' | 'orange' | 'green' | 'blue' | 'gray';
}) {
  const colorMap = {
    red:    'text-red-600 bg-red-50 border-red-200',
    orange: 'text-orange-600 bg-orange-50 border-orange-200',
    green:  'text-green-600 bg-green-50 border-green-200',
    blue:   'text-blue-600 bg-blue-50 border-blue-200',
    gray:   'text-gray-600 bg-gray-50 border-gray-200',
  };

  return (
    <div className={`rounded-xl border p-4 ${colorMap[color]}`}>
      <p className="text-xs font-medium opacity-75">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  );
}
