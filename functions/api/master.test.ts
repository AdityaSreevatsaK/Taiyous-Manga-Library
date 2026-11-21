import {describe,it,expect} from 'vitest';
import {demoEntries} from '../../src/data/fixtures';
import {applyMetadataCorrection,parseMetadataCorrection} from './master';
const revision='a'.repeat(40);
const source={schemaVersion:1,mediaKind:'manga',entries:demoEntries};
describe('protected catalogue metadata correction',()=>{
  it('rejects malformed revisions, unrelated IDs and extra fields',()=>{
    expect(parseMetadataCorrection({mangaId:demoEntries[0]!.id,revision:'abc',title:'New'})).toBeNull();
    expect(parseMetadataCorrection({mangaId:demoEntries[0]!.id,revision,title:'New',delete:true})).toBeNull();
    expect(parseMetadataCorrection({mangaId:demoEntries[0]!.id,revision})).toBeNull();
    expect(parseMetadataCorrection({mangaId:demoEntries[0]!.id,revision,creators:['Same','same']})).toBeNull();
  });
  it('preserves immutable manga/chapter identities and untouched records',()=>{
    const manga=demoEntries[0]!;
    const patch=parseMetadataCorrection({mangaId:manga.id,revision,title:'Updated Manga Title',
      creators:['Verified Writer'],publicationStatus:'completed'});
    expect(patch).not.toBeNull();
    const corrected=applyMetadataCorrection(source,patch!) as typeof source;
    const modified=corrected.entries[0]!;
    expect(modified.title).toBe('Updated Manga Title');
    expect(modified.creators).toEqual(['Verified Writer']);
    expect(modified.publicationStatus).toBe('completed');
    expect(modified.id).toBe(manga.id);
    expect(modified.chapters).toEqual(manga.chapters);
    expect(corrected.entries.slice(1)).toEqual(source.entries.slice(1));
    expect(source.entries[0]!.title).not.toBe('Updated Manga Title');
  });
  it('rejects unavailable entry rather than rewriting the full catalogue',()=>{
    expect(()=>applyMetadataCorrection(source,{mangaId:'mng_notpresentxyz',revision,title:'Unknown'})).toThrow();
  });
});
