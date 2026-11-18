import { describe, expect, it } from 'vitest';
import { demoManifests } from './fixtures';
import { receiptIsValid, type ChapterReceipt } from './offlineChapters';

const manifest = demoManifests.values().next().value!;
const complete: ChapterReceipt = {
  schemaVersion:1,mediaKind:'manga',chapterId:manifest.chapterId,
  completedAt:'2026-11-18T15:00:00.000Z',
  pages:manifest.pages.map(page=>({pageId:page.id,sha256:'a'.repeat(64),byteSize:3000})),
};
describe('offline chapter manifest integrity', () => {
  it('accepts complete checksum receipts matching every immutable page',()=>{
    expect(receiptIsValid(complete,manifest)).toBe(true);
  });
  it('rejects missing, reordered and duplicated page receipts',()=>{
    expect(receiptIsValid({...complete,pages:complete.pages.slice(1)},manifest)).toBe(false);
    expect(receiptIsValid({...complete,pages:[...complete.pages].reverse()},manifest)).toBe(false);
    expect(receiptIsValid({...complete,pages:[complete.pages[0],complete.pages[0],...complete.pages.slice(2)]},manifest)).toBe(false);
  });
  it('rejects incorrect chapter and unsupported schema versions',()=>{
    expect(receiptIsValid({...complete,chapterId:'ch_unknown'},manifest)).toBe(false);
    expect(receiptIsValid({...complete,schemaVersion:2},manifest)).toBe(false);
    expect(receiptIsValid({...complete,mediaKind:'novel'},manifest)).toBe(false);
  });
  it('rejects invalid, too large and missing content fingerprints',()=>{
    expect(receiptIsValid({...complete,pages:[{...complete.pages[0],sha256:'zz'},...complete.pages.slice(1)]},manifest)).toBe(false);
    expect(receiptIsValid({...complete,pages:[{...complete.pages[0],byteSize:0},...complete.pages.slice(1)]},manifest)).toBe(false);
    expect(receiptIsValid({...complete,pages:[{...complete.pages[0],byteSize:80*1024*1024},...complete.pages.slice(1)]},manifest)).toBe(false);
    expect(receiptIsValid({...complete,pages:[{...complete.pages[0],sha256:undefined},...complete.pages.slice(1)]},manifest)).toBe(false);
  });
  it('rejects corrupt completion timestamps and type confusion',()=>{
    expect(receiptIsValid({...complete,completedAt:'invalid'},manifest)).toBe(false);
    expect(receiptIsValid({...complete,completedAt:0},manifest)).toBe(false);
    expect(receiptIsValid(null,manifest)).toBe(false);
    expect(receiptIsValid([],manifest)).toBe(false);
  });
});
