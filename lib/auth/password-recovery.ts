export const PASSWORD_RESET_PATH = '/auth/reset-password';

type HeaderReader = Pick<Headers, 'get'>;

function isAllowedAuthHost(host: string): boolean {
  const normalized = host.toLowerCase();
  return normalized === 'mise-gastro.de'
    || normalized === 'www.mise-gastro.de'
    || normalized.startsWith('localhost:')
    || normalized.startsWith('127.0.0.1:');
}

export function buildPasswordRecoveryRedirect(origin: string): string {
  const callback = new URL('/auth/callback', origin);
  callback.searchParams.set('next', PASSWORD_RESET_PATH);
  return callback.toString();
}

export function resolvePasswordRecoveryOrigin(requestUrl: string, headers: HeaderReader): string {
  const forwardedHost = headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const requestHost = headers.get('host')?.split(',')[0]?.trim();
  const candidateHost = forwardedHost || requestHost || '';

  if (isAllowedAuthHost(candidateHost)) {
    const forwardedProto = headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
    const local = candidateHost.startsWith('localhost:') || candidateHost.startsWith('127.0.0.1:');
    const protocol = local ? 'http' : forwardedProto === 'http' || forwardedProto === 'https' ? forwardedProto : 'https';
    return `${protocol}://${candidateHost}`;
  }

  const parsedRequest = new URL(requestUrl);
  return isAllowedAuthHost(parsedRequest.host) ? parsedRequest.origin : 'https://mise-gastro.de';
}

export function sanitizeAuthNext(value: string | null | undefined, fallback = '/'): string {
  if (!value) return fallback;
  try {
    const base = new URL('https://mise.internal');
    const candidate = new URL(value, base);
    if (candidate.origin !== base.origin) return fallback;
    return `${candidate.pathname}${candidate.search}${candidate.hash}`;
  } catch {
    return fallback;
  }
}
