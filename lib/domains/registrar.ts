/**
 * Registrar-Adapter (registrar-agnostisch).
 * Aktuelle Implementierung: INWX DomRobot (JSON-RPC). Weitere Anbieter (Namecheap/Cloudflare)
 * können dieselbe Schnittstelle implementieren, ohne UI/Actions zu ändern.
 *
 * Aktivierung: ENV INWX_USER + INWX_PASSWORD (+ optional INWX_CONTACT_ID, INWX_OTE=1 für Test-Umgebung).
 * Solange nicht gesetzt → isConfigured()=false → UI zeigt „Kauf wird aktiviert, sobald Registrar verbunden".
 */

export const SERVER_IP = '178.104.106.72';

export interface DomainCheckResult {
  domain: string;
  available: boolean;
  priceCents: number | null; // Jahrespreis brutto in Cent
  premium?: boolean;
}
export interface RegisterResult { ok: boolean; error?: string; }

export interface RegistrarAdapter {
  name: string;
  isConfigured(): boolean;
  check(domains: string[]): Promise<DomainCheckResult[]>;
  register(domain: string, years: number): Promise<RegisterResult>;
}

// ───────────────────────── INWX DomRobot ─────────────────────────
const INWX_ENDPOINT = process.env.INWX_OTE ? 'https://api.ote.domrobot.com/jsonrpc/' : 'https://api.domrobot.com/jsonrpc/';

async function inwxCall(method: string, params: Record<string, unknown>, cookie?: string): Promise<{ data: any; cookie?: string }> {
  const res = await fetch(INWX_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify({ method, params }),
  });
  const setCookie = res.headers.get('set-cookie') ?? undefined;
  const json = await res.json();
  if (json?.code !== 1000 && json?.code !== 1001) {
    throw new Error(`INWX ${method}: ${json?.msg ?? 'Fehler'} (${json?.code})`);
  }
  return { data: json.resData, cookie: setCookie };
}

async function inwxLogin(): Promise<string> {
  const { cookie } = await inwxCall('account.login', { user: process.env.INWX_USER, pass: process.env.INWX_PASSWORD });
  if (!cookie) throw new Error('INWX-Login fehlgeschlagen (kein Session-Cookie)');
  return cookie.split(';')[0];
}

const inwx: RegistrarAdapter = {
  name: 'inwx',
  isConfigured: () => !!(process.env.INWX_USER && process.env.INWX_PASSWORD),
  async check(domains) {
    const cookie = await inwxLogin();
    const { data } = await inwxCall('domain.check', { domain: domains, wide: 2 }, cookie);
    const list = (data?.domain ?? []) as any[];
    return list.map((d) => ({
      domain: d.domain,
      available: d.avail === 1,
      priceCents: d.price != null ? Math.round(Number(d.price) * 100) : null,
      premium: !!d.premium,
    }));
  },
  async register(domain, years) {
    try {
      const cookie = await inwxLogin();
      const contact = process.env.INWX_CONTACT_ID;
      if (!contact) return { ok: false, error: 'INWX_CONTACT_ID (Registrant-Handle) fehlt in der Config.' };
      await inwxCall('domain.create', {
        domain, period: `${years}Y`,
        registrant: Number(contact), admin: Number(contact), tech: Number(contact), billing: Number(contact),
        ns: ['ns.inwx.de', 'ns2.inwx.de'], // INWX-DNS; A-Record auf SERVER_IP wird separat per nameserver.createRecord gesetzt
      }, cookie);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Registrierung fehlgeschlagen' };
    }
  },
};

// Null-Adapter wenn nichts konfiguriert ist
const nullAdapter: RegistrarAdapter = {
  name: 'none',
  isConfigured: () => false,
  async check() { return []; },
  async register() { return { ok: false, error: 'Kein Registrar konfiguriert.' }; },
};

export function getRegistrar(): RegistrarAdapter {
  if (inwx.isConfigured()) return inwx;
  return nullAdapter;
}
