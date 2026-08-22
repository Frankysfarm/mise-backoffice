import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const client = fs.readFileSync(
  path.join(process.cwd(), 'app/(admin)/lieferdienst/client.tsx'),
  'utf8',
);

describe('Lieferzentrale hydration contract', () => {
  it('uses a deterministic first render and switches to Berlin time after mount', () => {
    expect(client).toContain("const HYDRATION_INSTANT = new Date('2000-01-01T00:00:00.000Z')");
    expect(client).toContain('useState(HYDRATION_INSTANT)');
    expect(client).toContain('setCurrentTime(mountedAt)');
    expect(client).toContain('setSchichtStart(mountedAt)');
    expect(client).toContain("timeZone: 'Europe/Berlin'");
    expect(client).not.toContain('useState(new Date())');
  });
});
