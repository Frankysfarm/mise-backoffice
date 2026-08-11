import { headers } from 'next/headers';

export async function operationsBasePath(legacyPath: string, neoPath: string): Promise<string> {
  const pathname = (await headers()).get('x-pathname') ?? legacyPath;
  return pathname === neoPath || pathname.startsWith(`${neoPath}/`) ? neoPath : legacyPath;
}
