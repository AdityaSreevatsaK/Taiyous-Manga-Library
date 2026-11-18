import { useEffect, useMemo, useRef, useState } from 'react';
import { entries as realEntries } from './data/catalogue';
import { demoEntries, demoManifests, fixtureStatement } from './data/fixtures';
import { makeFixturePage } from './data/fixtureArt';
import { VerticalReader } from './components/VerticalReader';
import { filterCatalogue, type SortMode } from './domain/filters';
import { keyNavigation, nextPreloadIndex, orderedChapters, restoreProgress, stepReader, swipeNavigation, type ReaderLocation } from './domain/reader';
import type { ChapterManifest, MangaEntry, MangaProgress, PublicationStatus, ReadingDirection } from './domain/types';
import './styles.css';

type Screen = { kind: 'catalogue' } | { kind: 'details' | 'reader'; id: string };
const directions: ReadingDirection[] = ['rtl', 'ltr', 'vertical'];

export default function App({ initialDemo = true }: { initialDemo?: boolean } = {}) {
  const [demo, setDemo] = useState(initialDemo);
  const [screen, setScreen] = useState<Screen>({ kind: 'catalogue' });
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<PublicationStatus | 'all'>('all');
  const [tag, setTag] = useState('');
  const [collection, setCollection] = useState('');
  const [sort, setSort] = useState<SortMode>('title');
  const [direction, setDirection] = useState<ReadingDirection>('rtl');
  const [immersive, setImmersive] = useState(false);
  const [jumpToken, setJumpToken] = useState(0);
  const [location, setLocation] = useState<ReaderLocation | null>(null);
  const [progress, setProgress] = useState<Record<string, MangaProgress>>({});
  const [notice, setNotice] = useState('');
  const [image, setImage] = useState<{ key: string; src: string } | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [loadedPageKey, setLoadedPageKey] = useState<string | null>(null);
  const [imageRetry, setImageRetry] = useState(0);
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  const cache = useRef(new Map<string, string>());
  const touch = useRef<{ x: number; y: number } | null>(null);
  const readerRef = useRef<HTMLElement | null>(null);
  const catalogue = demo ? demoEntries : realEntries;
  const manifests: ReadonlyMap<string, ChapterManifest> = demo ? demoManifests : new Map<string, ChapterManifest>();
  const entry = screen.kind === 'catalogue' ? undefined : catalogue.find(item => item.id === screen.id);
  const manifest = location ? manifests.get(location.chapterId) : undefined;
  const activePageKey = location ? location.chapterId + ':' + location.pageIndex : null;
  // Do not momentarily show the previous page under a new location while its effect runs.
  const displayedImage = image?.key === activePageKey ? image.src : null;
  const pageReady = direction === 'vertical' ? !!activePageKey && loadedPageKey === activePageKey :
    !!displayedImage && !!activePageKey && loadedPageKey === activePageKey && !imageError;
  const chapters = entry ? orderedChapters(entry) : [];
  const activeChapter = chapters.find(chapter => chapter.id === location?.chapterId);
  const allTags = [...new Set(catalogue.flatMap(item => item.tags))].sort();
  const allCollections = [...new Set(catalogue.flatMap(item => item.collections ?? []))].sort();
  const filtered = useMemo(
    () => filterCatalogue(catalogue, query, status, tag, collection, sort),
    [catalogue, query, status, tag, collection, sort],
  );

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
  useEffect(() => {
    // VerticalReader owns its small image window; do not recreate a page on every scroll.
    if (direction === 'vertical' && screen.kind === 'reader') return;
    if (screen.kind !== 'reader' || !entry || !location || !manifest || !demo) {
      setImage(null);
      setLoadedPageKey(null);
      return;
    }
    // Requiring a fresh onLoad avoids reusing readiness from a prior retry.
    setLoadedPageKey(null);
    setImageError(null);
    try {
      const key = location.chapterId + ':' + location.pageIndex;
      const neighbour = nextPreloadIndex(location.pageIndex, manifest.pages.length);
      const nextKey = neighbour === null ? null : location.chapterId + ':' + neighbour;
      const keep = new Set([key, ...(nextKey ? [nextKey] : [])]);
      for (const cached of cache.current.keys()) if (!keep.has(cached)) cache.current.delete(cached);
      for (const wanted of keep) {
        if (!cache.current.has(wanted)) {
          const position = wanted === key ? location.pageIndex : neighbour!;
          cache.current.set(wanted, makeFixturePage(location.chapterId, position));
        }
      }
      const src = cache.current.get(key);
      setImage(src ? { key, src } : null);
      if (nextKey) {
        const preloaded = new Image();
        preloaded.src = cache.current.get(nextKey) ?? '';
      }
    } catch {
      setImage(null);
      setImageError('The generated page could not be displayed. Retry this page.');
    }
  }, [screen.kind, entry, location, manifest, demo, imageRetry, direction]);
  function updateLocation(next: ReaderLocation) {
    // Selecting a page is not proof it was successfully loaded or read.
    // Progress is committed only after the active image has loaded.
    setLocation(next);
    setLoadedPageKey(null);
    if (direction === 'vertical') setJumpToken(value => value + 1);
    setNotice('');
  }
  function markPageViewed(item: MangaEntry, viewed: ReaderLocation) {
    const viewedManifest = manifests.get(viewed.chapterId);
    const pageId = viewedManifest?.pages[viewed.pageIndex]?.id;
    if (!pageId || viewedManifest?.chapterId !== viewed.chapterId) return;
    setProgress(previous => ({
      ...previous,
      [item.id]: {
        mangaId: item.id,
        chapterId: viewed.chapterId,
        pageIndex: viewed.pageIndex,
        pageId,
        updatedAt: new Date().toISOString(),
      },
    }));
  }
  function openChapter(item: MangaEntry, chapterId?: string, resume = false) {
    const target = resume ? restoreProgress(item, manifests, progress[item.id]) :
      { chapterId: chapterId ?? orderedChapters(item)[0]?.id ?? '', pageIndex: 0 };
    if (!target || !manifests.has(target.chapterId)) {
      setNotice('No verified demonstration pages are available for this chapter.');
      return;
    }
    // Keep the user's active direction when changing chapters inside the reader.
    if (screen.kind !== 'reader') setDirection(item.direction);
    updateLocation(target);
    setScreen({ kind: 'reader', id: item.id });
  }
  function move(delta: -1 | 1) {
    // A failed image must not be skipped or recorded as read via arrows/swipes.
    if (!entry || !location || !manifest || !pageReady) return;
    const next = stepReader(entry, manifests, location, delta);
    if (next) updateLocation(next);
    else setNotice(delta === 1 ? 'End of available chapters. No pages were skipped.' : 'Start of this series.');
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
  function goCatalogue() {
    exitImmersive();
    setScreen({ kind: 'catalogue' }); setNotice('');
  }
  function changeDemo(value: boolean) {
    exitImmersive();
    setDemo(value); setLocation(null); setNotice(''); setScreen({ kind: 'catalogue' });
    cache.current.clear(); setQuery(''); setTag(''); setCollection(''); setStatus('all');
  }
  const progressForEntry = entry ? restoreProgress(entry, manifests, progress[entry.id]) : null;

  return <div className={immersive && screen.kind === 'reader' ? 'app-shell reading-immersive' : 'app-shell'}>
    <a className="skip" href="#content">Skip to content</a>
    <header className="site-header">
      <button className="wordmark" type="button" onClick={goCatalogue} aria-label="Taiyou Manga home">
        <span className="sun-mark" aria-hidden="true">✺</span><span>TAIYOU <small>LIBRARY / MANGA</small></span>
      </button>
      <div className="header-right"><span className="demo-pill">LOCAL PROTOTYPE</span>
        <span className="network-state">{online ? 'Device online' : 'Device offline'}</span></div>
    </header>
    <main id="content" className="main-area">
      {screen.kind === 'catalogue' && <>
        <section className="hero">
          <div><p className="eyebrow">A PRIVATE READING SPACE / VOL. 01</p>
            <h1>Every story,<br /><em>a world to enter.</em></h1>
            <p className="hero-copy">An independent manga library designed around beautiful pages, quiet discovery and your place in every chapter.</p></div>
          <div className="hero-art" aria-hidden="true"><span className="hero-orbit orbit-one" /><span className="hero-orbit orbit-two" />
            <span className="hero-moon" /><span className="hero-art-label">THE ART OF TURNING PAGES</span></div>
        </section>
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
            <button className="book-card" type="button" key={item.id} onClick={()=>{setScreen({kind:'details',id:item.id});setNotice('');}}>
              <span className={'book-cover cover-'+(demoEntries.findIndex(d=>d.id===item.id)%3+1)}>
                <span className="cover-number">{String(index+1).padStart(2,'0')} / T</span>
                <span className="cover-illustration" aria-hidden="true"><i /><b /></span>
                <span className="cover-title">{item.title}</span><span className="cover-foot">ORIGINAL DEMONSTRATION</span>
              </span>
              <span className="book-details"><strong>{item.title}</strong>
                <span>{item.chapters.length} chapters <span aria-hidden="true">·</span> {item.publicationStatus}</span>
                <span className="book-micro">{item.rating ? '★ ' + item.rating + '/10 (sample)' : 'Not rated'} <span aria-hidden="true">↗</span></span>
              </span>
            </button>)}</div> :
            <div className="empty-state"><span className="empty-icon" aria-hidden="true">◇</span>
              <h3>{demo ? 'Nothing matches these filters' : 'Your collection is not connected yet'}</h3>
              <p>{demo ? 'Try a different search, genre, publication status or collection.' :
                'This is an honest empty state. No sign-in, private catalogue or storage integration is enabled.'}</p>
              {demo && <button className="secondary" type="button" onClick={()=>{setQuery('');setTag('');setStatus('all');setCollection('');}}>Clear filters</button>}
            </div>}
        </section>
      </>}
      {screen.kind === 'details' && entry && <>
        <button className="back" type="button" onClick={goCatalogue}>← Back to the shelf</button>
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
              <span><strong>{entry.direction.toUpperCase()}</strong> default mode</span></div>
            <div className="detail-actions"><button className="primary" onClick={()=>openChapter(entry,undefined,!!progressForEntry)}>
                {progressForEntry ? 'Continue reading' : 'Read from beginning'} <span aria-hidden="true">↗</span></button>
              {progressForEntry && <button className="secondary" onClick={()=>openChapter(entry,orderedChapters(entry)[0]?.id)}>Start from page one</button>}</div>
            <p className="fine-print">Sample-only progress remains in memory for this browser tab. It is cleared on refresh.</p>
          </div>
        </section>
        <section className="chapter-section"><div className="shelf-heading"><div><p className="eyebrow">CONTENTS / READING ORDER</p><h2>Chapters &amp; volumes</h2></div></div>
          {chapters.map((chapter,index)=><button type="button" className="chapter-row" key={chapter.id} onClick={()=>openChapter(entry,chapter.id)}>
            <span className="chapter-number">{String(index+1).padStart(2,'0')}</span><span className="chapter-title"><strong>{chapter.label}</strong><small>{chapter.volume ?? 'No volume'} · {chapter.pageCount ?? 'Unknown'} sample pages</small></span>
            <span className="chapter-open">Read ↗</span></button>)}
        </section>
      </>}
      {screen.kind === 'reader' && entry && location && <section className="reader-shell" ref={readerRef} tabIndex={0}
        onKeyDown={event=>{if (event.target !== event.currentTarget || direction === 'vertical') return; const delta=keyNavigation(direction,event.key);if(delta){event.preventDefault();move(delta);}}}
        aria-label="Manga reader">
        <div className="reader-topline">
          <button className="back" type="button" onClick={()=>{exitImmersive();setScreen({kind:'details',id:entry.id});setNotice('');}}>← Series details</button>
          <div className="reader-topline-actions">
            <button className="back" type="button" onClick={goCatalogue}>Shelf ↗</button>
            <button className="secondary focus-toggle" type="button" aria-pressed={immersive}
              onClick={()=>{void toggleImmersive();}}>{immersive ? 'Exit focus view' : 'Focus view'}</button>
          </div>
        </div>
        <div className="reader-controls">
          <div className="reader-heading"><h1>{entry.title}</h1><p>{activeChapter?.label ?? 'Unknown chapter'}</p></div>
          <div className="reader-options"><fieldset><legend>Reading direction</legend>
              {directions.map(option=><button type="button" key={option} className={direction===option?'chip active':'chip'}
                aria-pressed={direction===option} onClick={()=>{setDirection(option);setLoadedPageKey(null);setImageError(null);setNotice('');}}>
                {option==='rtl'?'Right to left':option==='ltr'?'Left to right':'Vertical'}</button>)}
            </fieldset>
            <div className="reader-selectors">
              <label>Choose chapter
                <select value={location.chapterId} onChange={event=>openChapter(entry,event.target.value)}>
                  {chapters.map(chapter=><option key={chapter.id} value={chapter.id}>{chapter.label}</option>)}</select>
              </label>
              {manifest && <label>Go to page
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
        {direction === 'vertical' && manifest ?
          <VerticalReader key={manifest.chapterId} manifest={manifest} activeIndex={location.pageIndex} jumpToken={jumpToken}
            onActivePage={index => setLocation(previous => previous?.chapterId === manifest.chapterId && previous.pageIndex === index
              ? previous : { chapterId: manifest.chapterId, pageIndex: index })}
            onViewedPage={index => {
              setLoadedPageKey(manifest.chapterId + ':' + index);
              markPageViewed(entry, { chapterId: manifest.chapterId, pageIndex: index });
            }} /> :
        <div className="reader-stage" onTouchStart={event=>{
          const start=event.touches[0];if(start)touch.current={x:start.clientX,y:start.clientY};
        }} onTouchEnd={event=>{
          const start=touch.current;const end=event.changedTouches[0];touch.current=null;
          if (!start || !end)return;
          const delta=swipeNavigation(direction,end.clientX-start.x,end.clientY-start.y);
          if(delta)move(delta);
        }} style={{touchAction:direction==='vertical'?'pan-x':'pan-y'}}>
          {manifest && displayedImage && !imageError ? <img key={location.chapterId + ':' + location.pageIndex} className="reader-page" src={displayedImage}
            alt={'Synthetic illustration, '+(activeChapter?.label??'chapter')+', page '+(location.pageIndex+1)}
            onLoad={()=>{
              setLoadedPageKey(activePageKey);
              markPageViewed(entry, location);
            }}
            onError={()=>setImageError('This sample page is unavailable. Retry rather than silently skipping it.')}
            decoding="async" /> : manifest && !imageError && !displayedImage ?
            <div className="page-error" role="status"><h2>Preparing sample page</h2>
              <p>Generating this original illustration locally.</p></div> :
            <div className="page-error" role="alert"><h2>Page unavailable</h2>
              <p>{imageError ?? 'No verified page image exists for this chapter.'}</p>
              <button className="secondary" type="button" onClick={()=>{cache.current.clear();setImageRetry(value=>value+1);}}>Retry page</button>
            </div>}
          <div className="page-stamp">{location.pageIndex+1} / {manifest?.pages.length ?? '?'}</div>
        </div>}
        <div className="page-navigation">
          <button className="secondary" type="button" disabled={!manifest || !pageReady} onClick={()=>move(-1)}>← Previous page</button>
          <p aria-live="polite">Page {location.pageIndex+1} of {manifest?.pages.length ?? '?'} <span aria-hidden="true">·</span> {activeChapter?.label}</p>
          <button className="primary" type="button" disabled={!manifest || !pageReady} onClick={()=>move(1)}>Next page →</button>
        </div>
        {notice && <p className="reader-notice" role="status">{notice}</p>}
        <p className="reader-hint">{direction === 'vertical' ? 'Scroll continuously through the chapter. Only nearby images are loaded.' : 'Use Previous / Next, swipe or focus the reader and use ← / → arrow keys.'}</p>
        <p className="fine-print">Offline: these pages are drawn locally. Private manga downloads and offline caching are not implemented.</p>
      </section>}
      {screen.kind !== 'catalogue' && !entry && <div className="empty-state" role="alert"><h2>Series unavailable</h2>
        <p>This series is no longer in the selected catalogue.</p><button className="secondary" onClick={goCatalogue}>Return to the shelf</button></div>}
      {notice && screen.kind !== 'reader' && <p className="reader-notice" role="status">{notice}</p>}
    </main>
    <footer className="site-footer"><span>TAIYOU / PERSONAL MANGA LIBRARY</span>
      <span>{demo ? 'Synthetic sample catalogue · No cloud sync' : 'No private catalogue connected'} · Independent of the hub</span></footer>
  </div>;
}
