import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as authCallback } from '@/app/auth/callback/route';
import {
  buildPasswordRecoveryRedirect,
  sanitizeAuthNext,
} from '@/lib/auth/password-recovery';

describe('password recovery', () => {
  it('routes recovery emails through the PKCE callback', () => {
    expect(buildPasswordRecoveryRedirect('https://mise-gastro.de')).toBe(
      'https://mise-gastro.de/auth/callback?next=%2Fauth%2Freset-password',
    );
  });

  it('only accepts same-origin relative continuation paths', () => {
    expect(sanitizeAuthNext('/auth/reset-password?from=mail')).toBe('/auth/reset-password?from=mail');
    expect(sanitizeAuthNext('https://evil.example/phish')).toBe('/');
    expect(sanitizeAuthNext('//evil.example/phish')).toBe('/');
    expect(sanitizeAuthNext('\\\\evil.example/phish')).toBe('/');
  });

  it('never lets the callback become an open redirect', async () => {
    const response = await authCallback(new NextRequest(
      'https://mise-gastro.de/auth/callback?next=https%3A%2F%2Fevil.example%2Fphish',
    ));
    expect(response.headers.get('location')).toBe('https://mise-gastro.de/');
  });
});
