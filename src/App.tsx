import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { entries as realEntries } from './data/catalogue';
import { demoEntries, demoManifests, fixtureStatement } from './data/fixtures';
import { verifyOfflineChapter } from './data/offlineChapters';
import { OfflineChapterControl } from './components/OfflineChapterControl';
import { VerticalReader } from './components/VerticalReader';
import { parseAppRoute, routeHref, type AppRoute } from './domain/routes';
import { defaultReaderPreferences, laterProgress, loadAllProgress, loadPreferences, loadProgress,
  nextProgressTimestamp, savePreferences, saveProgress, type ReaderPreferences } from './domain/localReaderStorage';
import { filterCatalogue, type SortMode } from './domain/filters';
import { orderedChapters, restoreProgress, stepChapter, type ReaderLocation } from './domain/reader';
import type { ChapterManifest, MangaEntry, MangaProgress, PublicationStatus } from './domain/types';
import './styles.css';

type Screen = { kind: 'catalogue'; section: 'home' | 'library' | 'offline' } | { kind: 'details' | 'reader'; id: string } | { kind: 'not-found' };
function currentBrowserRoute(): AppRoute {
  return typeof window === 'undefined' ? { kind: 'home' } :
    parseAppRoute(window.location.pathname, window.location.search, import.meta.env.BASE_URL);
}

