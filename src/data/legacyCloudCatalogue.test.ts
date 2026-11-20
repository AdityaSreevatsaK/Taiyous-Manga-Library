import {describe,expect,it} from 'vitest';
import {parseCloudCatalogue,parseLegacyCatalogue} from '../../functions/api/library';
import {demoEntries} from './fixtures';

describe('private HF catalogue migration compatibility',()=>{
 it('accepts existing root catalogue arrays but does not change the canonical schema',()=>{
   expect(parseLegacyCatalogue(demoEntries)).toEqual(demoEntries);
   expect(parseCloudCatalogue({schemaVersion:1,mediaKind:'manga',entries:demoEntries})).toEqual(demoEntries);
   expect(()=>parseCloudCatalogue(demoEntries)).toThrow('Invalid manga catalogue envelope');
 });
 it('rejects malformed legacy records and catalogue envelopes',()=>{
   expect(()=>parseLegacyCatalogue({schemaVersion:1,mediaKind:'manga',entries:[]})).toThrow();
   expect(()=>parseLegacyCatalogue([{title:'Unsafe record'}])).toThrow();
   expect(()=>parseCloudCatalogue({schemaVersion:2,mediaKind:'manga',entries:[]})).toThrow();
   expect(()=>parseCloudCatalogue({schemaVersion:1,mediaKind:'novel',entries:[]})).toThrow();
 });
});
