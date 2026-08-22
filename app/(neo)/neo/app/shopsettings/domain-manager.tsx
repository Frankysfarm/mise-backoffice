'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { connectDomain, disconnectDomain, checkDomain, buyDomain } from './domain-actions';

type Status = 'none' | 'pending' | 'active' | 'error';
type CheckRes = { domain: string; available: boolean; priceCents: number | null; premium?: boolean };
const eur = (c: number | null) => c == null ? '–' : (c / 100).toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €';

const C = { ink: '#0F172A', sub: '#64748B', mut: '#94A3B8', line: '#E2E8F0', indigo: '#4F46E5', indigoD: '#4338CA', soft: '#EEF2FF' };
const HEAD = "'Space Grotesk', system-ui, sans-serif";
const inp: React.CSSProperties = { flex: 1, minWidth: 0, height: 46, border: `1.5px solid ${C.line}`, borderRadius: 11, padding: '0 14px', fontSize: 15, color: C.ink, outline: 'none' };
const btn = (primary = true): React.CSSProperties => ({ height: 46, padding: '0 18px', borderRadius: 11, border: primary ? 'none' : `1.5px solid ${C.line}`, background: primary ? C.indigo : '#fff', color: primary ? '#fff' : '#475569', fontWeight: 700, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 });

// Eine DNS-Zeile als label/value/copy — stapelt sauber auf schmalen Screens
function DnsRow({ typ, name, value, ip, onCopy, copied }: { typ: string; name: string; value: string; ip?: boolean; onCopy?: () => void; copied?: boolean }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: `1px solid #F1F5F9` }}>
      <code style={{ background: C.soft, color: C.indigoD, padding: '5px 9px', borderRadius: 6, fontWeight: 700, fontSize: 12.5 }}>{typ}</code>
      <span style={{ fontSize: 12, color: C.mut }}>Name</span><code style={{ background: '#F8FAFC', color: C.ink, padding: '5px 9px', borderRadius: 6, fontSize: 12.5 }}>{name}</code>
      <span style={{ fontSize: 12, color: C.mut }}>Ziel</span>
      <code style={{ background: '#F8FAFC', color: C.ink, padding: '5px 9px', borderRadius: 6, fontSize: 12.5, flex: ip ? 1 : 'none', minWidth: 90 }}>{value}</code>
      {ip && onCopy && <button onClick={onCopy} style={{ ...btn(true), height: 36, padding: '0 13px', fontSize: 12.5 }}>{copied ? '✓ kopiert' : 'Kopieren'}</button>}
    </div>
  );
}

