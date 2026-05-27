'use client';

import { useCallback, useEffect, useState } from 'react';

interface Driver {
  id: string;
  link_id: string;
  link_status: 'active' | 'suspended';
  joined_at: string;
  phone: string | null;
  email: string | null;
  name: string;
  vehicle: 'bike' | 'car';
  max_radius_km: number;
  frank_mode: 'auto' | 'confirm' | 'manual';
  state: string;
  active: boolean;
  total_deliveries: number;
  total_earnings: number;
  last_position_at: string | null;
  pending_first_login: boolean;
}

interface InviteResp {
  ok: true;
  driver_id: string;
  is_new_driver: boolean;
  email: string;
  mail: { sent: boolean; skipped?: string; error?: string };
  invite_link: string | null;
}

export function DriversClient() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [inviteResult, setInviteResult] = useState<{
    email: string;
    mailSent: boolean;
    inviteLink: string | null;
    skippedReason?: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/drivers', { cache: 'no-store' });
      const d = await r.json();
      if (d.ok) setDrivers(d.drivers);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      {/* Toolbar: Driver-App-Hint + Einladen-Button */}
      <div className="mb-6 rounded-2xl border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 text-sm text-muted-foreground">
          <strong className="text-foreground">Fahrer einladen</strong> — du gibst die E-Mail ein, der
          Fahrer setzt sein Passwort und loggt sich danach in der <strong>Mise Driver App</strong> ein.
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-full bg-matcha-900 text-matcha-50 px-5 py-2.5 font-bold text-sm hover:bg-matcha-800 shrink-0"
        >
          + Fahrer einladen
        </button>
      </div>

      {/* Erfolgs-/Fallback-Anzeige nach Invite */}
        {inviteResult && (
          <div
            className={
              'mb-6 rounded-2xl p-6 ' +
              (inviteResult.mailSent
                ? 'bg-[#E5EFE5] border border-[#5C8A5C]'
                : 'bg-[#FFF8DD] border border-[#F2D770]')
            }
          >
            {inviteResult.mailSent ? (
              <div className="flex items-start gap-3">
                <div className="text-2xl">✉️</div>
                <div className="flex-1">
                  <div className="font-semibold text-[#3A6B3A]">
                    Einladung verschickt an {inviteResult.email}
                  </div>
                  <p className="text-sm text-[#3A6B3A] opacity-80 mt-1">
                    Der Fahrer klickt den Link in der Mail, setzt sein Passwort und
                    loggt sich danach in der Mise Driver App ein.
                  </p>
                </div>
                <button
                  onClick={() => setInviteResult(null)}
                  className="px-3 py-2 text-sm text-[#3A6B3A] hover:underline"
                >
                  Schließen
                </button>
              </div>
            ) : (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-[#7A5C00] mb-2">
                  Mail-Versand nicht aktiv — Link zum Weitergeben
                </div>
                <p className="text-sm text-[#5C4500] mb-3">
                  Resend ist nicht konfiguriert
                  {inviteResult.skippedReason ? ` (${inviteResult.skippedReason})` : ''}.
                  Schick dem Fahrer ({inviteResult.email}) den folgenden Link
                  manuell — er ist 7 Tage gültig.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={inviteResult.inviteLink ?? ''}
                    className="flex-1 font-mono text-xs px-3 py-2 rounded-lg border border-[#F2D770] bg-white"
                  />
                  <button
                    onClick={() => {
                      if (inviteResult.inviteLink) {
                        navigator.clipboard.writeText(inviteResult.inviteLink);
                        alert('Link kopiert');
                      }
                    }}
                    className="px-4 py-2 rounded-full bg-[#E8B105] text-black font-semibold text-sm"
                  >
                    Kopieren
                  </button>
                  <button
                    onClick={() => setInviteResult(null)}
                    className="px-3 py-2 text-sm text-[#7A5C00] hover:underline"
                  >
                    Schließen
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Liste */}
        <div className="bg-white border border-[#ECE5D3] rounded-2xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-sm text-[#6B6B6B]">Lade Fahrer …</div>
          ) : drivers.length === 0 ? (
            <div className="p-16 text-center">
              <div className="text-lg font-semibold mb-2">Noch keine Fahrer</div>
              <p className="text-sm text-[#6B6B6B] mb-6 max-w-sm mx-auto">
                Lade deinen ersten Fahrer ein. Du gibst Name, Telefonnummer und
                Fahrzeug ein — wir generieren einen Login-Code, den der Fahrer in
                der Mise-Driver-App eingibt.
              </p>
              <button
                onClick={() => setShowForm(true)}
                className="px-5 py-2.5 rounded-full bg-black text-white text-sm font-medium"
              >
                + Ersten Fahrer einladen
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[#F8F5EE] text-[#6B6B6B] text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-5 py-3">Name</th>
                  <th className="text-left px-5 py-3">Kontakt</th>
                  <th className="text-left px-5 py-3">Fahrzeug</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-right px-5 py-3">Lieferungen</th>
                  <th className="text-right px-5 py-3">Verdienst</th>
                  <th className="text-right px-5 py-3">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((d) => (
                  <DriverRow key={d.id} driver={d} onChange={load} onInvited={setInviteResult ? (r) => setInviteResult({ email: r.email, mailSent: r.mail.sent, inviteLink: r.invite_link, skippedReason: r.mail.skipped }) : () => {}} />
                ))}
              </tbody>
            </table>
          )}
        </div>

      {showForm && (
        <InviteDriverForm
          onClose={() => setShowForm(false)}
          onInvited={(resp) => {
            setShowForm(false);
            setInviteResult({
              email: resp.email,
              mailSent: resp.mail.sent,
              inviteLink: resp.invite_link,
              skippedReason: resp.mail.skipped,
            });
            void load();
          }}
        />
      )}
    </div>
  );
}

function DriverRow({
  driver,
  onChange,
  onInvited,
}: {
  driver: Driver;
  onChange: () => void;
  onInvited: (r: InviteResp) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function resendInvite() {
    if (!driver.email) {
      alert('Dieser Fahrer hat keine Email-Adresse (alter OTP-Account). Lege ihn neu an.');
      return;
    }
    if (!confirm(`Neue Einladung an ${driver.email} senden?`)) return;
    setBusy(true);
    try {
      const r = await fetch('/api/admin/drivers/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: driver.email,
          name: driver.name,
          vehicle: driver.vehicle,
          max_radius_km: driver.max_radius_km,
        }),
      });
      const d = await r.json();
      if (r.ok && d.ok) onInvited(d);
      else alert(d.error ?? 'Fehler beim Senden');
    } finally {
      setBusy(false);
    }
  }

  async function toggleSuspend() {
    const action = driver.link_status === 'suspended' ? 'activate' : 'suspend';
    setBusy(true);
    try {
      await fetch(`/api/admin/drivers/${driver.id}/${action}`, { method: 'POST' });
      onChange();
    } finally {
      setBusy(false);
    }
  }

  const statusBadge =
    driver.link_status === 'suspended'
      ? { text: 'Gesperrt', bg: '#FCE3D7', fg: '#9B3A1A' }
      : driver.pending_first_login
      ? { text: 'Wartet auf Login', bg: '#FFF8DD', fg: '#7A5C00' }
      : driver.active
      ? driver.state === 'offline'
        ? { text: 'Offline', bg: '#EFEFEF', fg: '#444' }
        : { text: 'Im Dienst', bg: '#E5EFE5', fg: '#3A6B3A' }
      : { text: 'Außer Dienst', bg: '#EFEFEF', fg: '#444' };

  return (
    <tr className="border-t border-[#ECE5D3]">
      <td className="px-5 py-4 font-medium">{driver.name}</td>
      <td className="px-5 py-4 text-xs text-[#6B6B6B]">
        {driver.email ? (
          <span>{driver.email}</span>
        ) : driver.phone ? (
          <span className="font-mono">{driver.phone} <em className="text-[#ADA597]">(alt)</em></span>
        ) : (
          <span className="text-[#ADA597]">—</span>
        )}
      </td>
      <td className="px-5 py-4">
        {driver.vehicle === 'bike' ? '2-Rad' : 'Auto'} · {driver.max_radius_km} km
      </td>
      <td className="px-5 py-4">
        <span
          className="px-2.5 py-1 rounded-full text-[11px] font-semibold"
          style={{ background: statusBadge.bg, color: statusBadge.fg }}
        >
          {statusBadge.text}
        </span>
      </td>
      <td className="px-5 py-4 text-right font-mono">{driver.total_deliveries}</td>
      <td className="px-5 py-4 text-right font-mono">
        €{Number(driver.total_earnings).toFixed(2)}
      </td>
      <td className="px-5 py-4 text-right">
        <div className="flex justify-end gap-2">
          <button
            onClick={resendInvite}
            disabled={busy || !driver.email}
            className="px-3 py-1.5 text-xs rounded-full border border-[#ECE5D3] hover:bg-[#FAFAF7] disabled:opacity-50"
            title={driver.email ? 'Neue Einladungs-Mail senden' : 'Kein Email-Account (alter OTP-User)'}
          >
            Einladung neu senden
          </button>
          <button
            onClick={toggleSuspend}
            disabled={busy}
            className="px-3 py-1.5 text-xs rounded-full disabled:opacity-50"
            style={{
              background: driver.link_status === 'suspended' ? '#5C8A5C' : '#FCE3D7',
              color: driver.link_status === 'suspended' ? 'white' : '#9B3A1A',
            }}
          >
            {driver.link_status === 'suspended' ? 'Aktivieren' : 'Sperren'}
          </button>
        </div>
      </td>
    </tr>
  );
}