export default function App({ initialDemo = true }: { initialDemo?: boolean } = {}) {
  const initialRoute = useMemo(currentBrowserRoute, []);
  const [demo, setDemo] = useState(initialDemo);
  const [screen, setScreen] = useState<Screen>(() => {
    if (initialRoute.kind === 'home' || initialRoute.kind === 'library' || initialRoute.kind === 'offline') {
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
  const allTags = [...new Set(catalogue.flatMap(item => item.tags))].sort();
  const allCollections = [...new Set(catalogue.flatMap(item => item.collections ?? []))].sort();
  const filtered = useMemo(
    () => filterCatalogue(catalogue, query, status, tag, collection, sort),
    [catalogue, query, status, tag, collection, sort],
  );
  const offlineSeries = catalogue.filter(item => item.chapters.some(chapter => offlineChapterIds.has(chapter.id)));

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    void navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js', {
      scope: import.meta.env.BASE_URL,
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
    if (route.kind === 'home' || route.kind === 'library' || route.kind === 'offline') {
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
  function goCatalogue(section: 'home' | 'library' | 'offline' = 'library') {
    navigateTo({ kind: section });
  }
  function changeDemo(value: boolean) {
    exitImmersive();
    setDemo(value); setLocation(null); setNotice(''); goCatalogue('home');
    setQuery(''); setTag(''); setCollection(''); setStatus('all');
  }
  const progressForEntry = entry ? restoreProgress(entry, manifests, progress[entry.id]) : null;

  return <div className={'app-shell theme-' + preferences.theme +
    (immersive && screen.kind === 'reader' ? ' reading-immersive' : '')}>
    <a className="skip" href="#content">Skip to content</a>
    <header className="site-header">
      <a className="wordmark" href={routeHref({kind:'home'},import.meta.env.BASE_URL)}
        onClick={event=>followLink(event,()=>goCatalogue('home'))} aria-label="Taiyou Manga home">
        <span className="sun-mark" aria-hidden="true">✺</span><span>TAIYOU <small>LIBRARY / MANGA</small></span>
      </a>
      <nav className="site-nav" aria-label="Main navigation">
        {(['home','library','offline'] as const).map(section =>
          <a key={section} className="site-nav-link"
            aria-current={screen.kind === 'catalogue' && screen.section === section ? 'page' : undefined}
            href={routeHref({kind:section},import.meta.env.BASE_URL)}
            onClick={event=>followLink(event,()=>goCatalogue(section))}>
            {section === 'home' ? 'Home' : section === 'library' ? 'Library' : 'Offline (' + offlineChapterIds.size + ')'}
          </a>)}
      </nav>
      <div className="header-right"><span className="demo-pill">SAMPLE</span>
        <span className="network-state">{online ? 'Device online' : 'Device offline'}</span></div>
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
        {screen.section === 'offline' ? <section className="offline-shelf" aria-label="Offline manga chapters">
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
        <section className="shelf" aria-label="Manga catalogue">
          <div className="shelf-heading"><div><p className="eyebrow">DISCOVER / THE SHELF</p><h2>{demo ? 'The sample collection' : 'Your collection'}</h2></div>
            <p>{filtered.length} {filtered.length === 1 ? 'series' : 'series'} shown</p></div>
          <div className="toolbar">
            <label className="search-label">Search series or aliases
              <input type="search" autoComplete="off" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find a story..." /></label>
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
          {filtered.length ? <div className="book-grid">{filtered.map((item, index) =>
            <a className="book-card" key={item.id} href={routeHref({kind:'details',mangaId:item.id},import.meta.env.BASE_URL)}
              onClick={event=>followLink(event,()=>navigateTo({kind:'details',mangaId:item.id}))}>
              <span className={'book-cover cover-'+(demoEntries.findIndex(d=>d.id===item.id)%3+1)}>
                <span className="cover-number">{String(index+1).padStart(2,'0')} / T</span>
                <span className="cover-illustration" aria-hidden="true"><i /><b /></span>
                <span className="cover-title">{item.title}</span><span className="cover-foot">ORIGINAL DEMONSTRATION</span>
              </span>
              <span className="book-details"><strong>{item.title}</strong>
                <span>{item.chapters.length} chapters <span aria-hidden="true">·</span> {item.publicationStatus}</span>
                <span className="book-micro">{item.rating ? '★ ' + item.rating + '/10 (sample)' : 'Not rated'} <span aria-hidden="true">↗</span></span>
              </span>
            </a>)}</div> :
            <div className="empty-state"><span className="empty-icon" aria-hidden="true">◇</span>
              <h3>{demo ? 'Nothing matches these filters' : 'Your collection is not connected yet'}</h3>
              <p>{demo ? 'Try a different search, genre, publication status or collection.' :
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
            <span className="cover-illustration"><i /><b /></span><span className="cover-title">{entry.title}</span>
          </div>
          <div className="detail-content"><p className="eyebrow">SERIES / PRIVATE READING ROOM</p>
            <h1>{entry.title}</h1><p className="detail-sub">{entry.creators.join(', ')} <span aria-hidden="true">·</span> {entry.publicationStatus}</p>
            <p className="detail-description">{entry.synopsis}</p>
            <div className="tag-row">{entry.tags.map(value=><span className="tag" key={value}>{value}</span>)}</div>
            <div className="stat-strip"><span><strong>{entry.chapters.length}</strong> chapters</span>
              <span><strong>{entry.rating ?? '–'}</strong> sample rating / 10</span>
              <span><strong>Scroll</strong> continuous chapter view</span></div>
            <div className="detail-actions">
              <a className="primary" href={routeHref({kind:'reader',mangaId:entry.id,
                chapterId:progressForEntry?.chapterId ?? chapters[0]?.id ?? 'unavailable',
                pageIndex:progressForEntry?.pageIndex ?? 0},import.meta.env.BASE_URL)}
                onClick={event=>followLink(event,()=>openChapter(entry,undefined,!!progressForEntry))}>
                {progressForEntry ? 'Continue reading' : 'Read from beginning'} <span aria-hidden="true">↗</span></a>
              {progressForEntry && <a className="secondary"
                href={routeHref({kind:'reader',mangaId:entry.id,chapterId:chapters[0]?.id ?? 'unavailable',pageIndex:0},import.meta.env.BASE_URL)}
                onClick={event=>followLink(event,()=>openChapter(entry,chapters[0]?.id))}>Start from chapter one</a>}</div>
            <p className="fine-print">Reading progress is stored locally on this device, when browser storage permits. Cross-device sync is not enabled.</p>
          </div>
        </section>
        <section className="chapter-section"><div className="shelf-heading"><div><p className="eyebrow">CONTENTS / READING ORDER</p><h2>Chapters &amp; volumes</h2></div></div>
          {chapters.map((chapter,index)=><div className="chapter-entry" key={chapter.id}>
            <a className="chapter-row"
              href={routeHref({kind:'reader',mangaId:entry.id,chapterId:chapter.id,pageIndex:0},import.meta.env.BASE_URL)}
              onClick={event=>followLink(event,()=>openChapter(entry,chapter.id))}>
              <span className="chapter-number">{String(index+1).padStart(2,'0')}</span>
              <span className="chapter-title"><strong>{chapter.label}</strong>
                <small>{chapter.volume ?? 'No volume'} · {chapter.pageCount ?? 'Unknown'} sample pages</small></span>
              <span className="chapter-open">Read ↗</span></a>
            {manifests.get(chapter.id) && <OfflineChapterControl manifest={manifests.get(chapter.id)!}
              onChange={()=>setInventoryRevision(value=>value+1)} />}
          </div>)}
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
                  <option value="dark">Dark</option><option value="sepia">Sepia</option><option value="light">Light</option>
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
          <p aria-live="polite">Chapter {chapters.findIndex(chapter=>chapter.id===location.chapterId)+1} of {chapters.length}
            <span aria-hidden="true"> · </span> {activeChapter?.label}
            <span aria-hidden="true"> · </span> Page {location.pageIndex+1} of {manifest?.pages.length ?? '?'}</p>
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
      {storageNotice && <p className="storage-notice" role="status">{storageNotice}</p>}
    </main>
    <footer className="site-footer"><span>TAIYOU / PERSONAL MANGA LIBRARY</span>
      <span>{demo ? 'Synthetic sample catalogue · No cloud sync' : 'No private catalogue connected'} · Independent of the hub</span></footer>
  </div>;
}
