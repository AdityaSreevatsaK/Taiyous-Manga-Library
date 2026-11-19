import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { entries as realEntries } from './data/catalogue';
import { demoEntries, demoManifests, fixtureStatement } from './data/fixtures';
import { verifyOfflineChapter } from './data/offlineChapters';
import { OfflineChapterControl } from './components/OfflineChapterControl';
import { LocalBackupControl } from './components/LocalBackupControl';
import { VerticalReader } from './components/VerticalReader';
import { CATALOGUE_SECTIONS, parseAppRoute, routeHref, type AppRoute, type CatalogueSection } from './domain/routes';
import { loadShelves, saveShelf, type PersonalShelf, type ShelfSelection } from './domain/personalShelves';
import { addPersonalTag, loadAnnotations, saveAnnotation, type AnnotationPatch,
  type PersonalAnnotation } from './domain/personalAnnotations';
import { defaultReaderPreferences, laterProgress, loadAllProgress, loadPreferences, loadProgress,
  nextProgressTimestamp, savePreferences, saveProgress, type ReaderPreferences } from './domain/localReaderStorage';
import { filterCatalogue, type SortMode } from './domain/filters';
import { orderedChapters, restoreProgress, stepChapter, type ReaderLocation } from './domain/reader';
import type { ChapterManifest, MangaEntry, MangaProgress, PublicationStatus } from './domain/types';
import './styles.css';

type Screen = { kind: 'catalogue'; section: CatalogueSection } | { kind: 'details' | 'reader'; id: string } | { kind: 'not-found' };
function currentBrowserRoute(): AppRoute {
  return typeof window === 'undefined' ? { kind: 'home' } :
    parseAppRoute(window.location.pathname, window.location.search, import.meta.env.BASE_URL);
}

