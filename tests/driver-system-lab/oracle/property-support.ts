export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

export function minimizeArrayFailure<T>(values: readonly T[], stillFails: (candidate: T[]) => boolean): T[] {
  let current = [...values];
  for (let width = Math.max(1, Math.floor(current.length / 2)); width >= 1; width = Math.floor(width / 2)) {
    let changed = true;
    while (changed) {
      changed = false;
      for (let offset = 0; offset + width <= current.length; offset += 1) {
        const candidate = [...current.slice(0, offset), ...current.slice(offset + width)];
        if (candidate.length && stillFails(candidate)) { current = candidate; changed = true; break; }
      }
    }
  }
  return current;
}