function InviteDriverForm({
  onClose,
  onInvited,
}: {
  onClose: () => void;
  onInvited: (r: InviteResp) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [vehicle, setVehicle] = useState<'bike' | 'car'>('bike');
  const [maxRadius, setMaxRadius] = useState(4);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErr('Bitte Name und gültige Email angeben.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/admin/drivers/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          vehicle,
          max_radius_km: maxRadius,
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setErr(d.error ?? 'Fehler');
        return;
      }
      onInvited(d);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center sm:justify-center">
      <div className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl p-7 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold tracking-tight">Fahrer einladen</h2>
          <button onClick={onClose} className="text-[#6B6B6B] text-xl">×</button>
        </div>
        <p className="text-sm text-[#6B6B6B] mb-6">
          Wir schicken dem Fahrer eine Einladung per Email. Er klickt den Link,
          setzt sein Passwort und loggt sich danach in der Mise Driver App ein.
        </p>

        <label className="block mb-4">
          <span className="text-xs uppercase tracking-wider font-semibold text-[#6B6B6B]">
            Name
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z.B. Marc Müller"
            className="mt-1 w-full px-4 py-3 rounded-xl border border-[#ECE5D3] bg-[#FAFAF7] outline-none focus:border-black"
          />
        </label>

        <label className="block mb-4">
          <span className="text-xs uppercase tracking-wider font-semibold text-[#6B6B6B]">
            Email
          </span>
          <input
            type="email"
            inputMode="email"
            autoCapitalize="off"
            autoCorrect="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="fahrer@example.com"
            className="mt-1 w-full px-4 py-3 rounded-xl border border-[#ECE5D3] bg-[#FAFAF7] outline-none focus:border-black"
          />
        </label>

        <div className="mb-4">
          <span className="text-xs uppercase tracking-wider font-semibold text-[#6B6B6B] block mb-2">
            Fahrzeug
          </span>
          <div className="grid grid-cols-2 gap-2">
            {(['bike', 'car'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setVehicle(v)}
                className="py-3 rounded-xl border-2 font-medium text-sm"
                style={{
                  borderColor: vehicle === v ? 'black' : '#ECE5D3',
                  background: vehicle === v ? 'black' : 'white',
                  color: vehicle === v ? 'white' : 'black',
                }}
              >
                {v === 'bike' ? '🚲 2-Rad' : '🚗 Auto'}
              </button>
            ))}
          </div>
        </div>

        <label className="block mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wider font-semibold text-[#6B6B6B]">
              Max Liefer-Radius
            </span>
            <span className="font-mono text-sm font-semibold">{maxRadius} km</span>
          </div>
          <input
            type="range"
            min={1}
            max={vehicle === 'car' ? 15 : 8}
            value={maxRadius}
            onChange={(e) => setMaxRadius(Number(e.target.value))}
            className="w-full"
          />
        </label>

        {err && (
          <div className="mb-4 p-3 rounded-xl bg-[#FCE3D7] text-[#9B3A1A] text-sm">{err}</div>
        )}

        <button
          onClick={submit}
          disabled={busy}
          className="w-full py-3.5 rounded-full bg-black text-white font-medium disabled:opacity-50"
        >
          {busy ? 'Sende Einladung …' : 'Einladung senden'}
        </button>
      </div>
    </div>
  );
}