export default function App({ initialDemo = true }: { initialDemo?: boolean } = {}) {
  const initialRoute = useMemo(currentBrowserRoute, []);
  const [demo, setDemo] = useState(initialDemo);
  const [screen, setScreen] = useState<Screen>(() => {
    if (initialRoute.kind !== 'details' && initialRoute.kind !== 'reader' && initialRoute.kind !== 'not-found') {
      return { kind: 'catalogue', section: initialRoute.kind };
    }
    if (initialRoute.kind === 'not-found') return { kind: 'not-found' };
    const source = initialDemo ? demoEntries : realEntries;
    const item = source.find(candidate => candidate.id === initialRoute.mangaId);
    if (!item) return { kind: 'not-found' };
    if (initialRoute.kind === 'details') return { kind: 'details', id: item.id };
    const verified = initialDemo ? demoManifests.get(initialRoute.chapterId) : undefined;
    return item.chapters.some(chapter => chapter.id === initialRoute.chapterId) &&
      verified && initialRoute.pageIndex < verified.pages.length ?
      { kind: 'reader', id: item.id } : { kind: 'not-found' };
  });
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<PublicationStatus | 'all'>('all');
  const [tag, setTag] = useState('');
  const [collection, setCollection] = useState('');
  const [sort, setSort] = useState<SortMode>('title');
  const [chapterQuery, setChapterQuery] = useState('');
  const [compactNav, setCompactNav] = useState(() => typeof window !== 'undefined' &&
    window.matchMedia?.('(max-width: 740px)').matches || false);
  const [personalShelves, setPersonalShelves] = useState<Record<string, PersonalShelf>>(() =>
    loadShelves(initialDemo ? demoEntries : realEntries).shelves);
  const [annotations, setAnnotations] = useState<Record<string, PersonalAnnotation>>(() =>
    loadAnnotations(initialDemo ? demoEntries : realEntries).annotations);
  const [noteDraft, setNoteDraft] = useState('');
  const [tagDraft, setTagDraft] = useState('');
  const [confirmRemoveTag, setConfirmRemoveTag] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<ReaderPreferences>(() => {
    const read = loadPreferences();
    return read.status === 'ok' ? read.value : defaultReaderPreferences;
  });
  const [immersive, setImmersive] = useState(false);
  const [jumpToken, setJumpToken] = useState(0);
  const [location, setLocation] = useState<ReaderLocation | null>(() =>
    initialRoute.kind === 'reader' ?
      { chapterId: initialRoute.chapterId, pageIndex: initialRoute.pageIndex } : null);
  const [progress, setProgress] = useState<Record<string, MangaProgress>>(() =>
    loadAllProgress(initialDemo ? demoEntries : realEntries, initialDemo ? demoManifests : new Map()).progress);
  const [shelfNotice, setShelfNotice] = useState('');
  const [storageNotice, setStorageNotice] = useState(() => {
    const snapshot = loadAllProgress(initialDemo ? demoEntries : realEntries, initialDemo ? demoManifests : new Map());
    return snapshot.invalid > 0 ? 'Some saved reading records could not be verified. They were preserved for recovery.' : '';
  });
  const [notice, setNotice] = useState('');
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  const [inventoryRevision, setInventoryRevision] = useState(0);
  const [offlineChapterIds, setOfflineChapterIds] = useState<ReadonlySet<string>>(() => new Set());
  const readerRef = useRef<HTMLElement | null>(null);
  const catalogue = demo ? demoEntries : realEntries;
  const manifests: ReadonlyMap<string, ChapterManifest> = demo ? demoManifests : new Map<string, ChapterManifest>();
  const entry = screen.kind === 'reader' || screen.kind === 'details' ? catalogue.find(item => item.id === screen.id) : undefined;
  const manifest = location ? manifests.get(location.chapterId) : undefined;
  const chapters = entry ? orderedChapters(entry) : [];
  const activeChapter = chapters.find(chapter => chapter.id === location?.chapterId);
  const allTags = [...new Set(catalogue.flatMap(item =>
    [...item.tags, ...(annotations[item.id]?.tags ?? [])]))].sort((a,b)=>a.localeCompare(b));
  const allCollections = [...new Set(catalogue.flatMap(item => item.collections ?? []))].sort();
  const labels: Record<CatalogueSection, string> = {
    home: 'Home', reading: 'Currently Reading', trying: 'Trying Out',
    offline: 'Available Offline', finished: 'Finished', 'to-read': 'To Be Read',
    library: 'All Manga', analytics: 'Analytics',
  };
  const onShelf = (item: MangaEntry, section: CatalogueSection) => {
    if (section === 'reading') return !!progress[item.id] && personalShelves[item.id] !== 'finished' &&
      personalShelves[item.id] !== 'trying' && personalShelves[item.id] !== 'to-read';
    if (section === 'trying') return personalShelves[item.id] === 'trying';
    if (section === 'finished') return personalShelves[item.id] === 'finished';
    if (section === 'to-read') return personalShelves[item.id] === 'to-read';
    if (section === 'offline') return item.chapters.some(chapter => offlineChapterIds.has(chapter.id));
    return true;
  };
  const counts: Record<CatalogueSection, number> = Object.fromEntries(CATALOGUE_SECTIONS.map(section =>
    [section, section === 'offline' ? offlineChapterIds.size :
      section === 'analytics' || section === 'home' ? 0 : catalogue.filter(item => onShelf(item, section)).length],
  )) as Record<CatalogueSection, number>;
  const selectedSection = screen.kind === 'catalogue' ? screen.section : null;
  const currentNav = compactNav ? CATALOGUE_SECTIONS.filter(section =>
    ['reading','trying','offline'].includes(section)) : CATALOGUE_SECTIONS;
  const moreNav = compactNav ? CATALOGUE_SECTIONS.filter(section => !currentNav.includes(section)) : [];

  const filtered = useMemo(() => filterCatalogue(catalogue, query, status, '', collection, sort)
    .filter(item => !tag || [...item.tags,...(annotations[item.id]?.tags ?? [])]
      .some(value => value.toLocaleLowerCase('en') === tag.toLocaleLowerCase('en'))),
    [catalogue, query, status, tag, collection, sort, annotations],
  );
  const offlineSeries = catalogue.filter(item => item.chapters.some(chapter => offlineChapterIds.has(chapter.id)));
  const displayed = screen.kind === 'catalogue' ? filtered.filter(item => onShelf(item, screen.section)) : filtered;
  const continueReading = catalogue
    .map(item => ({ item, saved: progress[item.id], resume: restoreProgress(item, manifests, progress[item.id]) }))
    .filter((value): value is { item: MangaEntry; saved: MangaProgress; resume: ReaderLocation } =>
      value.saved !== undefined && value.resume !== null)
    .sort((a, b) => Date.parse(b.saved.updatedAt) - Date.parse(a.saved.updatedAt))
    .slice(0, 4);

  useEffect(() => {
    const media = window.matchMedia?.('(max-width: 740px)');
    if (!media) return;
    const update = () => setCompactNav(media.matches);
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const dark = ['charcoal', 'midnight', 'plum'].includes(preferences.theme);
    const icon = document.querySelector<HTMLLinkElement>('#taiyou-favicon');
    if (icon) icon.href = import.meta.env.BASE_URL + 'branding/favicon-' + (dark ? 'dark' : 'light') + '.png';
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) meta.content = dark ? '#171b25' : preferences.theme === 'ocean' ? '#e3f1fa' : '#ede1cd';
  }, [preferences.theme]);
  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    void navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js', {
      scope: import.meta.env.BASE_URL,
      updateViaCache: 'none',
    }).catch(() => setStorageNotice('The offline app shell could not be installed on this browser.'));
  }, []);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ids: string[] = [];
      for (const item of catalogue) for (const chapter of item.chapters) {
        const verified = manifests.get(chapter.id);
        if (verified && (await verifyOfflineChapter(verified)).status === 'complete') ids.push(chapter.id);
      }
      if (!cancelled) setOfflineChapterIds(new Set(ids));
    })();
    return () => { cancelled = true; };
  // Only reload offline metadata when the selected source or inventory changes.
  }, [demo, inventoryRevision]);

  useEffect(() => {
    setNoteDraft(entry ? annotations[entry.id]?.notes ?? '' : '');
    setTagDraft('');
    setConfirmRemoveTag(null);
  // Changing a rating must not erase unsaved notes; only change drafts when the manga changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.id]);
  useEffect(() => {
    const onStorageAnnotations = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith('taiyou-manga:personal-annotation:v1:')) {
        setAnnotations(loadAnnotations(catalogue).annotations);
      }
    };
    window.addEventListener('storage', onStorageAnnotations);
    return () => window.removeEventListener('storage', onStorageAnnotations);
  }, [catalogue]);
  useEffect(() => {
    const onStorageShelf = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith('taiyou-manga:personal-shelf:v1:'))
        setPersonalShelves(loadShelves(catalogue).shelves);
    };
    window.addEventListener('storage', onStorageShelf);
    return () => window.removeEventListener('storage', onStorageShelf);
  }, [catalogue]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || !event.key.startsWith('taiyou-manga:progress:v1:')) return;
      const stored = loadAllProgress(catalogue, manifests);
      setProgress(previous => {
        const merged = { ...previous };
        for (const [id, record] of Object.entries(stored.progress)) {
          const newer = laterProgress(merged[id], record);
          if (newer) merged[id] = newer;
        }
        return merged;
      });
      if (stored.invalid) setStorageNotice('Some saved reading records are invalid. Existing records have been preserved.');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [catalogue, manifests]);

  useEffect(() => {
    const onBackForward = () => applyRoute(currentBrowserRoute());
    window.addEventListener('popstate', onBackForward);
    return () => window.removeEventListener('popstate', onBackForward);
  }, [screen, demo]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  useEffect(() => {
    if (screen.kind === 'reader') readerRef.current?.focus();
  }, [screen.kind]);
  useEffect(() => {
    const syncFullscreen = () => { if (!document.fullscreenElement) setImmersive(false); };
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);
  function updateLocation(next: ReaderLocation) {
    // Selecting a page is not proof it was successfully loaded or read.
    // Progress is committed only after the active image has loaded.
    setLocation(next);
    if (screen.kind === 'reader') {
      const url = routeHref({ kind: 'reader', mangaId: screen.id,
        chapterId: next.chapterId, pageIndex: next.pageIndex }, import.meta.env.BASE_URL);
      if (window.location.pathname + window.location.search !== url) window.history.pushState(null, '', url);
    }
    setJumpToken(value => value + 1);
    setNotice('');
  }
  function markPageViewed(item: MangaEntry, viewed: ReaderLocation, verticalOffsetRatio?: number) {
    const viewedManifest = manifests.get(viewed.chapterId);
    const pageId = viewedManifest?.pages[viewed.pageIndex]?.id;
    if (!pageId || viewedManifest?.chapterId !== viewed.chapterId) return;
    const saved = loadProgress(item, manifests);
    const prior = laterProgress(progress[item.id], saved.status === 'ok' ? saved.value : undefined);
    const record: MangaProgress = {
      mangaId: item.id, chapterId: viewed.chapterId, pageIndex: viewed.pageIndex, pageId,
      updatedAt: nextProgressTimestamp(prior), readingMode: 'vertical',
      ...(verticalOffsetRatio !== undefined ? { verticalOffsetRatio } :
        prior?.chapterId === viewed.chapterId && prior?.pageId === pageId
          ? { verticalOffsetRatio: prior.verticalOffsetRatio } : {}),
    };
    const stored = saveProgress(record, item, manifests);
    if (stored.status === 'unavailable')
      setStorageNotice('Browser storage is unavailable or full. Reading progress is only retained in this session.');
    if (stored.status === 'invalid')
      setStorageNotice('A saved reading record is invalid. It was preserved; this session will not overwrite it.');
    if (stored.status === 'stale') {
      const refreshed = loadProgress(item, manifests);
      if (refreshed.status === 'ok') setProgress(previous => {
        const newer = laterProgress(previous[item.id], refreshed.value);
        return newer ? { ...previous, [item.id]: newer } : previous;
      });
      return;
    }
    setProgress(previous => {
      const newer = laterProgress(previous[item.id], record);
      return newer ? { ...previous, [item.id]: newer } : previous;
    });
  }
  function updatePreferences(next: ReaderPreferences) {
    const normalised = { ...next, direction: 'vertical' as const };
    setPreferences(normalised);
    if (!savePreferences(normalised))
      setStorageNotice('Reader settings could not be saved. Changes are only active in this session.');
    else setStorageNotice('');
  }
  function openChapter(item: MangaEntry, chapterId?: string, resume = false) {
    const target = resume ? restoreProgress(item, manifests, progress[item.id]) :
      { chapterId: chapterId ?? orderedChapters(item)[0]?.id ?? '', pageIndex: 0 };
    if (!target || !manifests.has(target.chapterId)) {
      setNotice('No verified demonstration pages are available for this chapter.');
      return;
    }
    navigateTo({ kind: 'reader', mangaId: item.id, chapterId: target.chapterId, pageIndex: target.pageIndex });
  }
  function move(delta: -1 | 1) {
    if (!entry || !location || !manifest) return;
    const next = stepChapter(entry, manifests, location, delta);
    if (next) updateLocation(next);
    else setNotice(delta === 1 ? 'You have reached the final chapter.' : 'You are at the first chapter.');
  }
  function exitImmersive() {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    setImmersive(false);
  }
  async function toggleImmersive() {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    const reader = readerRef.current;
    if (reader?.requestFullscreen) {
      try {
        await reader.requestFullscreen();
        setImmersive(true);
        return;
      } catch { /* CSS focus mode remains available when fullscreen is blocked. */ }
    }
    setImmersive(value => !value);
  }
  function applyRoute(route: AppRoute) {
    setNotice('');
    if (route.kind !== 'details' && route.kind !== 'reader' && route.kind !== 'not-found') {
      exitImmersive();
      setLocation(null);
      setScreen({ kind: 'catalogue', section: route.kind });
      return;
    }
    if (route.kind === 'not-found') {
      exitImmersive();
      setLocation(null);
      setScreen({ kind: 'not-found' });
      return;
    }
    const item = catalogue.find(value => value.id === route.mangaId);
    if (!item) {
      setScreen({ kind: 'not-found' }); setLocation(null); return;
    }
    if (route.kind === 'details') {
      exitImmersive();
      setScreen({ kind: 'details', id: item.id });
      return;
    }
    const verified = manifests.get(route.chapterId);
    if (!item.chapters.some(chapter => chapter.id === route.chapterId) ||
        !verified || route.pageIndex >= verified.pages.length) {
      exitImmersive(); setScreen({ kind: 'not-found' }); setLocation(null); return;
    }
    setLocation({ chapterId: route.chapterId, pageIndex: route.pageIndex });
    setJumpToken(value => value + 1);
    setScreen({ kind: 'reader', id: item.id });
  }
  function navigateTo(route: Exclude<AppRoute, { kind: 'not-found' }>) {
    const url = routeHref(route, import.meta.env.BASE_URL);
    if (window.location.pathname + window.location.search !== url) window.history.pushState(null, '', url);
    applyRoute(route);
  }
  function followLink(event: MouseEvent<HTMLAnchorElement>, action: () => void) {
    // Modified clicks, new tabs and the native context menu remain browser-owned.
    if (event.defaultPrevented || event.button !== 0 ||
        event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    action();
  }
  function goCatalogue(section: CatalogueSection = 'library') {
    navigateTo({ kind: section });
  }
  function changeDemo(value: boolean) {
    exitImmersive();
    setDemo(value); setLocation(null); setNotice(''); goCatalogue('home');
    setPersonalShelves(loadShelves(value ? demoEntries : realEntries).shelves);
    setAnnotations(loadAnnotations(value ? demoEntries : realEntries).annotations);
    setQuery(''); setTag(''); setCollection(''); setStatus('all');
  }
  function changeShelf(item: MangaEntry, shelf: ShelfSelection) {
    const outcome = saveShelf(item.id, shelf);
    if (outcome === 'ok') {
      setPersonalShelves(previous => {
        const next = { ...previous };
        if (shelf === null) delete next[item.id]; else next[item.id] = shelf;
        return next;
      });
      setShelfNotice(shelf ? 'Saved to ' + labels[shelf === 'trying' ? 'trying' : shelf === 'finished' ? 'finished' : 'to-read'] : 'Removed from personal shelf');
    } else setStorageNotice(outcome === 'invalid' ?
      'The saved shelf record is invalid and was preserved. Please export your data before recovery.' :
      'Browser storage is unavailable. Your shelf selection was not saved.');
  }
  function changeAnnotation(item: MangaEntry, patch: AnnotationPatch, message: string): boolean {
    const saved = saveAnnotation(item.id, patch);
    if (saved.status === 'ok') {
      setAnnotations(previous => ({...previous, [item.id]:saved.value}));
      setShelfNotice(message);
      return true;
    }
    setStorageNotice(saved.status === 'invalid' ?
      'The personal annotation is invalid or corrupt. Its original data was preserved.' :
      'Browser storage is unavailable or full. The annotation was not saved.');
    return false;
  }
  function addTag(item: MangaEntry) {
    try {
      const existing = annotations[item.id]?.tags ?? [];
      const tags = addPersonalTag(existing, tagDraft);
      if (tags.length === existing.length) {
        setShelfNotice('This tag is already attached.');
        return;
      }
      if (changeAnnotation(item, {tags}, 'Personal tag added')) setTagDraft('');
    } catch (error) {
      setStorageNotice(error instanceof Error ? error.message : 'Cannot add this tag.');
    }
  }
  function removePersonalTag(item: MangaEntry, value: string) {
    const tags = (annotations[item.id]?.tags ?? []).filter(tag => tag !== value);
    if (changeAnnotation(item, {tags}, 'Personal tag removed')) setConfirmRemoveTag(null);
  }
  function jumpToFilter(kind: 'tag' | 'collection', value: string) {
    setTag(kind === 'tag' ? value : '');
    setCollection(kind === 'collection' ? value : '');
    goCatalogue('library');
  }
  const progressForEntry = entry ? restoreProgress(entry, manifests, progress[entry.id]) : null;

  return <div className={'app-shell theme-' + preferences.theme +
    (immersive && screen.kind === 'reader' ? ' reading-immersive' : '')}>
    <a className="skip" href="#content">Skip to content</a>
    <header className="site-header">
      <a className="wordmark" href={routeHref({kind:'home'},import.meta.env.BASE_URL)}
        onClick={event=>followLink(event,()=>goCatalogue('home'))}
        aria-current={compactNav && selectedSection === 'home' ? 'page' : undefined}
        aria-label="Taiyou Manga home">
        <img className="brand-sun" src={import.meta.env.BASE_URL + 'branding/sun-' +
          (['charcoal','midnight','plum'].includes(preferences.theme) ? 'dark' : 'light') + '.webp'}
          width="54" height="54" alt="" /><span>TAIYOU <small>LIBRARY / MANGA</small></span>
      </a>
      <nav className="site-nav" aria-label="Main navigation">
        {currentNav.map(section =>
          <a key={section} className="site-nav-link"
            aria-current={selectedSection === section ? 'page' : undefined}
            href={routeHref({kind:section},import.meta.env.BASE_URL)}
            onClick={event=>followLink(event,()=>goCatalogue(section))}>
            {labels[section]} {['reading','trying','offline','finished','to-read'].includes(section) &&
              <span className="nav-count">({counts[section]})</span>}
          </a>)}
        {compactNav && <details className="nav-more"><summary>More</summary>
          <div className="nav-more-menu">{moreNav.map(section =>
            <a key={section} className="site-nav-link"
              aria-current={selectedSection === section ? 'page' : undefined}
              href={routeHref({kind:section},import.meta.env.BASE_URL)}
              onClick={event=>followLink(event,()=>goCatalogue(section))}>
              {labels[section]}
            </a>)}</div>
          </details>}
      </nav>
      <div className="header-right">
        <label className="app-theme-label">App theme
          <select aria-label="App theme" value={preferences.theme}
            onChange={event=>updatePreferences({...preferences,theme:event.target.value as ReaderPreferences['theme']})}>
            {(['sepia','paper','charcoal','midnight','ocean','plum'] as const).map(theme =>
              <option key={theme} value={theme}>{theme.charAt(0).toUpperCase() + theme.slice(1)}</option>)}
          </select></label>
        <span className="demo-pill">SAMPLE</span>
        <span className="network-state">{online ? 'Device online' : 'Device offline'}</span>
      </div>
    </header>
    <main id="content" className="main-area">
      {screen.kind === 'catalogue' && <>
        {screen.section === 'home' && <section className="hero">
          <div><p className="eyebrow">A PRIVATE READING SPACE / VOL. 01</p>
            <h1>Every story,<br /><em>a world to enter.</em></h1>
            <p className="hero-copy">An independent manga library designed around beautiful pages, quiet discovery and your place in every chapter.</p></div>
          <div className="hero-art" aria-hidden="true"><span className="hero-orbit orbit-one" /><span className="hero-orbit orbit-two" />
            <span className="hero-moon" /><span className="hero-art-label">THE ART OF TURNING PAGES</span></div>
        </section>}
        {screen.section === 'home' && continueReading.length > 0 && <section className="continue-section" aria-label="Continue reading">
          <div className="shelf-heading">
            <div><p className="eyebrow">PICK UP WHERE YOU LEFT OFF</p><h2>Continue reading</h2></div>
            <p>Saved on this device</p>
          </div>
          <div className="continue-list">
            {continueReading.map(({ item, resume }) => {
              const ordered = orderedChapters(item);
              const index = ordered.findIndex(chapter => chapter.id === resume.chapterId);
              const totalPages = manifests.get(resume.chapterId)?.pages.length ?? 0;
              return <a key={item.id} className="continue-card"
                href={routeHref({kind:'reader',mangaId:item.id,chapterId:resume.chapterId,pageIndex:resume.pageIndex},import.meta.env.BASE_URL)}
                onClick={event=>followLink(event,()=>openChapter(item,undefined,true))}>
                <strong>{item.title}</strong>
                <span>Chapter {index + 1} of {ordered.length} · Page {resume.pageIndex + 1} of {totalPages}</span>
                <span className="continue-action">Resume chapter ↗</span>
              </a>;
            })}
          </div>
        </section>}
        {screen.section === 'analytics' ? <section className="analytics-shelf" aria-label="Personal reading analytics">
          <p className="eyebrow">YOUR READING SNAPSHOT / THIS DEVICE</p>
          <h1>Analytics</h1>
          <p>Counts reflect locally saved progress and personal shelves, not estimated reading time. No tracking service is connected.</p>
          <div className="analytics-grid">
            <div><strong>{Object.keys(progress).length}</strong><span>Series with saved progress</span></div>
            <div><strong>{counts.finished}</strong><span>Personally finished</span></div>
            <div><strong>{offlineChapterIds.size}</strong><span>Offline chapters</span></div>
            <div><strong>{counts['to-read']}</strong><span>On your To Be Read shelf</span></div>
          </div>
          <button className="secondary" type="button" onClick={()=>goCatalogue('reading')}>View currently reading</button>
        </section> : screen.section === 'offline' ? <section className="offline-shelf" aria-label="Offline manga chapters">
          <p className="eyebrow">READY WHEN DISCONNECTED</p>
          <h1>Offline chapters</h1>
          <p>Only chapters you explicitly saved appear here. Removing a copy never clears reading progress.</p>
          <p aria-live="polite">{offlineChapterIds.size} verified {offlineChapterIds.size === 1 ? 'chapter' : 'chapters'} available on this device.</p>
          {offlineSeries.length ?
            <div className="offline-list">{offlineSeries.flatMap(item => item.chapters.filter(ch => offlineChapterIds.has(ch.id))
              .map(chapter => <a className="offline-series-link" key={chapter.id}
                href={routeHref({kind:'reader',mangaId:item.id,chapterId:chapter.id,pageIndex:0},import.meta.env.BASE_URL)}
                onClick={event=>followLink(event,()=>openChapter(item,chapter.id))}>
                <strong>{item.title}</strong><span>{chapter.label}</span><span>Read chapter ↗</span>
              </a>))}</div> :
            <div className="empty-state"><h2>No downloaded chapters yet</h2>
              <p>Open a sample series and choose Download chapter. No entire series is downloaded automatically.</p>
              <a className="secondary" href={routeHref({kind:'library'},import.meta.env.BASE_URL)}
                onClick={event=>followLink(event,()=>goCatalogue('library'))}>Browse the library</a>
            </div>}
        </section> : <>
        <div className="mode-bar" role="group" aria-label="Catalogue source">
          <div><strong>{demo ? 'Explore the demonstration' : 'Your private library'}</strong>
            <p>{demo ? fixtureStatement : 'No private source has been configured. Your personal catalogue is not loaded.'}</p></div>
          <div className="mode-actions">
            <button type="button" aria-pressed={demo} className={demo ? 'chip active' : 'chip'} onClick={() => changeDemo(true)}>Sample series</button>
            <button type="button" aria-pressed={!demo} className={!demo ? 'chip active' : 'chip'} onClick={() => changeDemo(false)}>My library (empty)</button>
          </div>
        </div>
        <LocalBackupControl entries={catalogue} manifests={manifests}
          onRestored={()=>{
            setProgress(loadAllProgress(catalogue, manifests).progress);
            setPersonalShelves(loadShelves(catalogue).shelves);
            setAnnotations(loadAnnotations(catalogue).annotations);
            const saved = loadPreferences();
            if (saved.status === 'ok') setPreferences(saved.value);
          }} />
        <section className="shelf" aria-label="Manga catalogue">
          <div className="shelf-heading"><div><p className="eyebrow">DISCOVER / THE SHELF</p>
              <h2>{screen.section === 'home' ? (demo ? 'The sample collection' : 'Your collection') : labels[screen.section]}</h2>
            </div><p>{displayed.length} {displayed.length === 1 ? 'series' : 'series'} shown</p></div>
          <div className="toolbar">
            <label className="search-label">Search series or aliases
              <input id="catalogue-search" type="search" autoComplete="off" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find a story..." /></label>
            <label>Publication
              <select value={status} onChange={e=>setStatus(e.target.value as PublicationStatus | 'all')}>
                <option value="all">All statuses</option><option value="ongoing">Ongoing</option><option value="completed">Completed</option>
                <option value="hiatus">Hiatus</option><option value="unknown">Unknown</option>
              </select></label>
            <label>Genre
              <select value={tag} onChange={e=>setTag(e.target.value)}><option value="">All tags</option>
                {allTags.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
            <label>Collection
              <select value={collection} onChange={e=>setCollection(e.target.value)}><option value="">All collections</option>
                {allCollections.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
            <label>Sort
              <select value={sort} onChange={e=>setSort(e.target.value as SortMode)}>
                <option value="title">Title A to Z</option><option value="rating">Rating</option><option value="chapters">Chapter count</option>
              </select></label>
          </div>
          {displayed.length ? <div className="book-grid">{displayed.map((item, index) =>
            <a className="book-card" key={item.id} href={routeHref({kind:'details',mangaId:item.id},import.meta.env.BASE_URL)}
              onClick={event=>followLink(event,()=>navigateTo({kind:'details',mangaId:item.id}))}>
              <span className={'book-cover cover-'+(demoEntries.findIndex(d=>d.id===item.id)%3+1)}>
                {item.publicationStatus !== 'unknown' && <span className="status-ribbon">{item.publicationStatus}</span>}
                <span className="cover-number">{String(index+1).padStart(2,'0')} / T</span>
                <span className="cover-illustration" aria-hidden="true"><i /><b /></span>
                <span className="cover-title">{item.title}</span><span className="cover-foot">ORIGINAL DEMONSTRATION</span>
              </span>
              <span className="book-details"><strong>{item.title}</strong>
                <span>{item.chapters.length} chapters <span aria-hidden="true">·</span> {item.creators.join(', ')}</span>
                {progress[item.id] && restoreProgress(item,manifests,progress[item.id]) &&
                  <span className="book-progress">In progress · Chapter {orderedChapters(item)
                    .findIndex(chapter=>chapter.id===progress[item.id]!.chapterId) + 1} of {item.chapters.length}</span>}
                <span className="book-micro">{annotations[item.id]?.rating ? '★ ' + annotations[item.id]!.rating + '/10 (mine)' :
                  item.rating ? '★ ' + item.rating + '/10 (sample)' : ''} <span aria-hidden="true">↗</span></span>
              </span>
            </a>)}</div> :
            <div className="empty-state"><span className="empty-icon" aria-hidden="true">◇</span>
              <h3>{demo ? (screen.section === 'home' || screen.section === 'library' ?
                'Nothing matches these filters' : 'No manga in ' + labels[screen.section] + ' yet') : 'Your collection is not connected yet'}</h3>
              <p>{demo ? 'Change a personal shelf on a manga details page, or try different filters.' :
                'This is an honest empty state. No sign-in, private catalogue or storage integration is enabled.'}</p>
              {demo && <button className="secondary" type="button" onClick={()=>{setQuery('');setTag('');setStatus('all');setCollection('');}}>Clear filters</button>}
            </div>}
        </section></>}
      </>}
      {screen.kind === 'details' && entry && <>
        <a className="back" href={routeHref({kind:'library'},import.meta.env.BASE_URL)}
          onClick={event=>followLink(event,()=>goCatalogue())}>← Back to the shelf</a>
        <section className="series-detail">
          <div className={'detail-cover cover-'+(demoEntries.findIndex(d=>d.id===entry.id)%3+1)} aria-hidden="true">
            {entry.publicationStatus !== 'unknown' && <span className="status-ribbon">{entry.publicationStatus}</span>}
            <span className="cover-illustration"><i /><b /></span><span className="cover-title">{entry.title}</span>
          </div>
          <div className="detail-content"><p className="eyebrow">SERIES / PRIVATE READING ROOM</p>
            <h1>{entry.title}</h1><p className="detail-sub">{entry.creators.join(', ')} <span aria-hidden="true">·</span> {entry.publicationStatus}</p>
            <p className="detail-description">{entry.synopsis}</p>
            <div className="tag-row">{entry.tags.map(value=><button type="button" className="tag" key={value}
              onClick={()=>jumpToFilter('tag',value)} title={'Filter All Manga by ' + value}>{value}</button>)}</div>
            <div className="stat-strip"><span><strong>{entry.chapters.length}</strong> chapters</span>
              <span><strong>{annotations[entry.id]?.rating ?? entry.rating ?? '–'}</strong> {annotations[entry.id]?.rating ? 'my' : 'sample'} rating / 10</span>
              <span><strong>Scroll</strong> continuous chapter view</span></div>
            <div className="personal-shelf-selector">
              <label>Personal reading shelf
                <select aria-label="Personal reading shelf" value={personalShelves[entry.id] ?? ''}
                  onChange={event=>changeShelf(entry, (event.target.value || null) as ShelfSelection)}>
                  <option value="">No personal shelf</option>
                  <option value="trying">Trying Out</option>
                  <option value="to-read">To Be Read</option>
                  <option value="finished">Finished</option>
                </select></label>
              <p>Stored only on this device. Your publication status is not changed.</p>
            </div>
            <div className="detail-actions">
              <a className="primary" href={routeHref({kind:'reader',mangaId:entry.id,
                chapterId:progressForEntry?.chapterId ?? chapters[0]?.id ?? 'unavailable',
                pageIndex:progressForEntry?.pageIndex ?? 0},import.meta.env.BASE_URL)}
                onClick={event=>followLink(event,()=>openChapter(entry,undefined,!!progressForEntry))}>
                {progressForEntry ? 'Continue reading' : 'Read from beginning'} <span aria-hidden="true">↗</span></a>
              {progressForEntry && <a className="secondary"
                href={routeHref({kind:'reader',mangaId:entry.id,chapterId:chapters[0]?.id ?? 'unavailable',pageIndex:0},import.meta.env.BASE_URL)}
                onClick={event=>followLink(event,()=>openChapter(entry,chapters[0]?.id))}>Start from chapter one</a>}</div>
            <p className="fine-print">Reading progress and personal notes stay on this device. Cross-device synchronisation is not enabled.</p>
          </div>
        </section>
        <section className="personal-annotations" aria-label="Personal manga annotations">
          <h2>My notes and tags</h2>
          <p>These are private to this browser. They are not part of the public demonstration catalogue.</p>
          <div className="personal-rating">
            <strong>Personal rating</strong>
            <div className="rating-stars" role="group" aria-label="Personal rating">
              {Array.from({length:10},(_,index)=>index+1).map(value=>
                <button key={value} type="button" aria-label={'Rate ' + value + ' out of 10'}
                  aria-pressed={annotations[entry.id]?.rating === value}
                  style={{opacity: annotations[entry.id]?.rating && value <= annotations[entry.id]!.rating!
                    ? Math.min(1,0.38 + annotations[entry.id]!.rating! * 0.062) : 0.26}}
                  onClick={()=>changeAnnotation(entry,{rating:value},'Rating saved')}>★</button>)}
              <span aria-live="polite">{annotations[entry.id]?.rating ? annotations[entry.id]!.rating + ' / 10' : 'No personal rating'}</span>
            </div>
            {annotations[entry.id]?.rating && <button className="secondary" type="button"
              onClick={()=>changeAnnotation(entry,{rating:null},'Personal rating cleared')}>Clear rating</button>}
          </div>
          <div className="personal-tag-editor">
            <strong>Personal tags</strong>
            <div className="tag-row">
              {(annotations[entry.id]?.tags ?? []).map(value=><span className="personal-tag" key={value}>
                <button className="tag" type="button" onClick={()=>jumpToFilter('tag',value)}>{value}</button>
                <button className="tag-remove" type="button" aria-label={'Remove tag ' + value}
                  onClick={()=>setConfirmRemoveTag(value)}>×</button>
              </span>)}
            </div>
            <div className="tag-entry">
              <label>Add a personal tag
                <input type="text" value={tagDraft} maxLength={48} list="personal-tag-suggestions"
                  onChange={event=>setTagDraft(event.target.value)}
                  onKeyDown={event=>{if(event.key === 'Enter'){event.preventDefault();addTag(entry);}}}
                  placeholder="e.g. Romance" /></label>
              <datalist id="personal-tag-suggestions">{allTags.map(value=><option key={value} value={value}/>)}</datalist>
              <button type="button" className="secondary" disabled={!tagDraft.trim()} onClick={()=>addTag(entry)}>Add tag</button>
            </div>
          </div>
          <div className="personal-notes-editor">
            <label>Personal notes
              <textarea value={noteDraft} maxLength={5000} rows={4}
                onChange={event=>setNoteDraft(event.target.value)} placeholder="Your thoughts about this manga..." />
            </label>
            <div className="notes-actions">
              <button className="primary" type="button"
                disabled={noteDraft === (annotations[entry.id]?.notes ?? '')}
                onClick={()=>changeAnnotation(entry,{notes:noteDraft},'Notes saved')}>Save notes</button>
              <button className="secondary" type="button"
                disabled={noteDraft === (annotations[entry.id]?.notes ?? '')}
                onClick={()=>setNoteDraft(annotations[entry.id]?.notes ?? '')}>Discard edits</button>
            </div>
          </div>
        </section>
        <section className="chapter-section"><div className="shelf-heading"><div><p className="eyebrow">CONTENTS / READING ORDER</p><h2>Chapters &amp; volumes</h2></div></div>
          <label className="chapter-search">Search chapters
            <input type="search" value={chapterQuery} onChange={event=>setChapterQuery(event.target.value)}
              placeholder="Find a chapter..." />
          </label>
          {chapters.filter(chapter => chapter.label.toLocaleLowerCase().includes(chapterQuery.toLocaleLowerCase()))
            .map(chapter=>{ const index = chapters.findIndex(value=>value.id === chapter.id); return <div className="chapter-entry" key={chapter.id}>
            <a className="chapter-row"
              href={routeHref({kind:'reader',mangaId:entry.id,chapterId:chapter.id,pageIndex:0},import.meta.env.BASE_URL)}
              onClick={event=>followLink(event,()=>openChapter(entry,chapter.id))}>
              <span className="chapter-number">{String(index+1).padStart(2,'0')}</span>
              <span className="chapter-title"><strong>{chapter.label}</strong>
                <small>{chapter.volume ?? 'No volume'} · {chapter.pageCount ?? 'Unknown'} sample pages</small></span>
              <span className="chapter-open">Read ↗</span></a>
            {manifests.get(chapter.id) && <OfflineChapterControl manifest={manifests.get(chapter.id)!}
              onChange={()=>setInventoryRevision(value=>value+1)} />}
          </div>;})}
        </section>
      </>}
      {screen.kind === 'reader' && entry && location && <section className="reader-shell" ref={readerRef} tabIndex={0}
        aria-label="Manga reader, continuous chapter view">
        <div className="reader-topline">
          <a className="back" href={routeHref({kind:'details',mangaId:entry.id},import.meta.env.BASE_URL)}
            onClick={event=>followLink(event,()=>navigateTo({kind:'details',mangaId:entry.id}))}>← Series details</a>
          <div className="reader-topline-actions">
            <a className="back" href={routeHref({kind:'library'},import.meta.env.BASE_URL)}
              onClick={event=>followLink(event,()=>goCatalogue())}>Shelf ↗</a>
            <button className="secondary focus-toggle" type="button" aria-pressed={immersive}
              onClick={()=>{void toggleImmersive();}}>{immersive ? 'Exit focus view' : 'Focus view'}</button>
          </div>
        </div>
        <div className="reader-controls">
          <div className="reader-heading"><h1>{entry.title}</h1><p>{activeChapter?.label ?? 'Unknown chapter'}</p></div>
          <div className="reader-options"><p className="scroll-mode-note">Continuous chapter scroll · One chapter per view</p>
            <div className="reader-selectors">
              <label>Image fit
                <select value={preferences.fit} onChange={event=>updatePreferences({
                  ...preferences, fit: event.target.value as ReaderPreferences['fit'],
                })}>
                  <option value="page">Standard width</option><option value="width">Wide view</option>
                </select></label>
              <label>Reader theme
                <select value={preferences.theme} onChange={event=>updatePreferences({
                  ...preferences, theme: event.target.value as ReaderPreferences['theme'],
                })}>
                  {(['sepia','paper','charcoal','midnight','ocean','plum'] as const).map(theme =>
                    <option key={theme} value={theme}>{theme.charAt(0).toUpperCase()+theme.slice(1)}</option>)}
                </select></label>
              <label>Choose chapter
                <select value={location.chapterId} onChange={event=>openChapter(entry,event.target.value)}>
                  {chapters.map(chapter=><option key={chapter.id} value={chapter.id}>{chapter.label}</option>)}</select>
              </label>
              {manifest && <label>Jump within chapter
                <select value={location.pageIndex} onChange={event=>{
                  const pageIndex = Number(event.target.value);
                  if (Number.isSafeInteger(pageIndex) && pageIndex >= 0 && pageIndex < manifest.pages.length)
                    updateLocation({chapterId:location.chapterId, pageIndex});
                }}>
                  {manifest.pages.map((page,index)=><option value={index} key={page.id}>Page {index + 1} of {manifest.pages.length}</option>)}
                </select>
              </label>}
            </div></div>
        </div>
        {manifest ?
          <VerticalReader key={manifest.chapterId + ':' + inventoryRevision} manifest={manifest}
            fit={preferences.fit} activeIndex={location.pageIndex} jumpToken={jumpToken}
            initialOffsetRatio={progress[entry.id]?.chapterId === location.chapterId &&
              progress[entry.id]?.pageId === manifest.pages[location.pageIndex]?.id
                ? progress[entry.id]?.verticalOffsetRatio ?? 0 : 0}
            onScrollAnchor={(index,ratio)=>markPageViewed(entry,{chapterId:manifest.chapterId,pageIndex:index},ratio)}
            onActivePage={index => {
              const url = routeHref({kind:'reader',mangaId:entry.id,chapterId:manifest.chapterId,pageIndex:index},import.meta.env.BASE_URL);
              if (window.location.pathname + window.location.search !== url) window.history.replaceState(null, '', url);
              setLocation(previous => previous?.chapterId === manifest.chapterId && previous.pageIndex === index
                ? previous : { chapterId: manifest.chapterId, pageIndex: index });
            }}
            onViewedPage={index => markPageViewed(entry, { chapterId: manifest.chapterId, pageIndex: index })} /> :
          <div className="page-error" role="alert">Chapter pages are not available.</div>}
        <div className="page-navigation">
          <button className="secondary" type="button" disabled={!stepChapter(entry, manifests, location, -1)}
            onClick={()=>move(-1)}>← Previous chapter</button>
          <div className="bottom-chapter-picker">
            <label>Chapter
              <select aria-label="Bottom chapter selection" value={location.chapterId}
                onChange={event=>openChapter(entry,event.target.value)}>
                {chapters.map(chapter=><option key={chapter.id} value={chapter.id}>{chapter.label}</option>)}
              </select></label>
            <p aria-live="polite">Chapter {chapters.findIndex(chapter=>chapter.id===location.chapterId)+1} of {chapters.length}
              <span aria-hidden="true"> · </span> Page {location.pageIndex+1} of {manifest?.pages.length ?? '?'}</p>
          </div>
          <button className="primary" type="button" disabled={!stepChapter(entry, manifests, location, 1)}
            onClick={()=>move(1)}>Next chapter →</button>
        </div>
        {notice && <p className="reader-notice" role="status">{notice}</p>}
        <p className="reader-hint">Scroll down to read every page in this chapter. Previous and Next move between chapters only. Nearby images load on demand.</p>
        <p className="fine-print">Synthetic chapter copies can be saved from series details for genuine offline access. No real private media is connected.</p>
      </section>}
      {screen.kind === 'not-found' && <div className="empty-state" role="alert"><h2>Page unavailable</h2>
        <p>This link does not point to an available manga, chapter or page.</p>
        <a className="secondary" href={routeHref({kind:'library'},import.meta.env.BASE_URL)}
          onClick={event=>followLink(event,()=>goCatalogue())}>Open the library</a></div>}
      {(screen.kind === 'details' || screen.kind === 'reader') && !entry && <div className="empty-state" role="alert"><h2>Series unavailable</h2>
        <p>This series is no longer in the selected catalogue.</p><button className="secondary" onClick={()=>goCatalogue()}>Return to the shelf</button></div>}
      {notice && screen.kind !== 'reader' && <p className="reader-notice" role="status">{notice}</p>}
      {confirmRemoveTag && entry && screen.kind === 'details' && <div className="dialog-scrim"
        onKeyDown={event=>{if(event.key==='Escape')setConfirmRemoveTag(null);}}>
        <div className="app-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-tag-title">
          <h2 id="confirm-tag-title">Remove personal tag?</h2>
          <p>Remove “{confirmRemoveTag}” from this manga on this device?</p>
          <div className="dialog-actions">
            <button autoFocus className="secondary" type="button" onClick={()=>setConfirmRemoveTag(null)}>Cancel</button>
            <button className="primary" type="button" onClick={()=>removePersonalTag(entry,confirmRemoveTag)}>Remove tag</button>
          </div>
        </div>
      </div>}
      {storageNotice && <p className="storage-notice" role="status">{storageNotice}</p>}
      {shelfNotice && <div className="success-toast" role="status">
        <span>{shelfNotice}</span><button type="button" aria-label="Dismiss notification" onClick={()=>setShelfNotice('')}>×</button>
      </div>}
    </main>
    <footer className="site-footer"><span>Created by Taiyou · TAIYOU / PERSONAL MANGA LIBRARY</span>
      <span>{demo ? 'Synthetic sample catalogue · No cloud sync' : 'No private catalogue connected'} · Independent of the hub</span></footer>
  </div>;
}
