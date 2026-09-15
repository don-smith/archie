export function stableSort<T>(items: readonly T[], key: (item: T) => string): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => key(left.item).localeCompare(key(right.item)) || left.index - right.index)
    .map(({ item }) => item);
}
