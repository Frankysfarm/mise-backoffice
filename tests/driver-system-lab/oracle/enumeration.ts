export function nonEmptySubsets<T>(values: readonly T[], maxSize: number): T[][] {
  const result: T[][] = [];
  const visit = (offset: number, selected: T[]) => {
    if (selected.length > 0) result.push([...selected]);
    if (selected.length === maxSize) return;
    for (let index = offset; index < values.length; index += 1) {
      visit(index + 1, [...selected, values[index]]);
    }
  };
  visit(0, []);
  return result;
}

export function permutations<T>(values: readonly T[]): T[][] {
  if (values.length < 2) return [[...values]];
  const result: T[][] = [];
  values.forEach((value, index) => {
    const rest = [...values.slice(0, index), ...values.slice(index + 1)];
    for (const suffix of permutations(rest)) result.push([value, ...suffix]);
  });
  return result;
}
