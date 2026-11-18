import { parseCatalogue, parseChapterManifest } from '../domain/validation';
import type { ChapterManifest } from '../domain/types';

/** Entirely fictional series, creators and chapters. No rights-protected media. */
export const demoEntries = parseCatalogue([
  {
    kind: 'manga', id: 'mng_lanternarchive', title: 'The Lantern Archive',
    aliases: ['Keeper of the Last Light'], creators: ['Taiyou Studio (fictional)'],
    tags: ['Mystery', 'Fantasy', 'Adventure'], publicationStatus: 'ongoing',
    direction: 'rtl', rating: 9, collections: ['Nightfall Stories'],
    synopsis: 'An apprentice lantern-keeper finds a map of memories hidden in the city lights. An original, synthetic demonstration series.',
    chapters: [
      { id: 'ch_lanternopening', label: '01 · The forgotten key', sequence: 10, volume: 'Volume I', pageCount: 5 },
      { id: 'ch_lanternrooftop', label: '02 · Above the rooftops', sequence: 20, volume: 'Volume I', pageCount: 4 },
      { id: 'ch_lanternafterglow', label: '03 · Afterglow', sequence: 30, volume: 'Volume II', pageCount: 6 },
    ],
  },
  {
    kind: 'manga', id: 'mng_silvergarden', title: 'The Silver Garden',
    aliases: ['Garden Under Stars'], creators: ['Taiyou Studio (fictional)'],
    tags: ['Slice of Life', 'Fantasy', 'Drama'], publicationStatus: 'completed',
    direction: 'ltr', rating: 8, collections: ['Quiet Worlds'],
    synopsis: 'A quiet botanist discovers a greenhouse whose flowers bloom only beneath passing constellations. An entirely fictional sample.',
    chapters: [
      { id: 'ch_gardenmorning', label: '01 · Morning bloom', sequence: 10, volume: 'Volume I', pageCount: 4 },
      { id: 'ch_gardenevening', label: '02 · Evening stars', sequence: 20, volume: 'Volume I', pageCount: 5 },
    ],
  },
  {
    kind: 'manga', id: 'mng_clockworkshore', title: 'Clockwork Shore',
    aliases: ['Tide of Machines'], creators: ['Taiyou Studio (fictional)'],
    tags: ['Adventure', 'Science Fiction'], publicationStatus: 'hiatus',
    direction: 'vertical', collections: ['Nightfall Stories'],
    synopsis: 'On a distant coast, the tide brings intricate machines and unanswered letters to shore. An original fixture, not an actual manga.',
    chapters: [{ id: 'ch_shorefirsttide', label: '01 · First tide', sequence: 10, volume: 'Volume I', pageCount: 5 }],
  },
]);

export const demoManifests: ReadonlyMap<string, ChapterManifest> = new Map(
  demoEntries.flatMap(entry => entry.chapters.map(chapter => [
    chapter.id,
    parseChapterManifest({
      schemaVersion: 1, mediaKind: 'manga', chapterId: chapter.id,
      pages: Array.from({ length: chapter.pageCount ?? 0 }, (_, index) => ({
        id: 'pg_' + chapter.id.slice(3) + '_' + String(index).padStart(4, '0'),
        assetPath: 'manga/' + entry.id + '/' + chapter.id + '/page' + index + '.png',
        mimeType: 'image/png', width: 680, height: 920, byteSize: 20000,
      })),
    }),
  ] as const)),
);
export const fixtureStatement = 'Fictional demonstration. Pages are generated in your browser. No actual manga, provider or private catalogue is connected.';