export function DomainManager({ subdomain, customDomain, status, errorMsg, serverIp, registrarConfigured }: {
  subdomain: string; customDomain: string | null; status: Status; errorMsg: string | null; serverIp: string; registrarConfigured: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<'connect' | 'buy'>('connect');
  const [domain, setDomain] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: 'err' | 'ok'; x: string } | null>(null);
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<CheckRes[] | null>(null);
  const [copied, setCopied] = useState(false);

  const connected = status === 'active';
  const pending = status === 'pending';

  async function onConnect() {
    if (busy || domain.trim().length < 3) return; setBusy(true); setMsg(null);
    const r = await connectDomain(domain);
    setBusy(false);
    if (!r.ok) { setMsg({ t: 'err', x: r.error || 'Fehler' }); return; }
    setDomain(''); setMsg({ t: 'ok', x: 'Verbunden! Folge jetzt dem DNS-Schritt unten — danach läuft alles automatisch.' });
    router.refresh();
  }
  async function onDisconnect() {
    if (!confirm('Domain wirklich trennen? Dein Shop ist dann nur noch über die MISE-Subdomain erreichbar.')) return;
    setBusy(true); await disconnectDomain(); setBusy(false); setMsg(null); router.refresh();
  }
  async function onSearch() {
    if (!q.trim() || searching) return; setSearching(true); setResults(null); setMsg(null);
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

  const lbl: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 7, display: 'block' };

  return (
    <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 16, padding: 24, maxWidth: '100%', overflowX: 'hidden' }}>
      <h3 style={{ fontFamily: HEAD, fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 3 }}>Eigene Domain</h3>
      <p style={{ fontSize: 13.5, color: C.sub, marginBottom: 16 }}>Dein Shop läuft immer auf <b>{subdomain}</b>. Verbinde oder kaufe eine eigene Domain für einen professionellen Auftritt.</p>

      {connected && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: '#F0FDF4', border: '1px solid #A7F3D0', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981', flexShrink: 0 }} /><div style={{ minWidth: 0 }}><div style={{ fontFamily: HEAD, fontSize: 15, fontWeight: 700, color: '#065F46', overflow: 'hidden', textOverflow: 'ellipsis' }}>{customDomain}</div><div style={{ fontSize: 12, color: '#059669' }}>Verbunden · SSL gesichert</div></div></div>
          <button onClick={onDisconnect} disabled={busy} style={btn(false)}>Trennen</button>
        </div>
      )}
      {pending && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}><span style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid #FCD34D', borderTopColor: '#B45309', animation: 'spin 1s linear infinite', flexShrink: 0 }} /><div style={{ minWidth: 0 }}><div style={{ fontFamily: HEAD, fontSize: 15, fontWeight: 700, color: '#92400E', overflow: 'hidden', textOverflow: 'ellipsis' }}>{customDomain}</div><div style={{ fontSize: 12, color: '#B45309' }}>Warte auf DNS — wird automatisch geprüft</div></div></div>
            <div style={{ display: 'flex', gap: 8 }}><button onClick={() => router.refresh()} style={{ ...btn(false), height: 40 }}>Status prüfen</button><button onClick={onDisconnect} disabled={busy} style={{ ...btn(false), height: 40 }}>Abbrechen</button></div>
          </div>
          <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink, marginBottom: 4 }}>So aktivierst du deine Domain</div>
            <div style={{ fontSize: 12, color: C.mut, marginBottom: 8 }}>Setze bei deinem Domain-Anbieter (z. B. IONOS, Strato, GoDaddy) diesen Eintrag:</div>
            <DnsRow typ="A" name="@" value={serverIp} ip onCopy={copyIp} copied={copied} />
            <DnsRow typ="CNAME" name="www" value={customDomain ?? 'deine-domain'} />
            <div style={{ fontSize: 11.5, color: C.mut, marginTop: 10 }}>„@" = die Domain selbst (manche Anbieter erwarten hier ein leeres Feld). Nach dem Setzen kann es bis zu 1 Stunde dauern — wir prüfen automatisch und schalten SSL frei, du musst nichts weiter tun.</div>
          </div>
        </div>
      )}
      {status === 'error' && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '13px 16px', marginBottom: 16, fontSize: 13, color: '#B91C1C' }}>
          <b>{customDomain}</b> konnte nicht verbunden werden: {errorMsg || 'DNS zeigt nicht auf unseren Server.'} — bitte den A-Eintrag prüfen. <button onClick={() => router.refresh()} style={{ ...btn(false), height: 32, marginLeft: 6 }}>Erneut prüfen</button>
        </div>
      )}

      {!connected && (
        <>
          <div style={{ display: 'flex', gap: 6, background: '#F1F5F9', borderRadius: 11, padding: 4, marginBottom: 16, maxWidth: 360 }}>
            {([['connect', 'Domain verbinden'], ['buy', 'Domain kaufen']] as const).map(([k, l]) => (
              <button key={k} onClick={() => { setTab(k); setMsg(null); }} style={{ flex: 1, height: 38, borderRadius: 8, border: 'none', background: tab === k ? '#fff' : 'transparent', color: tab === k ? C.indigoD : C.sub, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', boxShadow: tab === k ? '0 1px 3px rgba(0,0,0,.08)' : 'none' }}>{l}</button>
            ))}
          </div>

          {tab === 'connect' && (
            <div>
              <label htmlFor="dom-connect" style={lbl}>Domain, die du bereits besitzt</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
                <input id="dom-connect" value={domain} onChange={(e) => setDomain(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onConnect()} placeholder="z. B. mein-restaurant.de" style={inp} />
                <button onClick={onConnect} disabled={busy || domain.trim().length < 3} style={{ ...btn(true), opacity: busy || domain.trim().length < 3 ? .55 : 1 }}>{busy ? 'Verbinde…' : 'Verbinden'}</button>
              </div>
              <p style={{ fontSize: 12, color: C.mut, marginTop: 8 }}>Du gibst deine Domain ein, wir zeigen dir den einen DNS-Eintrag — danach läuft alles automatisch (inkl. SSL).</p>
            </div>
          )}

          {tab === 'buy' && (
            <div>
              {!registrarConfigured ? (
                <div style={{ background: '#F8FAFC', border: `1px dashed ${C.line}`, borderRadius: 12, padding: 18, textAlign: 'center' }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>🛒</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>Domain-Kauf wird gerade eingerichtet</div>
                  <div style={{ fontSize: 12.5, color: C.sub, marginTop: 4 }}>Bald kannst du hier Domains direkt suchen & kaufen. Bis dahin: oben „Domain verbinden", wenn du schon eine hast.</div>
                </div>
              ) : (
                <>
                  <label htmlFor="dom-search" style={lbl}>Wunsch-Domain suchen</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginBottom: 14 }}>
                    <input id="dom-search" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onSearch()} placeholder="z. B. franky-pasta" style={inp} />
                    <button onClick={onSearch} disabled={searching || !q.trim()} style={{ ...btn(true), opacity: searching || !q.trim() ? .55 : 1 }}>{searching ? 'Sucht…' : 'Verfügbarkeit prüfen'}</button>
                  </div>
                  {results && results.length === 0 && <div style={{ fontSize: 13, color: C.mut }}>Keine Ergebnisse.</div>}
                  {results && results.map((d) => (
                    <div key={d.domain} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 11, border: `1px solid ${C.line}`, marginBottom: 8, opacity: d.available ? 1 : .55 }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: d.available ? '#10B981' : '#CBD5E1', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 120 }}><div style={{ fontFamily: HEAD, fontSize: 14.5, fontWeight: 700, color: C.ink }}>{d.domain}</div><div style={{ fontSize: 12, color: d.available ? '#059669' : C.mut }}>{d.available ? `verfügbar · ${eur(d.priceCents)}/Jahr${d.premium ? ' · Premium' : ''}` : 'bereits vergeben'}</div></div>
                      {d.available && <button onClick={() => onBuy(d)} disabled={busy} style={{ ...btn(true), height: 40 }}>{busy ? 'Kauft…' : 'Kaufen & verbinden'}</button>}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </>
      )}

      {msg && <div style={{ marginTop: 14, borderRadius: 10, padding: '10px 13px', fontSize: 13, fontWeight: 600, background: msg.t === 'err' ? '#FEF2F2' : '#ECFDF5', border: `1px solid ${msg.t === 'err' ? '#FECACA' : '#A7F3D0'}`, color: msg.t === 'err' ? '#DC2626' : '#047857' }}>{msg.x}</div>}
    </div>
  );
}
