import { useEffect, useRef, useState } from 'react';
import { makeFixturePage } from '../data/fixtureArt';
import type { ChapterManifest } from '../domain/types';

/**
 * Continuous document scrolling with stable image-size placeholders.
 * Only the visible page and its immediate neighbours are decoded/generated.
 * Scroll observation never selects an unseen page as "read".
 */
interface Props {
  manifest: ChapterManifest;
  activeIndex: number;
  jumpToken: number;
  onActivePage: (index: number) => void;
  onViewedPage: (index: number) => void;
}

export function VerticalReader({ manifest, activeIndex, jumpToken, onActivePage, onViewedPage }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const visible = useRef(activeIndex);
  const callbacks = useRef({ onActivePage, onViewedPage });
  callbacks.current = { onActivePage, onViewedPage };
  const images = useRef(new Map<number, string>());
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
    // The cache remains bounded even when scrolling through a very long chapter.
    const next = new Map<number, string>();
    const failed: Record<number, boolean> = {};
    for (let index = Math.max(0, visibleIndex - 1);
      index <= Math.min(manifest.pages.length - 1, visibleIndex + 1); index++) {
      try {
        next.set(index, images.current.get(index) ?? makeFixturePage(manifest.chapterId, index));
      } catch {
        failed[index] = true;
        loaded.current.delete(index);
      }
    }
    images.current = next;
    for (const index of Array.from(loaded.current)) if (!next.has(index)) loaded.current.delete(index);
    setSources(Object.fromEntries(next));
    setErrors(failed);
  }, [manifest, visibleIndex, retry]);

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
    root.current?.querySelectorAll<HTMLElement>('[data-vertical-page]')[activeIndex]?.scrollIntoView({
      block: 'start', behavior: 'auto',
    });
  // A scroll-tracked page update must NOT jump the viewport back to the top.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifest.chapterId, jumpToken]);

  return <div ref={root} className="vertical-reader" aria-label="Continuous vertical manga pages">
    {manifest.pages.map((page, index) =>
      <div key={page.id} data-vertical-page={index} className="vertical-page"
        style={{ aspectRatio: `${page.width} / ${page.height}` }}
        aria-label={`Page ${index + 1} of ${manifest.pages.length}`}>
        {errors[index] ?
          <div className="vertical-page-error" role="alert">
            <p>Page {index + 1} could not be loaded.</p>
            <button className="secondary" type="button" onClick={() => {
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
