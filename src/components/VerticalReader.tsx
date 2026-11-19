import { useEffect, useRef, useState } from 'react';
import { resolveSyntheticPage, type PageSource } from '../data/pageSource';
import type { ChapterManifest } from '../domain/types';

/**
 * Continuous document scrolling with stable image-size placeholders.
 * Only the visible page and its immediate neighbours are decoded/generated.
 * Scroll observation never selects an unseen page as "read".
 */
interface Props {
  manifest: ChapterManifest;
  fit?: 'page' | 'width';
  activeIndex: number;
  jumpToken: number;
  onActivePage: (index: number) => void;
  onViewedPage: (index: number) => void;
  onScrollAnchor?: (index: number, offsetRatio: number) => void;
  initialOffsetRatio?: number;
}

export function VerticalReader({ manifest, fit = 'width', activeIndex, jumpToken, onActivePage, onViewedPage, onScrollAnchor, initialOffsetRatio = 0 }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const visible = useRef(activeIndex);
  const callbacks = useRef({ onActivePage, onViewedPage, onScrollAnchor });
  callbacks.current = { onActivePage, onViewedPage, onScrollAnchor };
  const anchorStamp = useRef({ index: -1, ratio: -1, at: 0 });
  const images = useRef(new Map<number, PageSource>());
  const loaded = useRef(new Set<number>());
  const lastReported = useRef(-1);
  const [visibleIndex, setVisibleIndex] = useState(activeIndex);
  const [sources, setSources] = useState<Record<number, string>>({});
  const [errors, setErrors] = useState<Record<number, boolean>>({});
  const [retry, setRetry] = useState(0);

  function reportViewed(index: number) {
    if (loaded.current.has(index) && index === visible.current && lastReported.current !== index) {
      lastReported.current = index;
      callbacks.current.onViewedPage(index);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const start = Math.max(0, visibleIndex - 1);
    const end = Math.min(manifest.pages.length - 1, visibleIndex + 1);
    const wanted = Array.from({length: end - start + 1}, (_, n) => start + n);
    const prior = images.current;
    const fetches = wanted.map(async index => {
      if (prior.has(index) && retry === 0) return { index, source: prior.get(index)!, error: false, fresh: false };
      try {
        const source = await resolveSyntheticPage(manifest, index);
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
  }, [manifest, visibleIndex, retry]);

  useEffect(() => () => {
    for (const source of images.current.values()) source.release();
    images.current.clear();
  }, []);

  useEffect(() => {
    let frame = 0;
    const checkVisible = () => {
      frame = 0;
      const slots = root.current?.querySelectorAll<HTMLElement>('[data-vertical-page]');
      if (!slots?.length) return;
      // An anchored point inside the viewport is more stable than intersection
      // ratios for unusually tall webtoon/long-strip images.
      const anchor = window.innerHeight * 0.38;
      let candidate = slots.length - 1;
      for (let index = 0; index < slots.length; index++) {
        if (slots[index]!.getBoundingClientRect().bottom > anchor) {
          candidate = index;
          break;
        }
      }
      if (candidate !== visible.current) {
        visible.current = candidate;
        setVisibleIndex(candidate);
        callbacks.current.onActivePage(candidate);
      }
      reportViewed(candidate);
      const slot = slots[candidate]!;
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
    const slot = root.current?.querySelectorAll<HTMLElement>('[data-vertical-page]')[activeIndex];
    slot?.scrollIntoView({ block: 'start', behavior: 'instant' });
    if (slot && initialOffsetRatio > 0 && initialOffsetRatio <= 1)
      window.scrollBy({ top: slot.getBoundingClientRect().height * initialOffsetRatio, behavior: 'instant' });
  // A scroll-tracked page update must NOT jump the viewport back to the top.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifest.chapterId, jumpToken]);

  return <div ref={root} className={"vertical-reader reader-fit-" + fit} aria-label="Complete manga chapter, continuous vertical scroll">
    {manifest.pages.map((page, index) =>
      <div key={page.id} data-vertical-page={index} className="vertical-page"
        style={{ aspectRatio: `${page.width} / ${page.height}` }}
        aria-label={`Page ${index + 1} of ${manifest.pages.length}`}>
        {errors[index] ?
          <div className="vertical-page-error" role="alert">
            <p>Page {index + 1} could not be loaded.</p>
            <button className="secondary" type="button" onClick={() => {
              images.current.get(index)?.release();
              images.current.delete(index);
              loaded.current.delete(index);
              lastReported.current = -1;
              setRetry(value => value + 1);
            }}>Retry page</button>
          </div> :
          sources[index] ?
          <img className="vertical-page-image" src={sources[index]}
            alt={`Original synthetic manga illustration, page ${index + 1}`}
            decoding="async" onLoad={() => {
              loaded.current.add(index);
              reportViewed(index);
            }}
            onError={() => {
              loaded.current.delete(index);
              setErrors(previous => ({ ...previous, [index]: true }));
            }} /> :
          <div className="vertical-page-placeholder" aria-hidden="true">Page {index + 1}</div>}
      </div>)}
  </div>;
}
