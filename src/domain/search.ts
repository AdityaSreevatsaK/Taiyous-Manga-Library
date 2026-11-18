/** Pure local search; never uploads personal metadata or performs network I/O. */
export function searchCatalogue<T extends { title: string; aliases: string[] }>(
  items: readonly T[], term: string,
): T[] {
  const query = term.normalize('NFKC').trim().toLocaleLowerCase();
  if (!query) return [...items];
  return items.filter(item => [item.title, ...item.aliases].some(value =>
    value.normalize('NFKC').toLocaleLowerCase().includes(query)));
}
