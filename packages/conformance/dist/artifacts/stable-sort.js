export function stableSort(items, key) {
    return items
        .map((item, index) => ({ item, index }))
        .sort((left, right) => key(left.item).localeCompare(key(right.item)) || left.index - right.index)
        .map(({ item }) => item);
}
//# sourceMappingURL=stable-sort.js.map