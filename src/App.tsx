import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { entries as realEntries } from './data/catalogue';
import { fetchPrivateLibrary, type CloudRead } from './data/privateLibrary';
import { fetchPrivateChapter } from './data/privateMedia';
import { demoEntries, demoManifests, fixtureStatement } from './data/fixtures';
import { verifyOfflineChapter } from './data/offlineChapters';
import { OfflineChapterControl } from './components/OfflineChapterControl';
import { CollectionManager } from './components/CollectionManager';
import { LocalBackupControl } from './components/LocalBackupControl';
import { MangaCloudMenu } from './components/MangaCloudMenu';
import { MangaBrandMark } from './components/MangaBrandMark';
import { MangaOwnerTools } from './components/MangaOwnerTools';
import { SearchIcon, HashIcon, LibraryIcon, ChevronDownIcon } from './components/SharedLibraryIcons';
import { MangaThemeSwatches } from './components/MangaThemeSwatches';
import { VerticalReader } from './components/VerticalReader';
import { CATALOGUE_SECTIONS, parseAppRoute, routeHref, type AppRoute, type CatalogueSection } from './domain/routes';
import { loadShelves, saveShelf, type PersonalShelf, type ShelfSelection } from './domain/personalShelves';
import { collectionBreadcrumb, loadCollections, saveCollections, setCollectionMembership,
  type CollectionState } from './domain/personalCollections';
import { addPersonalTag, loadAnnotations, saveAnnotation, type AnnotationPatch,
  type PersonalAnnotation } from './domain/personalAnnotations';
import { defaultReaderPreferences, laterProgress, loadAllProgress, loadPreferences, loadProgress,
  nextProgressTimestamp, savePreferences, saveProgress, type ReaderPreferences } from './domain/localReaderStorage';
import { filterCatalogue, type SortMode } from './domain/filters';
import { applyAdvancedDiscovery, computeLocalReadingAnalytics, defaultAdvancedCriteria,
  type AdvancedCriteria } from './domain/advancedDiscovery';
import { orderedChapters, restoreProgress, stepChapter, type ReaderLocation } from './domain/reader';
import type { ChapterManifest, MangaEntry, MangaProgress, PublicationStatus } from './domain/types';
import './styles.css';
import './editorial.css';
import './novel-parity.css';

/** These ribbons describe publication status, never the reader's Finished shelf. */
const publicationCaption:Record<PublicationStatus,string>={
  completed:'Story Complete',ongoing:'Updating',hiatus:'On Hiatus',unknown:'Unknown',
};
type Screen = { kind: 'catalogue'; section: CatalogueSection } | { kind: 'details' | 'reader'; id: string } | { kind: 'not-found' };
function currentBrowserRoute(): AppRoute {
  return typeof window === 'undefined' ? { kind: 'home' } :
    parseAppRoute(window.location.pathname, window.location.search, import.meta.env.BASE_URL);
}
/** Keep catalogue filters bookmarkable, but never include private notes or rating data. */
function readCatalogueQuery() {
  const params=typeof window==='undefined'?new URLSearchParams():new URLSearchParams(window.location.search);
  const status=params.get('status')??'all';
  const sort=params.get('sort')??'title';
  return {
    query:(params.get('q')??'').slice(0,150),
    tag:(params.get('tag')??'').slice(0,80),
    collection:(params.get('collection')??'').slice(0,150),
    status:(['all','unknown','ongoing','completed','hiatus'].includes(status)?status:'all') as PublicationStatus|'all',
    sort:(['title','rating','chapters'].includes(sort)?sort:'title') as SortMode,
  };
}

