/** Stable, human-readable library sections and immutable manga/chapter links. */
export const CATALOGUE_SECTIONS = ['home', 'reading', 'trying', 'offline', 'finished', 'to-read', 'library', 'analytics'] as const;
export type CatalogueSection = typeof CATALOGUE_SECTIONS[number];
export type AppRoute =
  | { kind: CatalogueSection }
  | { kind: 'details'; mangaId: string }
  | { kind: 'reader'; mangaId: string; chapterId: string; pageIndex: number }
  | { kind: 'not-found' };

const validId = /^[A-Za-z0-9_-]{1,128}$/;
function prefixFor(basePath: string) {
  return ('/' + basePath.split('/').filter(Boolean).join('/')).replace(/^\/$/, '');
}
function readId(encoded: string): string | null {
  try {
    const id = decodeURIComponent(encoded);
    return validId.test(id) ? id : null;
  } catch { return null; }
}

export function isCatalogueSection(kind: AppRoute['kind']): kind is CatalogueSection {
  return (CATALOGUE_SECTIONS as readonly string[]).includes(kind);
}

export function parseAppRoute(pathname: string, search = '', basePath = '/'): AppRoute {
  const prefix = prefixFor(basePath);
  if (prefix && pathname !== prefix && !pathname.startsWith(prefix + '/')) return { kind: 'not-found' };
  const relative = prefix ? pathname.slice(prefix.length) : pathname;
  const parts = relative.split('/').filter(Boolean);
  if (parts.length === 0) return { kind: 'home' };
  if (parts.length === 1 && CATALOGUE_SECTIONS.includes(parts[0] as CatalogueSection) && parts[0] !== 'home')
    return { kind: parts[0] as CatalogueSection };
  if (parts[0] !== 'manga') return { kind: 'not-found' };
  if (parts.length === 2) {
    const mangaId = readId(parts[1]!);
    return mangaId ? { kind: 'details', mangaId } : { kind: 'not-found' };
  }
  if (parts.length === 4 && parts[2] === 'chapters') {
    const mangaId = readId(parts[1]!);
    const chapterId = readId(parts[3]!);
    const params = new URLSearchParams(search);
    const rawPage = params.get('page') ?? '1';
    const page = Number(rawPage);
    if (mangaId && chapterId && /^\d+$/.test(rawPage) && Number.isSafeInteger(page) && page >= 1) {
      return { kind: 'reader', mangaId, chapterId, pageIndex: page - 1 };
    }
  }
  return { kind: 'not-found' };
}

export function routeHref(route: Exclude<AppRoute, { kind: 'not-found' }>, basePath = '/'): string {
  const base = prefixFor(basePath);
  if (route.kind === 'home') return base + '/';
  if (route.kind !== 'details' && route.kind !== 'reader') return base + '/' + route.kind;
  if (route.kind === 'details') return base + '/manga/' + encodeURIComponent(route.mangaId);
  return base + '/manga/' + encodeURIComponent(route.mangaId) +
    '/chapters/' + encodeURIComponent(route.chapterId) + '?page=' + (route.pageIndex + 1);
}
