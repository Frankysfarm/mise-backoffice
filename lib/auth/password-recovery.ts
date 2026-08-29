export const PASSWORD_RESET_PATH = '/auth/reset-password';

export function buildPasswordRecoveryRedirect(origin: string): string {
  const callback = new URL('/auth/callback', origin);
  callback.searchParams.set('next', PASSWORD_RESET_PATH);
  return callback.toString();
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
