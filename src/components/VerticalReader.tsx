import { useEffect, useRef, useState } from 'react';
import { resolveSyntheticPage, type PageSource } from '../data/pageSource';
import { resolvePrivatePage } from '../data/privateMedia';
import { preloadChapterPages } from '../data/chapterPreloader';
import { anchoredPageIndex, pagePrefetchWindow } from '../domain/pageViewport';
import type { ChapterManifest } from '../domain/types';

/**
 * Continuous chapter scrolling with stable image aspect ratios.
 * Private chapters fetch ALL pages as soon as they open, in page order.
 * Only nearby downloaded images are mounted/decoded to bound display memory.
 * Demo chapters keep their verified nearby-page fixture behaviour.
 * Scroll observation never counts an unseen page as read.
 */
interface Props {
  manifest: ChapterManifest;
  privateMangaId?: string;
  privateRevision?: string;
  fit?: 'page' | 'width';
  activeIndex: number;
  jumpToken: number;
  onActivePage: (index: number) => void;
  onViewedPage: (index: number) => void;
  onScrollAnchor?: (index: number, offsetRatio: number) => void;
  initialOffsetRatio?: number;
}

export function VerticalReader({ manifest, privateMangaId, privateRevision, fit = 'width', activeIndex, jumpToken, onActivePage, onViewedPage, onScrollAnchor, initialOffsetRatio = 0 }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const visible = useRef(activeIndex);
  const callbacks = useRef({ onActivePage, onViewedPage, onScrollAnchor });
  callbacks.current = { onActivePage, onViewedPage, onScrollAnchor };
  const anchorStamp = useRef({ index: -1, ratio: -1, at: 0 });
  const images = useRef(new Map<number, PageSource>());
  const loaded = useRef(new Set<number>());
  const privateController = useRef<AbortController | null>(null);
  const privateReady = useRef(new Set<number>());
  const privateFailed = useRef(new Set<number>());
  const retrying = useRef(new Set<number>());
  const [preload, setPreload] = useState({ready:0,failed:0,attempted:0,done:false});
  const [retryingPages, setRetryingPages] = useState<ReadonlySet<number>>(()=>new Set());
  const lastReported = useRef(-1);
  const [visibleIndex, setVisibleIndex] = useState(activeIndex);
  const [sources, setSources] = useState<Record<number, string>>({});
  const [errors, setErrors] = useState<Record<number, boolean>>({});
  const [retry, setRetry] = useState(0);

  function publishPreload(done=false) {
    setPreload({
      ready:privateReady.current.size,
      failed:privateFailed.current.size,
      attempted:privateReady.current.size+privateFailed.current.size,
      done,
    });
  }

  async function retryPrivatePage(index:number){
    if(!privateMangaId||!privateRevision||retrying.current.has(index))return;
    const controller=privateController.current;
    if(!controller||controller.signal.aborted)return;
    retrying.current.add(index);
    setRetryingPages(new Set(retrying.current));
    try{
      const source=await resolvePrivatePage(manifest,index,privateMangaId,privateRevision,controller.signal);
      if(controller.signal.aborted){source.release();return;}
      images.current.get(index)?.release();
      images.current.set(index,source);
      privateFailed.current.delete(index);
      privateReady.current.add(index);
      setErrors(previous=>{const next={...previous};delete next[index];return next;});
      setSources(previous=>({...previous,[index]:source.src}));
      publishPreload(preload.done);
    }catch{
      if(!controller.signal.aborted){
        privateFailed.current.add(index);
        privateReady.current.delete(index);
        setErrors(previous=>({...previous,[index]:true}));
        publishPreload(preload.done);
      }
    }finally{
      retrying.current.delete(index);
      if(!controller.signal.aborted)setRetryingPages(new Set(retrying.current));
    }
  }

  function reportViewed(index: number) {
    if (loaded.current.has(index) && index === visible.current && lastReported.current !== index) {
      lastReported.current = index;
      callbacks.current.onViewedPage(index);
    }
  }

  useEffect(() => {
    // The demo remains lightweight. Real pages are downloaded by a separate
    // chapter-wide queue, independent of scroll position.
    if(privateMangaId&&privateRevision)return;
    let cancelled = false;
    const wanted = pagePrefetchWindow(visibleIndex,manifest.pages.length);
    const prior = images.current;
    const fetches = wanted.map(async index => {
      if (prior.has(index) && retry === 0) return { index, source: prior.get(index)!, error: false, fresh: false };
      try {
        const source = privateMangaId && privateRevision
          ? await resolvePrivatePage(manifest,index,privateMangaId,privateRevision)
          : await resolveSyntheticPage(manifest, index);
        return { index, source, error: false, fresh: true };
      } catch {
        return { index, source: null, error: true, fresh: false };
      }
    });
    void Promise.all(fetches).then(results => {
      if (cancelled) {
        for (const result of results) if (result.fresh) result.source?.release();
        return;
      }
      const next = new Map<number, PageSource>();
      const failed: Record<number, boolean> = {};
      for (const result of results) {
        if (result.source) next.set(result.index, result.source);
        if (result.error) { failed[result.index] = true; loaded.current.delete(result.index); }
      }
      for (const [index, source] of prior) if (!next.has(index) || next.get(index) !== source) source.release();
      images.current = next;
      for (const index of Array.from(loaded.current)) if (!next.has(index)) loaded.current.delete(index);
      setSources(Object.fromEntries([...next].map(([index, source]) => [index, source.src])));
      setErrors(failed);
    });
    return () => { cancelled = true; };
  }, [manifest, visibleIndex, retry, privateMangaId, privateRevision]);

  useEffect(() => {
    if(!privateMangaId||!privateRevision)return;
    const controller=new AbortController();
    privateController.current=controller;
    for(const source of images.current.values())source.release();
    images.current.clear();
    privateReady.current.clear();privateFailed.current.clear();retrying.current.clear();
    loaded.current.clear();lastReported.current=-1;
    setSources({});setErrors({});setRetryingPages(new Set());
    setPreload({ready:0,failed:0,attempted:0,done:false});
    // Queue every page immediately. No scroll event is required to start,
    // and a failed page does not stop the remaining downloads.
    void preloadChapterPages(
      manifest.pages.length,
      (index,signal)=>resolvePrivatePage(manifest,index,privateMangaId,privateRevision,signal),
      (index,source)=>{
        images.current.set(index,source);
        privateReady.current.add(index);
        privateFailed.current.delete(index);
        setSources(previous=>({...previous,[index]:source.src}));
        publishPreload();
      },
      index=>{
        privateFailed.current.add(index);
        privateReady.current.delete(index);
        setErrors(previous=>({...previous,[index]:true}));
        publishPreload();
      },
      controller.signal,
      3,
    ).finally(()=>{
      if(!controller.signal.aborted)publishPreload(true);
    });
    return ()=>{
      controller.abort();
      if(privateController.current===controller)privateController.current=null;
      for(const source of images.current.values())source.release();
      images.current.clear();
    };
  // Avoid restarting the whole chapter when a page becomes visible.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[manifest,privateMangaId,privateRevision]);

  useEffect(() => () => {
    privateController.current?.abort();
    for (const source of images.current.values()) source.release();
    images.current.clear();
  }, []);

  useEffect(() => {
    let frame = 0;
    const checkVisible = () => {
      frame = 0;
      // All direct children are page slots. HTMLCollection avoids an O(n) selector
      // scan, and binary search reads O(log n) element rectangles per scroll.
      const slots = root.current?.children;
      if (!slots?.length) return;
      // An anchored point inside the viewport is more stable than intersection
      // ratios for unusually tall webtoon/long-strip images.
      const anchor = window.innerHeight * 0.38;
      const candidate = anchoredPageIndex(slots.length,anchor,index=>
        (slots[index] as HTMLElement).getBoundingClientRect().bottom);
      if (candidate !== visible.current) {
        visible.current = candidate;
        setVisibleIndex(candidate);
        callbacks.current.onActivePage(candidate);
      }
      reportViewed(candidate);
      const slot = slots[candidate] as HTMLElement;
      const bounds = slot.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (anchor - bounds.top) / Math.max(1, bounds.height)));
      const last = anchorStamp.current;
      if (loaded.current.has(candidate) && (candidate !== last.index || Math.abs(ratio - last.ratio) >= 0.08)
          && Date.now() - last.at >= 1250) {
        anchorStamp.current = { index: candidate, ratio, at: Date.now() };
        callbacks.current.onScrollAnchor?.(candidate, ratio);
      }
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(checkVisible);
    };
    // Capturing scroll also supports scrolling inside the Fullscreen API host.
    document.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    schedule();
    return () => {
      document.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [manifest.chapterId]);

  useEffect(() => {
    const slot = root.current?.children.item(activeIndex) as HTMLElement | null;
    slot?.scrollIntoView({ block: 'start', behavior: 'instant' });
    if (slot && initialOffsetRatio > 0 && initialOffsetRatio <= 1)
      window.scrollBy({ top: slot.getBoundingClientRect().height * initialOffsetRatio, behavior: 'instant' });
  // A scroll-tracked page update must NOT jump the viewport back to the top.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifest.chapterId, jumpToken]);

  const displayedStart=Math.max(0,visibleIndex-3);
  const displayedEnd=Math.min(manifest.pages.length-1,visibleIndex+5);
  return <>
    {privateMangaId&&<div className="chapter-preload-progress" role="status" aria-live="polite">
      <div className="chapter-preload-heading">
        <strong>{preload.done ? 'Chapter download attempted' : 'Loading the entire chapter…'}</strong>
        <span>{preload.ready} of {manifest.pages.length} pages ready</span>
      </div>
      <progress value={preload.attempted} max={manifest.pages.length}
        aria-label="Pages attempted in this chapter"/>
      <p>{preload.done
        ? preload.failed ? preload.failed+' page(s) failed. Use Retry page on any affected image.' : 'All pages are ready to read.'
        : 'Downloading pages in order while you read. Scrolling does not trigger downloads.'}</p>
    </div>}
    <div ref={root} className={"vertical-reader reader-fit-" + fit}
      aria-label="Complete manga chapter, continuous vertical scroll">
    {manifest.pages.map((page, index) =>
      <div key={page.id} data-vertical-page={index} className="vertical-page"
        style={{ aspectRatio: `${page.width} / ${page.height}` }}
        aria-label={`Page ${index + 1} of ${manifest.pages.length}`}>
        {errors[index] ?
          <div className="vertical-page-error" role="alert">
            <p>Page {index + 1} could not be loaded.</p>
            <button className="secondary" type="button" disabled={retryingPages.has(index)}
              onClick={() => {
                if(privateMangaId&&privateRevision){
                  void retryPrivatePage(index);
                  return;
                }
                images.current.get(index)?.release();
                images.current.delete(index);
                loaded.current.delete(index);
                lastReported.current = -1;
                setRetry(value => value + 1);
              }}>{retryingPages.has(index)?'Retrying…':'Retry page'}</button>
          </div> :
          sources[index] &&
          (!privateMangaId || (index>=displayedStart && index<=displayedEnd)) ?
          <img className="vertical-page-image" src={sources[index]}
            alt={privateMangaId ? `Manga page ${index + 1} of ${manifest.pages.length}` :
              `Original synthetic manga illustration, page ${index + 1}`}
            decoding="async" onLoad={() => {
              loaded.current.add(index);
              reportViewed(index);
            }}
            onError={() => {
              loaded.current.delete(index);
              setErrors(previous => ({ ...previous, [index]: true }));
            }} /> :
          <div className="vertical-page-placeholder" aria-hidden="true">
            Page {index + 1}{privateMangaId&&sources[index]?' · ready':''}
          </div>}
      </div>)}
    </div>
  </>;
}
