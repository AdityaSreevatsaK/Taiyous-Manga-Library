import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { entries as realEntries } from './data/catalogue';
import { fetchPrivateLibrary, type CloudRead } from './data/privateLibrary';
import { fetchPrivateChapter, privateResumeChapter } from './data/privateMedia';
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
import { MangaChapterPicker } from './components/MangaChapterPicker';
import { MangaChapterBrowser } from './components/MangaChapterBrowser';
import { MangaHeroBackdrop } from './components/MangaHeroBackdrop';
import { MangaDetailsQuickNav } from './components/MangaDetailsQuickNav';
import { MangaCollectionPicker } from './components/MangaCollectionPicker';
import { MangaCoverArtwork } from './components/MangaCoverArtwork';
import {ratingLabel,ratingSummary,ratingToneClass} from './domain/ratings';
import { CATALOGUE_SECTIONS, parseAppRoute, resolveAppRoute, routeHref, type AppRoute, type CatalogueSection } from './domain/routes';
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
import './novel-details-parity.css';
import './ported-novel-chapters.css';
import './ported-novel-quick-navigation.css';

/** These ribbons describe publication status, never the reader's Finished shelf. */
function roleNames(item:MangaEntry,role:'author'|'artist'):string[]{
 return item.creatorRoles?.filter(person=>person.role===role).map(person=>person.name) ?? [];
}
function creditLine(item:MangaEntry):string{
 const authors=roleNames(item,'author').join(', ');
 const artists=roleNames(item,'artist').join(', ');
 if(authors&&artists&&authors!==artists)return authors+' · Art: '+artists;
 return authors||artists||item.creators.join(', ')||'Creator unknown';
}
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
  const initialRoute = useMemo(()=>resolveAppRoute(currentBrowserRoute(),initialDemo?demoEntries:realEntries), [initialDemo]);
  const initialFilters = useMemo(readCatalogueQuery, []);
  const [demo, setDemo] = useState(initialDemo);
  const [remoteEntries, setRemoteEntries] = useState<MangaEntry[]>([]);
  const [privateManifests, setPrivateManifests] = useState<ReadonlyMap<string,ChapterManifest>>(()=>new Map());
  const [privateRevision, setPrivateRevision] = useState('');
  const [chapterLoading, setChapterLoading] = useState<string | null>(null);
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
  const [chapterPickerOpen,setChapterPickerOpen] = useState(false);
  const [collectionPickerOpen,setCollectionPickerOpen] = useState(false);
  useEffect(()=>{
    if(screen.kind!=='details')setCollectionPickerOpen(false);
  },[screen.kind]);
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
  const [personalTagDraft,setPersonalTagDraft]=useState<string[]>([]);
  const [ratingDraft,setRatingDraft]=useState<number|undefined>(undefined);
  const [confirmSaveTags,setConfirmSaveTags]=useState(false);
  const [confirmRemoveTag,setConfirmRemoveTag]=useState<string|null>(null);
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
  const [refreshingMetadata,setRefreshingMetadata]=useState(false);
  const [offlineChapterIds, setOfflineChapterIds] = useState<ReadonlySet<string>>(() => new Set());
  const readerRef = useRef<HTMLElement | null>(null);
  const catalogue = demo ? demoEntries : remoteEntries;
  const manifests: ReadonlyMap<string, ChapterManifest> = demo ? demoManifests : privateManifests;
  const entry = screen.kind === 'reader' || screen.kind === 'details' ? catalogue.find(item => item.id === screen.id) : undefined;
  const manifest = location ? manifests.get(location.chapterId) : undefined;
  const chapters = entry ? orderedChapters(entry) : [];
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
        const bookmarked=resolveAppRoute(currentBrowserRoute(),result.entries);
        if(bookmarked.kind==='details'){
          const item=result.entries.find(value=>value.id===bookmarked.mangaId);
          setScreen(item?{kind:'details',id:item.id}:{kind:'not-found'});
        }else if(bookmarked.kind==='reader'){
          const item=result.entries.find(value=>value.id===bookmarked.mangaId);
          if(!item||!item.chapters.some(ch=>ch.id===bookmarked.chapterId)){
            setScreen({kind:'not-found'});
          }else{
            setChapterLoading(bookmarked.chapterId);
            void fetchPrivateChapter(item.id,bookmarked.chapterId,controller.signal).then(loaded=>{
              if(!live)return;
              if(bookmarked.pageIndex>=loaded.manifest.pages.length){
                setScreen({kind:'not-found'});return;
              }
              setPrivateManifests(new Map([[loaded.manifest.chapterId,loaded.manifest]]));
              setPrivateRevision(loaded.revision);
              setLocation({chapterId:bookmarked.chapterId,pageIndex:bookmarked.pageIndex});
              setScreen({kind:'reader',id:item.id});
            }).catch(error=>{
              if(!live)return;
              setScreen({kind:'details',id:item.id});
              setNotice(error instanceof Error?error.message:'Unable to open the bookmarked chapter.');
            }).finally(()=>{if(live)setChapterLoading(null);});
          }
        }else if(bookmarked.kind==='not-found'){
          setScreen({kind:'not-found'});
        }else{
          setScreen({kind:'catalogue',section:bookmarked.kind});
        }
      }
    }).catch(() => { if (live) setCloud({status:'unavailable',message:'Unable to reach private library.'}); });
    return () => { live=false; controller.abort(); };
  }, []);
  useEffect(()=>{
    const route=resolveAppRoute(currentBrowserRoute(),catalogue);
    if(route.kind!=='details'&&route.kind!=='reader')return;
    const canonical=routeHref(route,import.meta.env.BASE_URL,catalogue);
    if(window.location.pathname+window.location.search!==canonical)
      window.history.replaceState(null,'',canonical);
  },[catalogue,demo]);
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
    setRatingDraft(entry ? annotations[entry.id]?.rating??undefined : undefined);
    setTagDraft('');
    setPersonalTagDraft(entry ? annotations[entry.id]?.tags??[] : []);
    setConfirmSaveTags(false);
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
    const url=routeHref({kind:'library'},import.meta.env.BASE_URL,catalogue)+(suffix?'?'+suffix:'');
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
        chapterId: next.chapterId, pageIndex: next.pageIndex }, import.meta.env.BASE_URL,catalogue);
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
    const selected=chapterId ?? (resume ? progress[item.id]?.chapterId??privateResumeChapter(item)??undefined : undefined) ?? orderedChapters(item)[0]?.id ?? '';
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
      // Verify the prior saved chapter too. Otherwise an unrelated saved chapter
      // would look corrupt when the reader saves progress in the new chapter.
      const previousChapter=privateResumeChapter(item);
      if(previousChapter&&previousChapter!==selected&&!next.has(previousChapter)){
        try{
          const previous=await fetchPrivateChapter(item.id,previousChapter);
          if(previous.revision===loaded.revision)next.set(previousChapter,previous.manifest);
        }catch{ /* Preserve the previous progress record. Never overwrite unverifiable state. */ }
      }
      if(operation!==chapterOpenRequest.current)return;
      setPrivateManifests(next);
      setPrivateRevision(loaded.revision);
      const local=loadProgress(item,next);
      if(local.status==='ok')setProgress(previous=>({...previous,[item.id]:local.value}));
      const saved=laterProgress(progress[item.id],local.status==='ok'?local.value:undefined);
      const index=resume && saved?.chapterId===selected ?
        Math.max(0,loaded.manifest.pages.findIndex(page=>page.id===saved.pageId)) : 0;
      setLocation({chapterId:selected,pageIndex:index});
      setJumpToken(value=>value+1);
      setScreen({kind:'reader',id:item.id});
      const url=routeHref({kind:'reader',mangaId:item.id,chapterId:selected,pageIndex:index},import.meta.env.BASE_URL,catalogue);
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
  function applyRoute(input: AppRoute) {
    const route=resolveAppRoute(input,catalogue);
    if(route.kind==='details'||route.kind==='reader'){
      const canonical=routeHref(route,import.meta.env.BASE_URL,catalogue);
      if(window.location.pathname+window.location.search!==canonical)
        window.history.replaceState(null,'',canonical);
    }
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
    if(!demo&&!verified&&item.chapters.some(chapter=>chapter.id===route.chapterId)){
      const operation=++chapterOpenRequest.current;
      setChapterLoading(route.chapterId);
      void fetchPrivateChapter(item.id,route.chapterId).then(loaded=>{
        if(operation!==chapterOpenRequest.current)return;
        if(route.pageIndex>=loaded.manifest.pages.length){
          setScreen({kind:'not-found'});return;
        }
        setPrivateManifests(previous=>new Map(previous).set(route.chapterId,loaded.manifest));
        setPrivateRevision(loaded.revision);
        setLocation({chapterId:route.chapterId,pageIndex:route.pageIndex});
        setScreen({kind:'reader',id:item.id});
      }).catch(error=>{
        if(operation!==chapterOpenRequest.current)return;
        setScreen({kind:'details',id:item.id});
        setNotice(error instanceof Error?error.message:'Chapter cannot be opened.');
      }).finally(()=>{
        if(operation===chapterOpenRequest.current)setChapterLoading(null);
      });
      return;
    }
    if (!item.chapters.some(chapter => chapter.id === route.chapterId) ||
        !verified || route.pageIndex >= verified.pages.length) {
      exitImmersive(); setScreen({ kind: 'not-found' }); setLocation(null); return;
    }
    setLocation({ chapterId: route.chapterId, pageIndex: route.pageIndex });
    setJumpToken(value => value + 1);
    setScreen({ kind: 'reader', id: item.id });
  }
  function navigateTo(route: Exclude<AppRoute, { kind: 'not-found' }>) {
    const url = routeHref(route, import.meta.env.BASE_URL,catalogue);
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
  /** Match Novel Library: stage changes, then save all personal tags after review. */
  function addTag(item: MangaEntry) {
    try {
      const tags=addPersonalTag(personalTagDraft,tagDraft);
      if(tags.length===personalTagDraft.length||
        item.tags.some(value=>value.toLocaleLowerCase('en')===tagDraft.trim().toLocaleLowerCase('en'))){
        setShelfNotice('That tag is already on this manga.');return;
      }
      setPersonalTagDraft(tags);setTagDraft('');
    }catch(error){setStorageNotice(error instanceof Error?error.message:'Invalid personal tag.');}
  }
  /** A single metadata-only reload shared by Details and Cloud settings. */
  async function refreshPrivateCatalogue(){
    if(refreshingMetadata)return;
    setRefreshingMetadata(true);
    try{
      const result=await fetchPrivateLibrary();
      if(result.status!=='connected')throw new Error(result.message);
      setRemoteEntries([...result.entries]);
      setCloud(result);
      setNotice('Publication metadata refreshed. Your saved reading data is unchanged.');
    }catch(error){
      setNotice(error instanceof Error?error.message:'Unable to refresh publication metadata.');
    }finally{setRefreshingMetadata(false);}
  }
  function savePersonalTags(item:MangaEntry){
    // Port Novel BookDetails add-only contract. Concurrent/stale drafts cannot
    // silently remove tags; deletion belongs to dedicated Master Controls.
    const existing=annotations[item.id]?.tags??[];
    const additions=personalTagDraft.filter(tag=>!existing.some(saved=>
      saved.toLocaleLowerCase('en')===tag.toLocaleLowerCase('en')));
    if(changeAnnotation(item,{tags:[...existing,...additions]},'Personal tags saved'))
      setConfirmSaveTags(false);
  }
  function jumpToFilter(kind: 'tag' | 'collection', value: string) {
    setTag(kind === 'tag' ? value : '');
    setCollection(kind === 'collection' ? value : '');
    goCatalogue('library');
  }
  const tagChanges=entry!==undefined &&
    JSON.stringify(personalTagDraft)!==JSON.stringify(annotations[entry.id]?.tags??[]);
  const progressForEntry = entry ? restoreProgress(entry, manifests, progress[entry.id]) : null;

  return <div className={'app-shell theme-' + preferences.theme +
    (immersive && screen.kind === 'reader' ? ' reading-immersive' : '') +
    (screen.kind==='details'?' is-manga-details':'')}>
    <a className="skip" href="#content">Skip to content</a>
    <header className="site-header">
      <div className="manga-topbar">
        <a className="wordmark" href={routeHref({kind:'home'},import.meta.env.BASE_URL,catalogue)}
          onClick={event=>followLink(event,()=>goCatalogue('home'))} aria-label="Taiyou Manga home">
          <span className="manga-logo-frame"><MangaBrandMark theme={preferences.theme} size={36}/></span>
          <span className="manga-wordmark-text"><strong>TAIYOU'S</strong><small>PERSONAL MANGA LIBRARY</small></span>
        </a>
        <MangaCloudMenu cloud={cloud} online={online} demo={demo} count={remoteEntries.length}
          onSample={()=>changeDemo(true)} onPrivate={()=>changeDemo(false)}
          onLogout={()=>{void disconnectCloud();}}
          onRefresh={()=>{void refreshPrivateCatalogue();}} refreshing={refreshingMetadata}>
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
        {screen.kind==='details'&&
          <MangaDetailsQuickNav
            collections={sortedPersonalCollections.map(folder=>({
              id:folder.id,name:folder.name,parentId:folder.parentId,
              path:collectionBreadcrumb(collections,folder.id),count:folder.mangaIds.length,
            }))}
            readingHref={routeHref({kind:'reading'},import.meta.env.BASE_URL,catalogue)}
            allHref={routeHref({kind:'library'},import.meta.env.BASE_URL,catalogue)}
            searchHref={routeHref({kind:'library'},import.meta.env.BASE_URL,catalogue)}
            collectionHref={id=>routeHref({kind:'library'},import.meta.env.BASE_URL,catalogue)+
              '?collection='+encodeURIComponent('personal:'+id)}
            onReading={()=>goCatalogue('reading')} onAll={()=>goCatalogue('library')}
            onSearch={()=>{setAdvancedOpen(true);goCatalogue('library');}}
            onCollection={filterPersonalCollection}/>}
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
          <MangaThemeSwatches value={preferences.theme} compact={screen.kind==='details'}
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
              href={routeHref({kind:section},import.meta.env.BASE_URL,catalogue)}
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
                href={routeHref({kind:section},import.meta.env.BASE_URL,catalogue)}
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
                href={routeHref({kind:'library'},import.meta.env.BASE_URL,catalogue)}
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
                  {!demo && <MangaCoverArtwork key={item.cover?.sha256??'none'} entry={item}/>}
                  <span className="editorial-book-glyph">✦</span>
                  <span className="editorial-book-title">{item.title}</span>
                  <span className="editorial-book-maker">{roleNames(item,'author')[0] || item.creators[0] || 'TAIYOU LIBRARY'}</span>
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
                href={routeHref({kind:'reader',mangaId:item.id,chapterId:resume.chapterId,pageIndex:resume.pageIndex},import.meta.env.BASE_URL,catalogue)}
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
                  <a href={routeHref({kind:'details',mangaId:item.mangaId},import.meta.env.BASE_URL,catalogue)}
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
                href={routeHref({kind:'reader',mangaId:item.id,chapterId:chapter.id,pageIndex:0},import.meta.env.BASE_URL,catalogue)}
                onClick={event=>followLink(event,()=>openChapter(item,chapter.id))}>
                <strong>{item.title}</strong><span>{chapter.label}</span><span>Read chapter ↗</span>
              </a>))}</div> :
            <div className="empty-state"><h2>No downloaded chapters yet</h2>
              <p>Open a sample series and choose Download chapter. No entire series is downloaded automatically.</p>
              <a className="secondary" href={routeHref({kind:'library'},import.meta.env.BASE_URL,catalogue)}
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
            <a className="book-card" key={item.id} href={routeHref({kind:'details',mangaId:item.id},import.meta.env.BASE_URL,catalogue)}
              onClick={event=>followLink(event,()=>navigateTo({kind:'details',mangaId:item.id}))}>
              <span className={'book-cover cover-'+(demoEntries.findIndex(d=>d.id===item.id)%3+1)}>
                {!demo && <MangaCoverArtwork key={item.cover?.sha256??'none'} entry={item}/>}
                {item.publicationStatus !== 'unknown' &&
                  <span className={'status-ribbon status-'+item.publicationStatus}
                    aria-label={'Publication: '+publicationCaption[item.publicationStatus]}>
                    {publicationCaption[item.publicationStatus]}</span>}
                <span className="cover-number">TAIYOU / {String(index+1).padStart(2,'0')}</span>
                <span className="cover-illustration" aria-hidden="true"><i /><b /></span>
                <span className="cover-title">{item.title}</span>
                <span className="cover-creator">{roleNames(item,'author')[0] || item.creators[0] || 'CREATOR UNKNOWN'}</span>
                <span className="cover-foot">{demo?'READER DEMONSTRATION':'YOUR PRIVATE ARCHIVE'}</span>
              </span>
              <span className="book-details"><strong>{item.title}</strong>
                {annotations[item.id]?.favourite && <span className="book-favourite">★ Favourite</span>}
                <span className="book-author">{creditLine(item)}</span>
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
      <div className="manga-detail-page">
        <a className="back manga-detail-back" href={routeHref({kind:'library'},import.meta.env.BASE_URL,catalogue)}
          onClick={event=>followLink(event,()=>goCatalogue())}>← Back to the shelf</a>
        <section className="series-detail manga-details-hero novel-photographic-hero">
          <MangaHeroBackdrop key={entry.id} mangaId={entry.id}/>
          {collections.items.some(folder=>folder.mangaIds.includes(entry.id))&&
            <nav className="details-hero-memberships" aria-label="Collections containing this manga">
              <span>IN COLLECTIONS</span>
              {sortedPersonalCollections.filter(folder=>folder.mangaIds.includes(entry.id)).map(folder=>
                <button key={folder.id} className="details-hero-membership" type="button"
                  onClick={()=>filterPersonalCollection(folder.id)}>
                  {collectionBreadcrumb(collections,folder.id)}
                </button>)}
            </nav>}
          <div className={'detail-cover cover-'+(demoEntries.findIndex(d=>d.id===entry.id)%3+1)} aria-hidden="true">
            {!demo && <MangaCoverArtwork key={entry.cover?.sha256??'none'} entry={entry} priority/>}
            <span className="cover-illustration"><i /><b /></span><span className="cover-title">{entry.title}</span>
          </div>
          <div className="detail-content"><p className="eyebrow">THE STORY / {demo?'READER DEMONSTRATION':'PRIVATE LIBRARY'}</p>
            <h1>{entry.title}</h1><p className="detail-sub">{creditLine(entry)} <span aria-hidden="true">·</span> {publicationCaption[entry.publicationStatus]}</p>
            <div className="stat-strip details-meta-row">
              <span>▤ {entry.chapters.length.toLocaleString()} chapters</span>
              {entry.publicationStatus!=='unknown'&&
                <span className={'manga-publication-pill status-'+entry.publicationStatus}>
                  <span aria-hidden="true">●</span> {publicationCaption[entry.publicationStatus]}
                </span>}
            </div>
            <div className="tag-row details-hero-tags">
              {entry.tags.map(value=><button type="button" className="tag" key={value}
                onClick={()=>jumpToFilter('tag',value)} title={'Filter All Manga by '+value}>{value}</button>)}
            </div>
            <form className="hero-rating manga-hero-rating" aria-label="Personal manga rating"
              onSubmit={event=>{
                event.preventDefault();
                if(changeAnnotation(entry,{rating:ratingDraft??null},
                  ratingDraft===undefined?'Personal rating cleared':'Rating saved'))
                  setShelfNotice(ratingDraft===undefined?'Personal rating cleared':
                    'Rating saved: '+ratingSummary(ratingDraft));
              }}>
              <fieldset className="hero-rating-fieldset">
                <legend><span className={'rating-star '+ratingToneClass(ratingDraft)} aria-hidden="true">★</span>
                  My rating {annotations[entry.id]?.rating!==undefined &&
                    <span className="hero-rating-saved">· {ratingSummary(annotations[entry.id]?.rating??undefined)}</span>}
                </legend>
                <div className="hero-rating-choices" role="group" aria-label="Select personal rating">
                  {Array.from({length:10},(_,index)=>index+1).map(value=>
                    <button key={value} className={'hero-rating-choice'+(ratingDraft===value?' selected':'')}
                      type="button" aria-pressed={ratingDraft===value}
                      aria-label={'Rate '+value+' out of 10: '+ratingLabel(value)}
                      title={ratingLabel(value)} onClick={()=>setRatingDraft(value)}>{value}</button>)}
                  <button type="button" className="hero-rating-clear"
                    disabled={ratingDraft===undefined} onClick={()=>setRatingDraft(undefined)}>Clear</button>
                </div>
              </fieldset>
              <button type="submit" className="hero-rating-save"
                disabled={ratingDraft===(annotations[entry.id]?.rating)}>Save rating</button>
            </form>
            <div className="detail-actions">
              {demo ? <>
              <a className="primary" href={routeHref({kind:'reader',mangaId:entry.id,
                chapterId:progressForEntry?.chapterId ?? chapters[0]?.id ?? 'unavailable',
                pageIndex:progressForEntry?.pageIndex ?? 0},import.meta.env.BASE_URL,catalogue)}
                onClick={event=>followLink(event,()=>openChapter(entry,undefined,!!progressForEntry))}>
                {progressForEntry ? 'Continue reading' : 'Read from beginning'} <span aria-hidden="true">↗</span></a>
              {progressForEntry && <a className="secondary"
                href={routeHref({kind:'reader',mangaId:entry.id,chapterId:chapters[0]?.id ?? 'unavailable',pageIndex:0},import.meta.env.BASE_URL,catalogue)}
                onClick={event=>followLink(event,()=>openChapter(entry,chapters[0]?.id))}>Start from chapter one</a>}
              </> : <>
                <button type="button" className="primary" disabled={chapterLoading!==null||!chapters.length}
                  onClick={()=>{void openChapter(entry,undefined,!!(progress[entry.id]||privateResumeChapter(entry)));}}>
                  {chapterLoading?'Loading chapter…':progress[entry.id]||privateResumeChapter(entry)?'Continue reading':'Read from beginning'} <span aria-hidden="true">↗</span>
                </button>
                
              </>}
              <button type="button" className="secondary" aria-pressed={!!annotations[entry.id]?.favourite}
                onClick={()=>changeAnnotation(entry,{favourite:!annotations[entry.id]?.favourite},
                  annotations[entry.id]?.favourite?'Removed from favourites':'Added to favourites')}>
                {annotations[entry.id]?.favourite?'★ Remove from favourites':'☆ Add to favourites'}
              </button><button className="secondary manga-trying-button" type="button"
              aria-pressed={personalShelves[entry.id]==='trying'}
              onClick={()=>changeShelf(entry,personalShelves[entry.id]==='trying'?null:'trying')}>
              {personalShelves[entry.id]==='trying'?'✓ Trying Out':'Add to Trying Out'}</button>
            <button className="secondary manga-collection-jump" type="button"
              onClick={()=>setCollectionPickerOpen(true)}>+ Add to collection</button></div>
            
          </div>
        </section>
        
        <div className="manga-details-columns">
          <aside className="manga-details-sidebar" aria-label="Your reading journey">
            <section className="manga-detail-card manga-journey-card">
              <p className="manga-card-overline">YOUR JOURNEY</p><h2>Reading progress</h2>
              <strong className="manga-progress-percent">{progressForEntry
                ? Math.round(100*(Math.max(0,chapters.findIndex(ch=>ch.id===progressForEntry.chapterId))+1)
                  /Math.max(1,chapters.length)) : 0}<small>%</small></strong>
              <progress aria-label="Manga reading progress" max={Math.max(1,chapters.length)}
                value={progressForEntry
                  ? Math.max(0,chapters.findIndex(ch=>ch.id===progressForEntry.chapterId))+1 : 0}/>
              <p>{progressForEntry?'Reading':'Not yet started'}</p>
              <div className="manga-progress-last"><span>Chapter</span>
                <strong>{progressForEntry
                  ? (chapters.findIndex(ch=>ch.id===progressForEntry.chapterId)+1)+' / '+chapters.length
                  : 'Not started'}</strong></div>
              <button type="button" className="primary manga-journey-resume"
                disabled={!chapters.length||chapterLoading!==null}
                onClick={()=>{void openChapter(entry,undefined,!!(progress[entry.id]||privateResumeChapter(entry)));}}>
                {progressForEntry||(!demo&&privateResumeChapter(entry))?'Resume at saved position':'Start reading'} →
              </button>
              {personalShelves[entry.id]==='finished'
                ? <button type="button" className="secondary manga-mark-finished"
                    onClick={()=>changeShelf(entry,null)}>✓ Completed · Undo</button>
                : <button type="button" className="secondary manga-mark-finished"
                    onClick={()=>changeShelf(entry,'finished')}>✓ Mark as completed</button>}
            </section>
            <section className="manga-detail-card manga-info-card">
              <p className="manga-card-overline">MANGA INFORMATION</p><h2>Details</h2>
              <dl>
                {roleNames(entry,'author').length>0 &&
                  <div><dt>Author{roleNames(entry,'author').length>1?'s':''}</dt><dd>{roleNames(entry,'author').join(', ')}</dd></div>}
                {roleNames(entry,'artist').length>0 &&
                  <div><dt>Artist{roleNames(entry,'artist').length>1?'s':''}</dt><dd>{roleNames(entry,'artist').join(', ')}</dd></div>}
                {!entry.creatorRoles?.length &&
                  <div><dt>Creators</dt><dd>{entry.creators.join(', ')||'Not supplied'}</dd></div>}
                {entry.aliases.length>0&&<div><dt>Also known as</dt><dd>{entry.aliases.join('; ')}</dd></div>}
                <div><dt>Chapters</dt><dd>{chapters.length}</dd></div>
                <div><dt>Publication</dt><dd>{publicationCaption[entry.publicationStatus]}</dd></div>
                
              </dl>
              
            
            </section>
            <section className="manga-detail-card manga-tags-card" aria-label="Publication genres and tags">
              <p className="manga-card-overline">ORGANISE YOUR READING</p><h2>Tags &amp; genres</h2>
              <p>Browse all tags together and add personal tags here. To remove personal tags, use Manage this manga below. Imported genres are protected.</p>
              <div className="tag-row details-tag-row" aria-label="All manga tags">
                {entry.tags.map(value=><button key={'source:'+value} type="button" className="tag imported-tag"
                  title="Imported publication genre" onClick={()=>jumpToFilter('tag',value)}>{value}</button>)}
                {personalTagDraft.filter(value=>!entry.tags.some(imported=>
                  imported.toLocaleLowerCase('en')===value.toLocaleLowerCase('en')))
                  .map(value=><button key={'personal:'+value} className="tag" type="button"
                    onClick={()=>jumpToFilter('tag',value)}>{value}</button>)}
                {!entry.tags.length&&!personalTagDraft.length&&<span className="manga-metadata-missing">No tags yet. Add one below.</span>}
              </div>
              <form className="tag-entry details-tag-form" onSubmit={event=>{event.preventDefault();addTag(entry);}}>
                <label htmlFor="new-manga-tag">Add a personal tag
                  <input id="new-manga-tag" type="text" value={tagDraft} maxLength={48}
                    list="personal-tag-suggestions" onChange={event=>setTagDraft(event.target.value)}
                    placeholder="e.g. Favourite, Romance, Slow burn..." />
                </label>
                <datalist id="personal-tag-suggestions">{allTags.map(value=>
                  <option key={value} value={value}/>)}</datalist>
                <button type="submit" className="primary" disabled={!tagDraft.trim()}>+ Add tag</button>
              </form>
              <div className="tag-draft-actions">
                <span>{tagChanges?'Unsaved tag changes':'Your tags are saved'}</span>
                {tagChanges&&<>
                  <button className="secondary" type="button"
                    onClick={()=>{setPersonalTagDraft(annotations[entry.id]?.tags??[]);setTagDraft('');}}>Discard changes</button>
                  <button className="primary" type="button"
                    onClick={()=>setConfirmSaveTags(true)}>Review &amp; save tags</button>
                </>}
              </div>
            </section>
            <section className="personal-annotations manga-detail-card" aria-label="Personal manga annotations">
              <p className="manga-card-overline">YOUR PERSONAL IMPRESSIONS</p><h2>Comments &amp; reading notes</h2>
              <p>Capture your thoughts about this manga. Comments and ratings are saved locally on this device.</p>
              <form className="personal-notes-editor personal-review-form" onSubmit={event=>{
                event.preventDefault();changeAnnotation(entry,{notes:noteDraft},'Comments saved');
              }}>
                <label htmlFor="manga-personal-review">My comments / reading notes</label>
                <textarea id="manga-personal-review" value={noteDraft} maxLength={5000} rows={5}
                  onChange={event=>setNoteDraft(event.target.value)}
                  placeholder="Memorable scenes, characters or your thoughts..." />
                <div className="notes-actions personal-review-actions">
                  <span>Saved locally on this device</span>
                  <button className="primary" type="submit"
                    disabled={noteDraft===(annotations[entry.id]?.notes??'')}>Save comments</button>
                  {noteDraft!==(annotations[entry.id]?.notes??'')&&<button className="secondary" type="button"
                    onClick={()=>setNoteDraft(annotations[entry.id]?.notes??'')}>Discard edits</button>}
                </div>
              </form>
            </section>
            <section className="manga-detail-card manga-management-card">
              <p className="manga-card-overline">MANGA STORAGE</p><h2>Manage this manga</h2>
              <p>The original cover and pages remain protected in your private library.
                Uploads, metadata edits, deletion and backups belong to Master Controls on the main library page.</p>
              <p>Private chapter offline downloads are not yet available.</p>
              <details className="manga-reading-shelf-management">
                <summary>Reading shelf options</summary>
                <p>Personal reading shelves do not change the manga's publication status.</p>
                <div className="manga-reading-shelf-buttons">
                  <button className="secondary" type="button"
                    onClick={()=>changeShelf(entry,personalShelves[entry.id]==='to-read'?null:'to-read')}>
                    {personalShelves[entry.id]==='to-read'?'Remove from To Be Read':'Move to To Be Read'}
                  </button>
                  {personalShelves[entry.id]==='finished'&&
                    <button className="secondary" type="button"
                      onClick={()=>changeShelf(entry,null)}>Remove from Finished</button>}
                </div>
              </details>
              {(annotations[entry.id]?.tags??[]).length>0&&
                <details className="manga-personal-tag-management">
                  <summary>Manage personal tags</summary>
                  <p>Removing a tag does not alter the imported genres or the manga itself.</p>
                  <div className="manga-tag-management-actions">
                    {(annotations[entry.id]?.tags??[]).map(tag=>
                      <button type="button" className="secondary" key={tag}
                        onClick={()=>setConfirmRemoveTag(tag)}
                        aria-label={'Remove personal tag '+tag}>Remove {tag}</button>)}
                  </div>
                </details>}
            </section>
          </aside>
          <section className="manga-detail-card manga-mobile-rating" aria-label="Personal manga rating on mobile">
            <div className="manga-mobile-rating-title"><span aria-hidden="true">★</span>
              <strong>My rating</strong>
              {ratingSummary(ratingDraft)&&<span aria-live="polite">{ratingSummary(ratingDraft)}</span>}
            </div>
            <form className="manga-mobile-rating-controls" onSubmit={event=>{
              event.preventDefault();
              changeAnnotation(entry,{rating:ratingDraft??null},
                ratingDraft===undefined?'Personal rating cleared':'Rating saved');
            }}>
              <label htmlFor="manga-mobile-rating">Rate this manga</label>
              <select id="manga-mobile-rating" value={ratingDraft??''}
                onChange={event=>setRatingDraft(event.target.value?Number(event.target.value):undefined)}>
                <option value="">Not rated</option>
                {Array.from({length:10},(_,index)=>index+1).map(value=>
                  <option key={value} value={value}>{ratingSummary(value)}</option>)}
              </select>
              <button className="primary" type="submit"
                disabled={ratingDraft===annotations[entry.id]?.rating}>Save rating</button>
            </form>
          </section>
          <div className="manga-details-main">
            <section className="manga-detail-card manga-synopsis-card">
              <p className="manga-card-overline">ABOUT THE STORY</p><h2>Synopsis</h2>
              <p className="detail-description">{entry.synopsis||'A synopsis has not been added yet.'}</p>
            </section>
            <MangaChapterBrowser mangaId={entry.id} chapters={chapters}
              currentChapterId={progressForEntry?.chapterId} busy={chapterLoading!==null}
              onReadChapter={chapterId=>{void openChapter(entry,chapterId);}}
              completedChapterIds={annotations[entry.id]?.completedChapterIds??[]}
              onToggleComplete={chapterId=>toggleChapterComplete(entry,chapterId)}
              renderOfflineControl={demo?chapter=>{
                const sample=manifests.get(chapter.id);
                return sample?<OfflineChapterControl manifest={sample}
                  onChange={()=>setInventoryRevision(value=>value+1)}/>:null;
              }:undefined}/>
          </div>
        </div>
      </div>
      <MangaCollectionPicker open={collectionPickerOpen} title={entry.title}
        items={sortedPersonalCollections.map(folder=>({
          id:folder.id,label:collectionBreadcrumb(collections,folder.id),
          selected:folder.mangaIds.includes(entry.id),
        }))}
        onToggle={(collectionId,selected)=>updateMembership(entry,collectionId,selected)}
        onClose={()=>setCollectionPickerOpen(false)}
        onManage={()=>{setCollectionPickerOpen(false);goCatalogue('library');}}/>
      </>}
      {screen.kind === 'reader' && entry && location && <section className="reader-shell" ref={readerRef} tabIndex={0}
        aria-label="Manga reader, continuous chapter view">
        <div className="reader-topline">
          <a className="back" href={routeHref({kind:'details',mangaId:entry.id},import.meta.env.BASE_URL,catalogue)}
            onClick={event=>followLink(event,()=>navigateTo({kind:'details',mangaId:entry.id}))}>← Series details</a>
          <div className="reader-topline-actions">
            <a className="back" href={routeHref({kind:'library'},import.meta.env.BASE_URL,catalogue)}
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
              <div className="reader-chapter-shortcut">
                <span>Chapter navigation</span>
                <button type="button" className="reader-open-chapter-picker" aria-label="Choose chapter"
                  disabled={chapterLoading!==null} aria-haspopup="dialog"
                  aria-expanded={chapterPickerOpen} onClick={()=>setChapterPickerOpen(true)}>
                  {activeChapter?.label??'Choose chapter'} <span aria-hidden="true">⌄</span>
                </button>
              </div>
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
              const url = routeHref({kind:'reader',mangaId:entry.id,chapterId:manifest.chapterId,pageIndex:index},import.meta.env.BASE_URL,catalogue);
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
            <button type="button" className="reader-footer-jump" aria-label="Jump to chapter"
              aria-haspopup="dialog" aria-expanded={chapterPickerOpen}
              disabled={chapterLoading!==null||!chapters.length}
              onClick={()=>setChapterPickerOpen(true)}>
              <span>{chapters.findIndex(chapter=>chapter.id===location.chapterId)+1} / {chapters.length}
                <span aria-hidden="true"> · </span> {activeChapter?.label??'Choose chapter'}</span>
              <span aria-hidden="true">⌄</span>
            </button>
            <p aria-live="polite">Chapter {chapters.findIndex(chapter=>chapter.id===location.chapterId)+1} of {chapters.length}
              <span aria-hidden="true"> · </span> Page {location.pageIndex+1} of {manifest?.pages.length ?? '?'}</p>
          </div>
          <button className="primary" type="button" disabled={chapterLoading!==null||
              (demo?!stepChapter(entry,manifests,location,1):chapters.at(-1)?.id===location.chapterId)}
            onClick={()=>move(1)}>Next chapter →</button>
        </div>
        <MangaChapterPicker open={chapterPickerOpen} chapters={chapters}
          currentChapterId={location.chapterId} disabled={chapterLoading!==null}
          onClose={()=>setChapterPickerOpen(false)}
          onSelect={chapterId=>{void openChapter(entry,chapterId);}}/>
        {notice && <p className="reader-notice" role="status">{notice}</p>}
        <p className="reader-hint">Scroll down to read every page in this chapter. Previous and Next move between chapters only. Nearby images load on demand.</p>
        <p className="fine-print">{demo
          ? 'You can download synthetic sample chapters for offline reading.'
          : 'Private images are fetched securely as you scroll. Offline copies of private chapters are not yet supported.'}</p>
      </section>}
      {screen.kind === 'not-found' && <div className="empty-state" role="alert"><h2>Page unavailable</h2>
        <p>This link does not point to an available manga, chapter or page.</p>
        <a className="secondary" href={routeHref({kind:'library'},import.meta.env.BASE_URL,catalogue)}
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
      {confirmRemoveTag && entry && screen.kind==='details' && <div className="dialog-scrim"
        onKeyDown={event=>{if(event.key==='Escape')setConfirmRemoveTag(null);}}>
        <div className="app-dialog" role="dialog" aria-modal="true" aria-labelledby="remove-personal-tag-title">
          <h2 id="remove-personal-tag-title">Remove this personal tag?</h2>
          <p>Remove “{confirmRemoveTag}” from this manga only? The imported publication genres remain unchanged.</p>
          <div className="dialog-actions">
            <button className="secondary" type="button" autoFocus
              onClick={()=>setConfirmRemoveTag(null)}>Cancel</button>
            <button className="primary" type="button" onClick={()=>{
              const updated=(annotations[entry.id]?.tags??[]).filter(tag=>tag!==confirmRemoveTag);
              if(changeAnnotation(entry,{tags:updated},'Personal tag removed')){
                setPersonalTagDraft(updated);setTagDraft('');setConfirmRemoveTag(null);
              }
            }}>Remove personal tag</button>
          </div>
        </div>
      </div>}
      {confirmSaveTags && entry && screen.kind==='details' && <div className="dialog-scrim"
        onKeyDown={event=>{if(event.key==='Escape')setConfirmSaveTags(false);}}>
        <div className="app-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-tag-title">
          <h2 id="confirm-tag-title">Save tag changes?</h2>
          <p>Your personal tag additions will be saved together. Existing tags and imported genres remain unchanged.</p>
          <div className="dialog-actions">
            <button autoFocus className="secondary" type="button"
              onClick={()=>setConfirmSaveTags(false)}>Cancel</button>
            <button className="primary" type="button"
              onClick={()=>savePersonalTags(entry)}>Save tags</button>
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
