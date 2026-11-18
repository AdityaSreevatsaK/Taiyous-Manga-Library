import { describe, expect, it } from 'vitest';
import { demoEntries, demoManifests } from './fixtures';
import { parseCatalogue, parseChapterManifest } from '../domain/validation';
describe('original in-memory fixture contracts', () => {
  it('defines only fictional entries with unique stable IDs and coherent page counts', () => {
    expect(parseCatalogue(demoEntries)).toHaveLength(3);
    const chapters = demoEntries.flatMap(entry => entry.chapters);
    expect(chapters.length).toBeGreaterThanOrEqual(5);
    for (const chapter of chapters) {
      const manifest = demoManifests.get(chapter.id);
      expect(manifest).toBeDefined();
      expect(parseChapterManifest(manifest).pages).toHaveLength(chapter.pageCount ?? 0);
    }
  });
  it('provides safe local paths without third-party URLs or SVG content', () => {
    for (const manifest of demoManifests.values())
      for (const page of manifest.pages) {
        expect(page.assetPath).toMatch(/^manga\//);
        expect(page.assetPath).not.toContain('http');
        expect(page.mimeType).toBe('image/png');
      }
  });
});
