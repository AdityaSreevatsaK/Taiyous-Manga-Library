import {describe,it,expect} from 'vitest';
import {demoEntries} from '../data/fixtures';
import {loadProgressSummaries} from './progressSummary';
import {progressKey} from './localReaderStorage';
function storage(items:Record<string,string>):Storage{
 return {getItem:(key:string)=>items[key]??null} as Storage;
}
describe('safe private progress summaries',()=>{
 it('shows existing positions even before a chapter manifest has been downloaded',()=>{
  const manga=demoEntries[0]!,chapter=manga.chapters[0]!;
  const p={mangaId:manga.id,chapterId:chapter.id,pageId:'pg_verifiedabc',pageIndex:4,
    updatedAt:'2026-11-21T12:00:00.000Z'};
  const read=loadProgressSummaries([manga],storage({[progressKey(manga.id)]:
    JSON.stringify({schemaVersion:1,mediaKind:'manga',progress:p})}));
  expect(read.invalid).toBe(0);expect(read.progress[manga.id]).toMatchObject(p);
 });
 it('preserves but does not display invalid or unrelated progress',()=>{
  const manga=demoEntries[0]!;
  const read=loadProgressSummaries([manga],storage({[progressKey(manga.id)]:
    JSON.stringify({schemaVersion:1,mediaKind:'manga',progress:{mangaId:manga.id,
      chapterId:'ch_wrongabcdef',pageId:'pg_abcdefghi',pageIndex:4,updatedAt:'2026-11-21T12:00:00Z'}})}));
  expect(read.invalid).toBe(1);expect(read.progress).toEqual({});
 });
});