/** Advanced filters are query-string values, never stored user annotations. */
function readAdvancedQuery():AdvancedCriteria {
  const params=typeof window==='undefined'?new URLSearchParams():new URLSearchParams(window.location.search);
  const numeric=(key:string,lowest:number,highest:number)=>{
    const raw=params.get(key);
    if(raw===null||!/^\d{1,5}$/.test(raw))return null;
    const value=Number(raw);return value>=lowest&&value<=highest?value:null;
  };
  const reading=params.get('reading');
  const offline=params.get('offline');
  return {
    creator:(params.get('creator')??'').slice(0,100),
    minChapters:numeric('minChapters',0,10000),
    maxChapters:numeric('maxChapters',0,10000),
    minPersonalRating:numeric('minRating',1,10),
    readingState: (['reading','trying','finished','to-read','unstarted'].includes(reading??'') ? reading : 'any') as AdvancedCriteria['readingState'],
    offlineState: (['downloaded','not-downloaded'].includes(offline??'') ? offline : 'any') as AdvancedCriteria['offlineState'],
  };
}
export default function App({ initialDemo = true }: { initialDemo?: boolean } = {}) {
  const initialRoute = useMemo(currentBrowserRoute, []);
  const initialFilters = useMemo(readCatalogueQuery, []);
  const [demo, setDemo] = useState(initialDemo);
  const [remoteEntries, setRemoteEntries] = useState<MangaEntry[]>([]);
  const [privateManifests, setPrivateManifests] = useState<ReadonlyMap<string,ChapterManifest>>(()=>new Map());
  const [privateRevision, setPrivateRevision] = useState('');
  const [chapterLoading, setChapterLoading] = useState<string | null>(null);
  const [chapterLimit, setChapterLimit] = useState(25);
  const chapterOpenRequest = useRef(0);
  const [cloud, setCloud] = useState<CloudRead | {status:'checking';message:string}>({
    status:'checking',message:'Checking private library connection…',
  });
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
  const [query, setQuery] = useState(initialRoute.kind==='library'?initialFilters.query:'');
  const [status, setStatus] = useState<PublicationStatus | 'all'>(initialRoute.kind==='library'?initialFilters.status:'all');
  const [tag, setTag] = useState(initialRoute.kind==='library'?initialFilters.tag:'');
  const [collection, setCollection] = useState(initialRoute.kind==='library'?initialFilters.collection:'');
  const [sort, setSort] = useState<SortMode>(initialRoute.kind==='library'?initialFilters.sort:'title');
  const [advanced, setAdvanced] = useState<AdvancedCriteria>(() =>
    initialRoute.kind==='library'?readAdvancedQuery():defaultAdvancedCriteria());
  const [advancedOpen, setAdvancedOpen] = useState(() => {
    const current=readAdvancedQuery();
    return Object.entries(current).some(([key,value])=>value!==null&&value!==''&&value!=='any'&&
      key!=='unused');
  });
  const [chapterQuery, setChapterQuery] = useState('');
  const [compactNav, setCompactNav] = useState(() => typeof window !== 'undefined' &&
    window.matchMedia?.('(max-width: 740px)').matches || false);
  const [personalShelves, setPersonalShelves] = useState<Record<string, PersonalShelf>>(() =>
    loadShelves(initialDemo ? demoEntries : realEntries).shelves);
  const [collections, setCollections] = useState<CollectionState>(() => {
    const read=loadCollections();return read.status==='ok' ? read.value : {
      schemaVersion:1,mediaKind:'manga',revision:0,items:[],
    };
  });
  const [confirmMembershipRemoval, setConfirmMembershipRemoval] =
    useState<{collectionId:string;mangaId:string}|null>(null);
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
  const catalogue = demo ? demoEntries : remoteEntries;
  const manifests: ReadonlyMap<string, ChapterManifest> = demo ? demoManifests : privateManifests;
  const entry = screen.kind === 'reader' || screen.kind === 'details' ? catalogue.find(item => item.id === screen.id) : undefined;
  const manifest = location ? manifests.get(location.chapterId) : undefined;
  const chapters = entry ? orderedChapters(entry) : [];
  const matchingChapters=chapters.filter(chapter=>
    chapter.label.toLocaleLowerCase().includes(chapterQuery.toLocaleLowerCase()));
  const visibleChapters=matchingChapters.slice(0,chapterLimit);
  const activeChapter = chapters.find(chapter => chapter.id === location?.chapterId);
  const allTags = [...new Set(catalogue.flatMap(item =>
    [...item.tags, ...(annotations[item.id]?.tags ?? [])]))].sort((a,b)=>a.localeCompare(b));
  const allCollections = [...new Set(catalogue.flatMap(item => item.collections ?? []))].sort();
  const sortedPersonalCollections = [...collections.items].sort((a,b)=>
    collectionBreadcrumb(collections,a.id).localeCompare(collectionBreadcrumb(collections,b.id)));
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

  const filtered = useMemo(() => {
    const personalId=collection.startsWith('personal:')?collection.slice('personal:'.length):null;
    const builtInCollection=personalId?'':collection;
    return filterCatalogue(catalogue, query, status, '', builtInCollection, sort)
      .filter(item => (!tag || [...item.tags,...(annotations[item.id]?.tags ?? [])]
        .some(value => value.toLocaleLowerCase('en') === tag.toLocaleLowerCase('en'))) &&
        (!personalId || collections.items.some(folder=>
          folder.id===personalId && folder.mangaIds.includes(item.id))));
  }, [catalogue, query, status, tag, collection, sort, annotations, collections]);
  const contextForDiscovery={progress,shelves:personalShelves,annotations,offlineChapterIds};
  const advancedResults=useMemo(() => applyAdvancedDiscovery(filtered,advanced,{
    progress,shelves:personalShelves,annotations,offlineChapterIds,
  }),[filtered,advanced,progress,personalShelves,annotations,offlineChapterIds]);
  const analytics=computeLocalReadingAnalytics(catalogue,contextForDiscovery);
  const offlineSeries = catalogue.filter(item => item.chapters.some(chapter => offlineChapterIds.has(chapter.id)));
  const displayed = screen.kind === 'catalogue' ? (() => {
    const items = (screen.section==='library'?advancedResults:filtered)
      .filter(item => onShelf(item, screen.section));
    // Home is curated by this device's favourites; All Manga stays alphabetical.
    return screen.section==='home' ? [...items].sort((a,b)=>
      Number(!!annotations[b.id]?.favourite)-Number(!!annotations[a.id]?.favourite)).slice(0,4) : items;
  })() : filtered;
  const continueReading = catalogue
    .map(item => ({ item, saved: progress[item.id], resume: restoreProgress(item, manifests, progress[item.id]) }))
    .filter((value): value is { item: MangaEntry; saved: MangaProgress; resume: ReaderLocation } =>
      value.saved !== undefined && value.resume !== null)
    .sort((a, b) => Date.parse(b.saved.updatedAt) - Date.parse(a.saved.updatedAt))
    .slice(0, 4);

  useEffect(() => {
    const controller = new AbortController();
    let live = true;
    const oauthFailure = new URL(window.location.href).searchParams.get('oauth_error');
    void fetchPrivateLibrary(controller.signal).then(result => {
      if (!live) return;
      setCloud(oauthFailure && result.status!=='connected'
        ? {...result,message:'Hugging Face sign-in was not completed (' + oauthFailure.slice(0,40) + '). Please try again.'}
        : result);
      if (result.status==='connected') {
        setRemoteEntries([...result.entries]);
        setDemo(false);
        setPersonalShelves(loadShelves(result.entries).shelves);
        setAnnotations(loadAnnotations(result.entries).annotations);
        setProgress(loadAllProgress(result.entries,new Map()).progress);
        setScreen(previous=>previous.kind==='catalogue'?previous:{kind:'catalogue',section:'home'});
      }
    }).catch(() => { if (live) setCloud({status:'unavailable',message:'Unable to reach private library.'}); });
    return () => { live=false; controller.abort(); };
  }, []);
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
    const onStorageCollections=(event:StorageEvent)=>{
      if(event.key===null||event.key==='taiyou-manga:personal-collections:v1') {
        const result=loadCollections();
        if(result.status==='ok')setCollections(result.value);
        else setStorageNotice('Collection storage is damaged or unavailable; existing data was preserved.');
      }
    };
    window.addEventListener('storage',onStorageCollections);
    return ()=>window.removeEventListener('storage',onStorageCollections);
  }, []);
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
    const onBackForward = () => {
      const filters=readCatalogueQuery();
      setQuery(filters.query);setTag(filters.tag);setCollection(filters.collection);
      setStatus(filters.status);setSort(filters.sort);
      const nextAdvanced=readAdvancedQuery();
      setAdvanced(nextAdvanced);
      setAdvancedOpen(Object.values(nextAdvanced).some(value=>
        value!==null&&value!==''&&value!=='any'));
      applyRoute(currentBrowserRoute());
    };
    window.addEventListener('popstate', onBackForward);
    return () => window.removeEventListener('popstate', onBackForward);
  }, [screen, demo]);
  useEffect(() => {
    if(screen.kind!=='catalogue'||screen.section!=='library')return;
    const params=new URLSearchParams();
    if(query)params.set('q',query);
    if(tag)params.set('tag',tag);
    if(collection)params.set('collection',collection);
    if(status!=='all')params.set('status',status);
    if(sort!=='title')params.set('sort',sort);
    if(advanced.creator)params.set('creator',advanced.creator);
    if(advanced.minChapters!==null)params.set('minChapters',String(advanced.minChapters));
    if(advanced.maxChapters!==null)params.set('maxChapters',String(advanced.maxChapters));
    if(advanced.minPersonalRating!==null)params.set('minRating',String(advanced.minPersonalRating));
    if(advanced.readingState!=='any')params.set('reading',advanced.readingState);
    if(advanced.offlineState!=='any')params.set('offline',advanced.offlineState);
    const suffix=params.toString();
    const url=routeHref({kind:'library'},import.meta.env.BASE_URL)+(suffix?'?'+suffix:'');
    if(window.location.pathname+window.location.search!==url)
      window.history.replaceState(null,'',url);
  }, [screen,query,tag,collection,status,sort,advanced]);
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
  async function openChapter(item: MangaEntry, chapterId?: string, resume = false) {
    if (demo) {
      const target = resume ? restoreProgress(item,manifests,progress[item.id]) :
        {chapterId:chapterId ?? orderedChapters(item)[0]?.id ?? '',pageIndex:0};
      if (!target || !manifests.has(target.chapterId)) {
        setNotice('No verified pages are available for this chapter yet.');
        return;
      }
      navigateTo({kind:'reader',mangaId:item.id,chapterId:target.chapterId,pageIndex:target.pageIndex});
      return;
    }
    const selected=chapterId ?? (resume ? progress[item.id]?.chapterId : undefined) ?? orderedChapters(item)[0]?.id ?? '';
    if (!item.chapters.some(chapter=>chapter.id===selected)) {
      setNotice('This chapter is not in your private library.');
      return;
    }
    const operation=++chapterOpenRequest.current;
    setChapterLoading(selected);
    setNotice('');
    try{
      const existing=privateManifests.get(selected);
      const loaded=existing && privateRevision ?
        {manifest:existing,revision:privateRevision} :
        await fetchPrivateChapter(item.id,selected);
      if(operation!==chapterOpenRequest.current)return;
      const next=new Map(privateRevision===loaded.revision?privateManifests:new Map());
      next.set(selected,loaded.manifest);
      setPrivateManifests(next);
      setPrivateRevision(loaded.revision);
      const local=loadProgress(item,next);
      const saved=laterProgress(progress[item.id],local.status==='ok'?local.value:undefined);
      const index=resume && saved?.chapterId===selected ?
        Math.max(0,loaded.manifest.pages.findIndex(page=>page.id===saved.pageId)) : 0;
      setLocation({chapterId:selected,pageIndex:index});
      setJumpToken(value=>value+1);
      setScreen({kind:'reader',id:item.id});
      const url=routeHref({kind:'reader',mangaId:item.id,chapterId:selected,pageIndex:index},import.meta.env.BASE_URL);
      if(window.location.pathname+window.location.search!==url)window.history.pushState(null,'',url);
    }catch(error){
      if(operation===chapterOpenRequest.current)
        setNotice(error instanceof Error?error.message:'Could not load the private chapter.');
    }finally{
      if(operation===chapterOpenRequest.current)setChapterLoading(null);
    }
  }
  function move(delta: -1 | 1) {
    if (!entry || !location || !manifest) return;
    if(!demo){
      const ordered=orderedChapters(entry);
      const next=ordered[ordered.findIndex(ch=>ch.id===location.chapterId)+delta];
      if(next)void openChapter(entry,next.id);
      else setNotice(delta===1?'You have reached the final chapter.':'You are at the first chapter.');
      return;
    }
    const next=stepChapter(entry,manifests,location,delta);
    if(next)updateLocation(next);
    else setNotice(delta===1?'You have reached the final chapter.':'You are at the first chapter.');
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
  async function disconnectCloud() {
    try {
      const result=await fetch('/api/auth/logout',{
        method:'POST',credentials:'same-origin',cache:'no-store',
        headers:{'X-Taiyou-Request':'logout'},
      });
      if(!result.ok)throw Error('logout failed');
      setCloud({status:'disconnected',message:'Signed out of your private Hugging Face library.'});
      setRemoteEntries([]);
      setPrivateManifests(new Map());setPrivateRevision('');
      changeDemo(true);
    } catch {setStorageNotice('Could not sign out. Check your connection and try again.');}
  }
  function changeDemo(value: boolean) {
    ++chapterOpenRequest.current;setChapterLoading(null);
    exitImmersive();
    setDemo(value); setLocation(null); setNotice(''); goCatalogue('home');
    if(value){setPrivateManifests(new Map());setPrivateRevision('');}
    setChapterLimit(25);setChapterQuery('');
    setPersonalShelves(loadShelves(value ? demoEntries : remoteEntries).shelves);
    setAnnotations(loadAnnotations(value ? demoEntries : remoteEntries).annotations);
    setQuery(''); setTag(''); setCollection(''); setStatus('all');
    setAdvanced(defaultAdvancedCriteria());setAdvancedOpen(false);
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
  function commitCollections(next:CollectionState,message:string):boolean {
    const result=saveCollections(next,collections.revision);
    if(result.status==='ok') {
      setCollections(result.value);
      setShelfNotice(message);
      if(collection.startsWith('personal:') && !result.value.items.some(item=>
        item.id===collection.slice('personal:'.length)))setCollection('');
      return true;
    }
    if(result.status==='stale') {
      const fresh=loadCollections();
      if(fresh.status==='ok')setCollections(fresh.value);
    }
    setStorageNotice(result.status==='stale' ?
      'Collections changed in another tab. Review the refreshed list and try again.' :
      result.status==='invalid' ?
      'Saved collections are invalid and were preserved for recovery.' :
      'Browser storage is unavailable or full; collection changes were not saved.');
    return false;
  }
  function updateMembership(item:MangaEntry,collectionId:string,add:boolean):void {
    try {
      const next=setCollectionMembership(collections,collectionId,item.id,add);
      if(commitCollections(next,add?'Added manga to collection':'Removed manga from collection'))
        setConfirmMembershipRemoval(null);
    } catch(e) {
      setStorageNotice(e instanceof Error?e.message:'Collection membership could not be changed.');
    }
  }
  function filterPersonalCollection(collectionId:string) {
    setCollection('personal:'+collectionId);
    setTag('');
    goCatalogue('library');
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
  function toggleChapterComplete(item: MangaEntry, chapterId: string) {
    // Explicit reader choice, not an automatic consequence of opening a page.
    if (!item.chapters.some(chapter => chapter.id === chapterId)) {
      setStorageNotice('This chapter is not part of the selected manga.');
      return;
    }
    const existing = annotations[item.id]?.completedChapterIds ?? [];
    const done = existing.includes(chapterId);
    changeAnnotation(item, {completedChapterIds: done ?
      existing.filter(id=>id!==chapterId) : [...existing,chapterId]},
      done ? 'Chapter marked incomplete' : 'Chapter marked completed');
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
      <div className="manga-topbar">
        <a className="wordmark" href={routeHref({kind:'home'},import.meta.env.BASE_URL)}
          onClick={event=>followLink(event,()=>goCatalogue('home'))} aria-label="Taiyou Manga home">
          <span className="manga-logo-frame"><MangaBrandMark theme={preferences.theme} size={36}/></span>
          <span className="manga-wordmark-text"><strong>TAIYOU'S</strong><small>PERSONAL MANGA LIBRARY</small></span>
        </a>
        <MangaCloudMenu cloud={cloud} online={online} demo={demo} count={remoteEntries.length}
          onSample={()=>changeDemo(true)} onPrivate={()=>changeDemo(false)}
          onLogout={()=>{void disconnectCloud();}}>
          <LocalBackupControl entries={catalogue} manifests={manifests}
            onRestored={()=>{
              setProgress(loadAllProgress(catalogue, manifests).progress);
              setPersonalShelves(loadShelves(catalogue).shelves);
              setAnnotations(loadAnnotations(catalogue).annotations);
              const restoredCollections=loadCollections();
              if(restoredCollections.status==='ok')setCollections(restoredCollections.value);
              const saved=loadPreferences();
              if(saved.status==='ok')setPreferences(saved.value);
            }} />
        </MangaCloudMenu>
        <div className="manga-top-actions">
          <label className="manga-global-search">
            <SearchIcon size={16}/>
            <input type="search" aria-label="Search all manga" placeholder="Search all manga…"
              value={query} onChange={event=>{
                setQuery(event.target.value);
                if(screen.kind!=='catalogue'||screen.section!=='library')goCatalogue('library');
              }}/>
          </label>
          <button type="button" className="manga-advanced-button" aria-label="Advanced search"
            title="Advanced search" aria-expanded={advancedOpen&&selectedSection==='library'}
            onClick={()=>{setAdvancedOpen(value=>!value);goCatalogue('library');}}>
            <SearchIcon size={17}/>
          </button>
          <MangaThemeSwatches value={preferences.theme}
            onChange={theme=>updatePreferences({...preferences,theme})}/>
        </div>
      </div>
      <nav className="site-nav" aria-label="Main navigation">
        <div className="manga-nav-links">
          {currentNav.map(section=>
            <a key={section} className="site-nav-link"
              aria-label={['reading','trying','offline','finished','to-read'].includes(section)
                ? labels[section]+' ('+counts[section]+')' : labels[section]}
              aria-current={selectedSection===section?'page':undefined}
              href={routeHref({kind:section},import.meta.env.BASE_URL)}
              onClick={event=>followLink(event,()=>goCatalogue(section))}>
              <span className="manga-nav-desktop">{labels[section]}</span>
              <span className="manga-nav-mobile">{section==='reading'?'Reading':section==='trying'?'Trying':
                section==='offline'?'Offline':labels[section]}</span>
              {['reading','trying','offline','finished','to-read'].includes(section)&&
                <span className="nav-count">{counts[section]}</span>}
            </a>)}
          {compactNav&&<details className="nav-more"><summary>More</summary>
            <div className="nav-more-menu">{moreNav.map(section=>
              <a key={section} className="site-nav-link"
                aria-current={selectedSection===section?'page':undefined}
                href={routeHref({kind:section},import.meta.env.BASE_URL)}
                onClick={event=>followLink(event,()=>goCatalogue(section))}>{labels[section]}</a>)}
            </div>
          </details>}
        </div>
        <div className="manga-nav-tools">
          <details className="header-menu"><summary><HashIcon size={15}/> Tags <ChevronDownIcon size={13}/></summary>
            <div className="header-menu-content">
              <button type="button" onClick={event=>{setTag('');goCatalogue('library');event.currentTarget.closest('details')?.removeAttribute('open');}}>All tags</button>
              {allTags.map(value=><button type="button" key={value}
                onClick={event=>{jumpToFilter('tag',value);event.currentTarget.closest('details')?.removeAttribute('open');}}>{value}</button>)}
            </div>
          </details>
          <details className="header-menu"><summary><LibraryIcon size={15}/> Collections <ChevronDownIcon size={13}/></summary>
            <div className="header-menu-content">
              <button type="button" onClick={event=>{setCollection('');goCatalogue('library');event.currentTarget.closest('details')?.removeAttribute('open');}}>All collections</button>
              {sortedPersonalCollections.map(folder=><button type="button" key={folder.id}
                onClick={event=>{filterPersonalCollection(folder.id);event.currentTarget.closest('details')?.removeAttribute('open');}}>
                {collectionBreadcrumb(collections,folder.id)}</button>)}
              {allCollections.map(name=><button type="button" key={'source:'+name}
                onClick={event=>{jumpToFilter('collection',name);event.currentTarget.closest('details')?.removeAttribute('open');}}>{name} (source)</button>)}
            </div>
          </details>
          <MangaOwnerTools connected={cloud.status==='connected'}
            owner={cloud.status==='connected'?cloud.owner:undefined}
            openPrivate={()=>changeDemo(false)}/>
        </div>
      </nav>
    </header>
    <main id="content" className="main-area">
      {screen.kind === 'catalogue' && <>
        {screen.section === 'home' && <section className="hero editorial-hero" aria-label="Library introduction">
          <div className="editorial-hero-intro">
            <p className="eyebrow">{demo ? 'THE READING ROOM / DEMONSTRATION' : 'YOUR PRIVATE MANGA LIBRARY'}</p>
            <h1>A place for <em>every story.</em></h1>
            <p className="hero-copy">{demo
              ? 'An illustrated glimpse of the manga reader. Your own shelves live in the private library.'
              : cloud.status==='connected'
                ? catalogue.length
                  ? 'Your collection, reading journey and favourite discoveries, in one quiet space.'
                  : 'Your private shelves are ready. The stories you add will have a home here.'
                : 'Your personal manga library, ready for the stories you choose to keep.'}</p>
            <div className="editorial-hero-actions">
              <a className="primary editorial-primary-link"
                href={routeHref({kind:'library'},import.meta.env.BASE_URL)}
                onClick={event=>followLink(event,()=>goCatalogue('library'))}>Explore the collection <span aria-hidden="true">↗</span></a>
              {demo && cloud.status==='connected' &&
                <button type="button" className="secondary editorial-secondary-action"
                  onClick={()=>changeDemo(false)}>Go to my private library</button>}
            </div>
          </div>
          <div className={'editorial-hero-art' + (catalogue.length ? ' has-books' : ' is-empty')} aria-hidden="true">
            {catalogue.length ? <div className="editorial-book-stack">
              {catalogue.slice(0,3).map((item,index)=>
                <div className={'editorial-display-book book-'+index} key={item.id}>
                  <span className="editorial-book-glyph">✦</span>
                  <span className="editorial-book-title">{item.title}</span>
                  <span className="editorial-book-maker">{item.creators[0] || 'TAIYOU LIBRARY'}</span>
                </div>)}
            </div> : <div className="editorial-empty-plate">
              <span className="editorial-plate-icon">✦</span>
              <span>TAIYOU'S MANGA LIBRARY</span>
              <strong>Your next chapter belongs here.</strong>
              <small>PRIVATE · PERSONAL · YOURS</small>
            </div>}
            <span className="editorial-art-caption">{demo?'A GLIMPSE INTO THE READER':'THE PERSONAL ARCHIVE'}</span>
          </div>
        </section>}
        {screen.section === 'home' && <section className="editorial-overview" aria-label="Your library at a glance">
          <div><strong>{catalogue.length}</strong><span>{catalogue.length===1?'Series':'Series'} in the library</span></div>
          <div><strong>{counts.reading}</strong><span>Currently reading</span></div>
          <div><strong>{counts.finished}</strong><span>Personally finished</span></div>
          <div><strong>{offlineChapterIds.size}</strong><span>Chapters saved offline</span></div>
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
          <p>Only your saved device-local reading positions, personal shelves and ratings. No invented reading duration,
            historical streaks or external tracking.</p>
          <div className="analytics-grid">
            <div><strong>{analytics.started}</strong><span>Series with saved reading progress</span></div>
            <div><strong>{analytics.reading}</strong><span>Currently reading</span></div>
            <div><strong>{analytics.finished}</strong><span>Personally finished</span></div>
            <div><strong>{analytics.toRead}</strong><span>To Be Read</span></div>
            <div><strong>{analytics.trying}</strong><span>Trying Out</span></div>
            <div><strong>{analytics.downloadedChapters}</strong><span>Offline chapters in {analytics.offlineSeries} series</span></div>
            <div><strong>{analytics.avgRating??'–'}</strong><span>Average personal rating / 10 ({analytics.rated} rated)</span></div>
            <div><strong>{analytics.total}</strong><span>Catalogue series</span></div>
          </div>
          <div className="analytics-detail-grid">
            <section className="analytics-recent">
              <h2>Recently saved positions</h2>
              {analytics.recent.length ? <ul>{analytics.recent.slice(0,8).map(item=>
                <li key={item.mangaId}>
                  <a href={routeHref({kind:'details',mangaId:item.mangaId},import.meta.env.BASE_URL)}
                    onClick={event=>followLink(event,()=>navigateTo({kind:'details',mangaId:item.mangaId}))}>
                    <strong>{item.title}</strong></a>
                  <span>{item.chapter} · Page {item.page}</span>
                  <time dateTime={item.savedAt}>{new Date(item.savedAt).toLocaleDateString('en-GB')}</time>
                </li>)}</ul> :
                <p>No saved reading positions on this device yet.</p>}
            </section>
            <section className="analytics-genres">
              <h2>Genres in currently reading</h2>
              {analytics.genres.length ? <ul>{analytics.genres.slice(0,8).map(item=>
                <li key={item.name}><span>{item.name}</span><strong>{item.count}</strong></li>)}</ul> :
                <p>Start reading a series to see its genres.</p>}
            </section>
            <section className="analytics-ratings">
              <h2>My ratings distribution</h2>
              {analytics.rated ? <div className="ratings-histogram">
                {analytics.ratingsDistribution.map(item=><div key={item.score}
                  className="rating-column" aria-label={item.score+' out of 10: '+item.count+' manga'}>
                  <span>{item.count||''}</span><div className="rating-bar" style={{height:(item.count/analytics.rated*100)+'%'}} />
                  <small>{item.score}</small>
                </div>)}
              </div> : <p>Rate manga on its details page to see your distribution.</p>}
            </section>
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
        <section className="shelf" aria-label="Manga catalogue">
          <div className="shelf-heading"><div><p className="eyebrow">DISCOVER / THE SHELF</p>
              <h2>{screen.section === 'home' ? (demo ? 'The sample collection' : 'Your collection') : labels[screen.section]}</h2>
            </div><p>{displayed.length} {displayed.length === 1 ? 'series' : 'series'} shown</p></div>
          {screen.section!=='home' && <div className="toolbar">
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
              <select value={collection} onChange={e=>setCollection(e.target.value)}>
                <option value="">All collections</option>
                <optgroup label="My collections">
                  {sortedPersonalCollections.map(item=><option key={item.id} value={'personal:'+item.id}>
                    {collectionBreadcrumb(collections,item.id)}</option>)}
                </optgroup>
                <optgroup label="Imported collection labels">
                  {allCollections.map(value=><option key={value} value={value}>{value}</option>)}
                </optgroup>
              </select></label>
            <label>Sort
              <select value={sort} onChange={e=>setSort(e.target.value as SortMode)}>
                <option value="title">Title A to Z</option><option value="rating">Rating</option><option value="chapters">Chapter count</option>
              </select></label>
          </div>}
          {screen.section==='library' && <>
            {advancedOpen && <section className="advanced-search" aria-label="Advanced manga search">
              <div className="shelf-heading"><h3>Advanced Search</h3>
                <button className="secondary" type="button" onClick={()=>setAdvancedOpen(false)}>Close</button></div>
              <div className="advanced-fields">
                <label>Creator
                  <input type="search" value={advanced.creator} maxLength={100} placeholder="Search creator"
                    onChange={event=>setAdvanced(previous=>({...previous,creator:event.target.value}))}/>
                </label>
                <label>Minimum chapters
                  <input type="number" min={0} max={10000} value={advanced.minChapters??''}
                    onChange={event=>setAdvanced(previous=>({...previous,minChapters:event.target.value===''?
                      null:Number(event.target.value)}))}/>
                </label>
                <label>Maximum chapters
                  <input type="number" min={0} max={10000} value={advanced.maxChapters??''}
                    onChange={event=>setAdvanced(previous=>({...previous,maxChapters:event.target.value===''?
                      null:Number(event.target.value)}))}/>
                </label>
                <label>Minimum personal rating
                  <select value={advanced.minPersonalRating??''}
                    onChange={event=>setAdvanced(previous=>({...previous,minPersonalRating:event.target.value===''?
                      null:Number(event.target.value)}))}>
                    <option value="">Any personal rating</option>
                    {Array.from({length:10},(_,i)=>i+1).map(value=><option key={value} value={value}>{value} / 10 or higher</option>)}
                  </select>
                </label>
                <label>My reading state
                  <select value={advanced.readingState}
                    onChange={event=>setAdvanced(previous=>({...previous,readingState:event.target.value as AdvancedCriteria['readingState']}))}>
                    <option value="any">Any reading state</option>
                    <option value="reading">Currently Reading</option><option value="trying">Trying Out</option>
                    <option value="finished">Finished</option><option value="to-read">To Be Read</option>
                    <option value="unstarted">No saved progress</option>
                  </select>
                </label>
                <label>Offline availability
                  <select value={advanced.offlineState}
                    onChange={event=>setAdvanced(previous=>({...previous,offlineState:event.target.value as AdvancedCriteria['offlineState']}))}>
                    <option value="any">Any availability</option><option value="downloaded">Has offline chapters</option>
                    <option value="not-downloaded">No offline chapters</option>
                  </select>
                </label>
              </div>
              {advanced.minChapters!==null&&advanced.maxChapters!==null&&
                advanced.minChapters>advanced.maxChapters &&
                <p role="alert" className="advanced-warning">Minimum chapters must not exceed maximum chapters.</p>}
              <div className="advanced-actions">
                <p>{displayed.length} series match your current filters</p>
                <button className="secondary" type="button"
                  onClick={()=>setAdvanced(defaultAdvancedCriteria())}>Reset advanced filters</button>
              </div>
            </section>}
            <CollectionManager state={collections}
              onCommit={commitCollections} onFilter={filterPersonalCollection}/>
          </>}
          {displayed.length ? <div className="book-grid">{displayed.map((item, index) =>
            <a className="book-card" key={item.id} href={routeHref({kind:'details',mangaId:item.id},import.meta.env.BASE_URL)}
              onClick={event=>followLink(event,()=>navigateTo({kind:'details',mangaId:item.id}))}>
              <span className={'book-cover cover-'+(demoEntries.findIndex(d=>d.id===item.id)%3+1)}>
                {item.publicationStatus !== 'unknown' &&
                  <span className={'status-ribbon status-'+item.publicationStatus}
                    aria-label={'Publication: '+publicationCaption[item.publicationStatus]}>
                    {publicationCaption[item.publicationStatus]}</span>}
                <span className="cover-number">TAIYOU / {String(index+1).padStart(2,'0')}</span>
                <span className="cover-illustration" aria-hidden="true"><i /><b /></span>
                <span className="cover-title">{item.title}</span>
                <span className="cover-creator">{item.creators[0] || 'UNKNOWN CREATOR'}</span>
                <span className="cover-foot">{demo?'READER DEMONSTRATION':'YOUR PRIVATE ARCHIVE'}</span>
              </span>
              <span className="book-details"><strong>{item.title}</strong>
                {annotations[item.id]?.favourite && <span className="book-favourite">★ Favourite</span>}
                <span className="book-author">{item.creators.join(', ') || 'Creator unknown'}</span>
                <span className="book-tags" aria-label="Genres">{item.tags.slice(0,3).map(value=>
                  <span key={value} className="book-tag">{value}</span>)}
                  {item.tags.length>3&&<span className="book-tag book-tag-extra">+{item.tags.length-3}</span>}
                </span>
                <span className="book-chapter-count">{item.chapters.length} chapters</span>
                {progress[item.id] && restoreProgress(item,manifests,progress[item.id]) &&
                  <span className="book-progress">In progress · Chapter {orderedChapters(item)
                    .findIndex(chapter=>chapter.id===progress[item.id]!.chapterId) + 1} of {item.chapters.length}</span>}
                {collections.items.some(folder=>folder.mangaIds.includes(item.id)) &&
                  <span className="book-collection">In {collections.items.filter(folder=>
                    folder.mangaIds.includes(item.id)).length} personal collection(s)</span>}
                <span className="book-micro"><span>{annotations[item.id]?.rating
                  ? '★ '+annotations[item.id]!.rating+'/10 · Mine'
                  : item.rating ? '★ '+item.rating+'/10 · Source' : 'Explore series'}</span>
                  <span aria-hidden="true">↗</span></span>
              </span>
            </a>)}</div> :
            <div className="empty-state"><span className="empty-icon" aria-hidden="true">◇</span>
              <h3>{demo ? (screen.section === 'home' || screen.section === 'library' ?
                'Nothing matches these filters' : 'No manga in ' + labels[screen.section] + ' yet') : cloud.status==='connected' ? 'Your private library is empty' : 'Your collection is not connected yet'}</h3>
              <p>{demo ? 'Change a personal shelf on a manga details page, or try different filters.' :
                cloud.status==='connected'
                  ? 'Your private dataset is connected, but no manga are listed yet.'
                  : 'Sign in with Hugging Face to connect your private manga library.'}</p>
              {demo && <button className="secondary" type="button" onClick={()=>{setQuery('');setTag('');setStatus('all');setCollection('');}}>Clear filters</button>}
            </div>}
        </section></>}
      </>}
      {screen.kind === 'details' && entry && <>
        <a className="back" href={routeHref({kind:'library'},import.meta.env.BASE_URL)}
          onClick={event=>followLink(event,()=>goCatalogue())}>← Back to the shelf</a>
        <section className="series-detail">
          <div className={'detail-cover cover-'+(demoEntries.findIndex(d=>d.id===entry.id)%3+1)} aria-hidden="true">
            {entry.publicationStatus !== 'unknown' &&
              <span className={'status-ribbon status-'+entry.publicationStatus}>
                {publicationCaption[entry.publicationStatus]}</span>}
            <span className="cover-illustration"><i /><b /></span><span className="cover-title">{entry.title}</span>
          </div>
          <div className="detail-content"><p className="eyebrow">THE STORY / {demo?'READER DEMONSTRATION':'PRIVATE LIBRARY'}</p>
            <h1>{entry.title}</h1><p className="detail-sub">{entry.creators.join(', ')} <span aria-hidden="true">·</span> {entry.publicationStatus}</p>
            <div className="detail-synopsis"><span className="detail-section-overline">ABOUT THIS MANGA</span>
              <p className="detail-description">{entry.synopsis || 'A description has not been added yet.'}</p>
            </div>
            <div className="tag-row">{entry.tags.map(value=><button type="button" className="tag" key={value}
              onClick={()=>jumpToFilter('tag',value)} title={'Filter All Manga by ' + value}>{value}</button>)}</div>
            <div className="stat-strip"><span><strong>{entry.chapters.length}</strong> chapters</span>
              <span><strong>{annotations[entry.id]?.rating ?? entry.rating ?? '–'}</strong> {annotations[entry.id]?.rating ? 'my' : 'source'} rating / 10</span>
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
              {demo ? <>
              <a className="primary" href={routeHref({kind:'reader',mangaId:entry.id,
                chapterId:progressForEntry?.chapterId ?? chapters[0]?.id ?? 'unavailable',
                pageIndex:progressForEntry?.pageIndex ?? 0},import.meta.env.BASE_URL)}
                onClick={event=>followLink(event,()=>openChapter(entry,undefined,!!progressForEntry))}>
                {progressForEntry ? 'Continue reading' : 'Read from beginning'} <span aria-hidden="true">↗</span></a>
              {progressForEntry && <a className="secondary"
                href={routeHref({kind:'reader',mangaId:entry.id,chapterId:chapters[0]?.id ?? 'unavailable',pageIndex:0},import.meta.env.BASE_URL)}
                onClick={event=>followLink(event,()=>openChapter(entry,chapters[0]?.id))}>Start from chapter one</a>}
              </> : <>
                <button type="button" className="primary" disabled={chapterLoading!==null||!chapters.length}
                  onClick={()=>{void openChapter(entry,undefined,!!progress[entry.id]);}}>
                  {chapterLoading?'Loading chapter…':progress[entry.id]?'Continue reading':'Read from beginning'} <span aria-hidden="true">↗</span>
                </button>
                <p className="fine-print">Private manga pages load securely while you are signed in. Offline downloads are not enabled for private chapters yet.</p>
              </>}
              <button type="button" className="secondary" aria-pressed={!!annotations[entry.id]?.favourite}
                onClick={()=>changeAnnotation(entry,{favourite:!annotations[entry.id]?.favourite},
                  annotations[entry.id]?.favourite?'Removed from favourites':'Added to favourites')}>
                {annotations[entry.id]?.favourite?'★ Remove from favourites':'☆ Add to favourites'}
              </button></div>
            <div className="collection-membership">
              <label>Add to collection
                <select aria-label="Add to collection" value="" onChange={event=>{
                  if(event.target.value)updateMembership(entry,event.target.value,true);
                }}>
                  <option value="">Choose a collection</option>
                  {sortedPersonalCollections.map(folder=><option key={folder.id} value={folder.id}
                    disabled={folder.mangaIds.includes(entry.id)}>
                    {collectionBreadcrumb(collections,folder.id)}{folder.mangaIds.includes(entry.id)?' (already added)':''}
                  </option>)}
                </select>
              </label>
              <div className="collection-memberships">
                {collections.items.filter(folder=>folder.mangaIds.includes(entry.id)).map(folder=>
                  <span className="collection-member" key={folder.id}>
                    <button className="tag" type="button" onClick={()=>filterPersonalCollection(folder.id)}>
                      {collectionBreadcrumb(collections,folder.id)}</button>
                    <button type="button" aria-label={'Remove from collection ' + folder.name}
                      onClick={()=>setConfirmMembershipRemoval({collectionId:folder.id,mangaId:entry.id})}>×</button>
                  </span>)}
              </div>
              {collections.items.length===0 && <p>No personal collections yet. Create one in All Manga.</p>}
            </div>
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
            <input type="search" value={chapterQuery} onChange={event=>{
              setChapterQuery(event.target.value);setChapterLimit(25);
            }} placeholder="Find a chapter..." />
          </label>
          <p className="chapter-list-count">Showing {visibleChapters.length} of {matchingChapters.length} chapters
            {chapterQuery?' matching your search':''}. Choose any chapter to read.</p>
          <p className="chapter-completion-summary">
            {chapters.filter(chapter => annotations[entry.id]?.completedChapterIds?.includes(chapter.id)).length}
            {' '}of {chapters.length} chapters explicitly marked completed on this device.
          </p>
          {visibleChapters.map(chapter=>{ const index = chapters.findIndex(value=>value.id === chapter.id); return <div className="chapter-entry" key={chapter.id}>
            {demo ? <a className="chapter-row"
              href={routeHref({kind:'reader',mangaId:entry.id,chapterId:chapter.id,pageIndex:0},import.meta.env.BASE_URL)}
              onClick={event=>followLink(event,()=>openChapter(entry,chapter.id))}>
              <span className="chapter-number">{String(index+1).padStart(2,'0')}</span>
              <span className="chapter-title"><strong>{chapter.label}</strong>
                <small>{chapter.volume ?? 'No volume'} · {chapter.pageCount ?? 'Unknown'} sample pages</small></span>
              <span className="chapter-open">Read ↗</span></a> :
              <button type="button" className="chapter-row private-chapter-read"
                disabled={chapterLoading!==null}
                onClick={()=>{void openChapter(entry,chapter.id);}}>
                <span className="chapter-number">{String(index+1).padStart(2,'0')}</span>
                <span className="chapter-title"><strong>{chapter.label}</strong>
                  <small>{chapter.volume ?? 'No volume'} · {chapter.pageCount ?? 'Unknown'} pages</small></span>
                <span className="chapter-open">{chapterLoading===chapter.id?'Loading…':'Read ↗'}</span>
              </button>}
            <button type="button" className="secondary chapter-completion-toggle"
              aria-label={annotations[entry.id]?.completedChapterIds?.includes(chapter.id) ?
                'Mark chapter ' + (index + 1) + ' incomplete' :
                'Mark chapter ' + (index + 1) + ' completed'}
              aria-pressed={!!annotations[entry.id]?.completedChapterIds?.includes(chapter.id)}
              onClick={()=>toggleChapterComplete(entry,chapter.id)}>
              {annotations[entry.id]?.completedChapterIds?.includes(chapter.id) ?
                '✓ Completed' : 'Mark completed'}
            </button>
            {demo && manifests.get(chapter.id) && <OfflineChapterControl manifest={manifests.get(chapter.id)!}
              onChange={()=>setInventoryRevision(value=>value+1)} />}
          </div>;})}
          {matchingChapters.length>visibleChapters.length&&
            <button className="secondary chapter-load-more" type="button"
              onClick={()=>setChapterLimit(value=>value+25)}>
              Show next {Math.min(25,matchingChapters.length-visibleChapters.length)} chapters
            </button>}
          {chapterLoading&&<p role="status" className="chapter-loading-note">Verifying chapter pages from your private library…</p>}
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
            privateMangaId={demo?undefined:entry.id} privateRevision={demo?undefined:privateRevision}
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
          <button className="secondary" type="button" disabled={chapterLoading!==null||
              (demo?!stepChapter(entry,manifests,location,-1):chapters[0]?.id===location.chapterId)}
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
          <button className="primary" type="button" disabled={chapterLoading!==null||
              (demo?!stepChapter(entry,manifests,location,1):chapters.at(-1)?.id===location.chapterId)}
            onClick={()=>move(1)}>Next chapter →</button>
        </div>
        {notice && <p className="reader-notice" role="status">{notice}</p>}
        <p className="reader-hint">Scroll down to read every page in this chapter. Previous and Next move between chapters only. Nearby images load on demand.</p>
        <p className="fine-print">{demo
          ? 'You can download synthetic sample chapters for offline reading.'
          : 'Private images are fetched securely as you scroll. Offline copies of private chapters are not yet supported.'}</p>
      </section>}
      {screen.kind === 'not-found' && <div className="empty-state" role="alert"><h2>Page unavailable</h2>
        <p>This link does not point to an available manga, chapter or page.</p>
        <a className="secondary" href={routeHref({kind:'library'},import.meta.env.BASE_URL)}
          onClick={event=>followLink(event,()=>goCatalogue())}>Open the library</a></div>}
      {(screen.kind === 'details' || screen.kind === 'reader') && !entry && <div className="empty-state" role="alert"><h2>Series unavailable</h2>
        <p>This series is no longer in the selected catalogue.</p><button className="secondary" onClick={()=>goCatalogue()}>Return to the shelf</button></div>}
      {notice && screen.kind !== 'reader' && <p className="reader-notice" role="status">{notice}</p>}
      {confirmMembershipRemoval && entry && screen.kind==='details' && <div className="dialog-scrim">
        <div role="dialog" className="app-dialog" aria-modal="true" aria-labelledby="remove-member-title">
          <h2 id="remove-member-title">Remove from this collection?</h2>
          <p>This removes the manga from the selected collection, not from your library or offline downloads.</p>
          <div className="dialog-actions">
            <button className="secondary" autoFocus type="button"
              onClick={()=>setConfirmMembershipRemoval(null)}>Cancel</button>
            <button className="primary" type="button"
              onClick={()=>updateMembership(entry,confirmMembershipRemoval.collectionId,false)}>Remove manga</button>
          </div>
        </div>
      </div>}
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
      <span>{demo ? 'Synthetic sample catalogue' : cloud.status==='connected'?'Private dataset connected':'Private dataset not connected'} · No cloud progress sync · Independent of the hub</span></footer>
  </div>;
}
