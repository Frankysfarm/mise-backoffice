'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { connectDomain, disconnectDomain, checkDomain, buyDomain } from './domain-actions';

type Status = 'none' | 'pending' | 'active' | 'error';
type CheckRes = { domain: string; available: boolean; priceCents: number | null; premium?: boolean };
const eur = (c: number | null) => c == null ? '–' : (c / 100).toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €';

const C = { ink: '#0F172A', sub: '#64748B', mut: '#94A3B8', line: '#E2E8F0', indigo: '#4F46E5', indigoD: '#4338CA', soft: '#EEF2FF' };
const HEAD = "'Space Grotesk', system-ui, sans-serif";
const inp: React.CSSProperties = { flex: 1, height: 44, border: `1.5px solid ${C.line}`, borderRadius: 11, padding: '0 14px', fontSize: 14.5, color: C.ink, outline: 'none' };
const btn = (primary = true): React.CSSProperties => ({ height: 44, padding: '0 20px', borderRadius: 11, border: primary ? 'none' : `1.5px solid ${C.line}`, background: primary ? C.indigo : '#fff', color: primary ? '#fff' : '#475569', fontWeight: 700, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap' });

export function DomainManager({ subdomain, customDomain, status, errorMsg, serverIp, registrarConfigured }: {
  subdomain: string; customDomain: string | null; status: Status; errorMsg: string | null; serverIp: string; registrarConfigured: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<'connect' | 'buy'>('connect');
  const [domain, setDomain] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: 'err' | 'ok'; x: string } | null>(null);
  // Kauf
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<CheckRes[] | null>(null);
  const [copied, setCopied] = useState(false);

  const connected = status === 'active';
  const pending = status === 'pending';

  async function onConnect() {
    if (busy) return; setBusy(true); setMsg(null);
    const r = await connectDomain(domain);
    setBusy(false);
    if (!r.ok) { setMsg({ t: 'err', x: r.error || 'Fehler' }); return; }
    setDomain(''); router.refresh();
  }
  async function onDisconnect() {
    if (!confirm('Domain wirklich trennen? Dein Shop ist dann nur noch über die MISE-Subdomain erreichbar.')) return;
    setBusy(true); await disconnectDomain(); setBusy(false); router.refresh();
  }
  async function onSearch() {
    if (!q.trim() || searching) return; setSearching(true); setResults(null);
    const r = await checkDomain(q);
    setSearching(false);
    if (!r.ok) { setMsg({ t: 'err', x: r.error || 'Fehler' }); return; }
    setResults(r.results);
  }
  async function onBuy(d: CheckRes) {
    if (!confirm(`„${d.domain}" für ${eur(d.priceCents)}/Jahr kaufen und mit deinem Shop verbinden?`)) return;
    setBusy(true); setMsg(null);
    const r = await buyDomain(d.domain, d.priceCents);
    setBusy(false);
    if (!r.ok) { setMsg({ t: 'err', x: r.error || 'Kauf fehlgeschlagen' }); return; }
    setMsg({ t: 'ok', x: `${r.domain} gekauft! Wir richten SSL ein — in wenigen Minuten ist deine Domain live.` });
    router.refresh();
  }
  function copyIp() { navigator.clipboard?.writeText(serverIp).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }

  return (
    <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 16, padding: 22 }}>
      <h3 style={{ fontFamily: HEAD, fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 3 }}>Eigene Domain</h3>
      <p style={{ fontSize: 13.5, color: C.sub, marginBottom: 16 }}>Dein Shop läuft immer auf <b>{subdomain}</b>. Verbinde oder kaufe eine eigene Domain für einen professionellen Auftritt.</p>

      {/* AKTUELLER STATUS */}
      {connected && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: '#F0FDF4', border: '1px solid #A7F3D0', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981' }} /><div><div style={{ fontFamily: HEAD, fontSize: 15, fontWeight: 700, color: '#065F46' }}>{customDomain}</div><div style={{ fontSize: 12, color: '#059669' }}>Verbunden · SSL gesichert</div></div></div>
          <button onClick={onDisconnect} disabled={busy} style={{ ...btn(false), height: 36 }}>Trennen</button>
        </div>
      )}
      {pending && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}><span style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid #FCD34D', borderTopColor: '#B45309', animation: 'spin 1s linear infinite' }} /><div><div style={{ fontFamily: HEAD, fontSize: 15, fontWeight: 700, color: '#92400E' }}>{customDomain}</div><div style={{ fontSize: 12, color: '#B45309' }}>Warte auf DNS — wird automatisch geprüft</div></div></div>
            <button onClick={onDisconnect} disabled={busy} style={{ ...btn(false), height: 36 }}>Abbrechen</button>
          </div>
          <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 10, padding: 13 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink, marginBottom: 8 }}>So aktivierst du deine Domain — setze diesen Eintrag bei deinem Domain-Anbieter:</div>
            <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 1fr', gap: 8, fontSize: 12.5, alignItems: 'center' }}>
              <span style={{ color: C.mut, fontWeight: 700 }}>TYP</span><span style={{ color: C.mut, fontWeight: 700 }}>NAME</span><span style={{ color: C.mut, fontWeight: 700 }}>WERT (ZIEL)</span>
              <code style={{ background: C.soft, color: C.indigoD, padding: '5px 8px', borderRadius: 6, fontWeight: 700 }}>A</code>
              <code style={{ background: '#F8FAFC', padding: '5px 8px', borderRadius: 6 }}>@</code>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><code style={{ background: '#F8FAFC', padding: '5px 8px', borderRadius: 6, flex: 1 }}>{serverIp}</code><button onClick={copyIp} style={{ ...btn(true), height: 30, padding: '0 11px', fontSize: 12 }}>{copied ? '✓' : 'Kopieren'}</button></div>
            </div>
            <div style={{ fontSize: 11.5, color: C.mut, marginTop: 9 }}>Nach dem Setzen kann es bis zu 1 Stunde dauern, bis die Domain weltweit aktiv ist. Du musst nichts weiter tun — wir prüfen automatisch und schalten SSL frei.</div>
          </div>
        </div>
      )}
      {status === 'error' && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '13px 16px', marginBottom: 16, fontSize: 13, color: '#B91C1C' }}>
          <b>{customDomain}</b> konnte nicht verbunden werden: {errorMsg || 'DNS zeigt nicht auf unseren Server.'} — bitte den A-Eintrag prüfen.
        </div>
      )}

      {/* AKTIONEN nur wenn nicht verbunden */}
      {!connected && (
        <>
          <div style={{ display: 'flex', gap: 6, background: '#F1F5F9', borderRadius: 11, padding: 4, marginBottom: 16, maxWidth: 360 }}>
            {([['connect', 'Domain verbinden'], ['buy', 'Domain kaufen']] as const).map(([k, l]) => (
              <button key={k} onClick={() => { setTab(k); setMsg(null); }} style={{ flex: 1, height: 36, borderRadius: 8, border: 'none', background: tab === k ? '#fff' : 'transparent', color: tab === k ? C.indigoD : C.sub, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', boxShadow: tab === k ? '0 1px 3px rgba(0,0,0,.08)' : 'none' }}>{l}</button>
            ))}
          </div>

          {tab === 'connect' && (
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 7, display: 'block' }}>Domain, die du bereits besitzt</label>
              <div style={{ display: 'flex', gap: 9 }}>
                <input value={domain} onChange={(e) => setDomain(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onConnect()} placeholder="z. B. mein-restaurant.de" style={inp} />
                <button onClick={onConnect} disabled={busy || domain.trim().length < 3} style={{ ...btn(true), opacity: busy || domain.trim().length < 3 ? .6 : 1 }}>{busy ? '…' : 'Verbinden'}</button>
              </div>
              <p style={{ fontSize: 12, color: C.mut, marginTop: 8 }}>Du gibst deine Domain ein, wir zeigen dir den einen DNS-Eintrag — danach läuft alles automatisch (inkl. SSL).</p>
            </div>
          )}

          {tab === 'buy' && (
            <div>
              {!registrarConfigured ? (
                <div style={{ background: '#F8FAFC', border: `1px dashed ${C.line}`, borderRadius: 12, padding: '18px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>🛒</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>Domain-Kauf wird gerade eingerichtet</div>
                  <div style={{ fontSize: 12.5, color: C.sub, marginTop: 4 }}>Bald kannst du hier Domains direkt suchen & kaufen. Bis dahin: oben „Domain verbinden", wenn du schon eine hast.</div>
                </div>
              ) : (
                <>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 7, display: 'block' }}>Wunsch-Domain suchen</label>
                  <div style={{ display: 'flex', gap: 9, marginBottom: 14 }}>
                    <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onSearch()} placeholder="z. B. franky-pasta" style={inp} />
                    <button onClick={onSearch} disabled={searching} style={btn(true)}>{searching ? 'Sucht…' : 'Verfügbarkeit prüfen'}</button>
                  </div>
                  {results && results.length === 0 && <div style={{ fontSize: 13, color: C.mut }}>Keine Ergebnisse.</div>}
                  {results && results.map((d) => (
                    <div key={d.domain} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 11, border: `1px solid ${C.line}`, marginBottom: 8, opacity: d.available ? 1 : .55 }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: d.available ? '#10B981' : '#CBD5E1', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontFamily: HEAD, fontSize: 14.5, fontWeight: 700, color: C.ink }}>{d.domain}</div><div style={{ fontSize: 12, color: d.available ? '#059669' : C.mut }}>{d.available ? `verfügbar · ${eur(d.priceCents)}/Jahr${d.premium ? ' · Premium' : ''}` : 'bereits vergeben'}</div></div>
                      {d.available && <button onClick={() => onBuy(d)} disabled={busy} style={{ ...btn(true), height: 38 }}>Kaufen & verbinden</button>}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </>
      )}

      {msg && <div style={{ marginTop: 14, borderRadius: 10, padding: '9px 13px', fontSize: 13, fontWeight: 600, background: msg.t === 'err' ? '#FEF2F2' : '#ECFDF5', border: `1px solid ${msg.t === 'err' ? '#FECACA' : '#A7F3D0'}`, color: msg.t === 'err' ? '#DC2626' : '#047857' }}>{msg.x}</div>}
    </div>
  );
}
