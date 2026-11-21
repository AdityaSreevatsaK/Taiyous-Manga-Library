import { parseCatalogue, parseChapterManifest, parseSourceRights,
  DomainValidationError } from './validation';
import type { MangaEntry, ChapterManifest, MangaPage, SourceRights } from './types';

/**
 * Legacy design-time media-port contract and runtime response validators.
 * The UnconnectedPrivateMedia stub below is retained for no-network unit tests only.
 * Production HTTP access is implemented in src/data/privateLibrary.ts and
 * src/data/privateMedia.ts, with owner authorisation in functions/api/*.
 */
export type MediaFailure =
  | { status:'not-connected' }
  | { status:'unauthorised' }
  | { status:'forbidden' }
  | { status:'not-found' }
  | { status:'rate-limited' }
  | { status:'unavailable' };
export type MediaResult<T> = {status:'ok';value:T} | MediaFailure;
export interface MediaPageIdentity {
  mangaId:string;
  chapterId:string;
  pageId:string;
}
export interface VerifiedPageResponse {
  page: MangaPage;
  /** An authorised first-party binary, not a provider hotlink or external URL. */
  bytes: Uint8Array;
}
export interface AuthorisedPrivateMediaPort {
  /** Authenticate with server-held, same-origin session; never place secrets in JS. */
  getCatalogue(signal?:AbortSignal):Promise<MediaResult<readonly MangaEntry[]>>;
  getChapterManifest(mangaId:string,chapterId:string,signal?:AbortSignal):
    Promise<MediaResult<ChapterManifest>>;
  getRights(mangaId:string,signal?:AbortSignal):Promise<MediaResult<SourceRights>>;
  getPage(identity:MediaPageIdentity,signal?:AbortSignal):
    Promise<MediaResult<VerifiedPageResponse>>;
}
/** Safe no-network stub for tests and legacy callers; never use as the production gateway. */
export class UnconnectedPrivateMedia implements AuthorisedPrivateMediaPort {
  async getCatalogue(_signal?:AbortSignal):Promise<MediaFailure> {return {status:'not-connected'};}
  async getChapterManifest(_mangaId:string,_chapterId:string,_signal?:AbortSignal):Promise<MediaFailure> {return {status:'not-connected'};}
  async getRights(_mangaId:string,_signal?:AbortSignal):Promise<MediaFailure> {return {status:'not-connected'};}
  async getPage(_identity:MediaPageIdentity,_signal?:AbortSignal):Promise<MediaFailure> {return {status:'not-connected'};}
}
/**
 * Validates exact catalogue/chapter/page lineage. This is a data-integrity
 * check, not an authentication check; production authorisation is server-side.
 * Caller-supplied URLs are never accepted.
 */
export function verifyPageIdentity(identity:MediaPageIdentity,
  entries:readonly MangaEntry[],manifests:ReadonlyMap<string,ChapterManifest>):MangaPage {
  if(!identity||typeof identity.mangaId!=='string'||typeof identity.chapterId!=='string'||
    typeof identity.pageId!=='string')
    throw new DomainValidationError('page.identity','expected stable IDs');
  const entry=entries.find(item=>item.id===identity.mangaId);
  if(!entry)throw new DomainValidationError('page.mangaId','series not found');
  if(!entry.chapters.some(chapter=>chapter.id===identity.chapterId))
    throw new DomainValidationError('page.chapterId','chapter does not belong to series');
  const manifest=manifests.get(identity.chapterId);
  if(!manifest||manifest.chapterId!==identity.chapterId||manifest.mediaKind!=='manga')
    throw new DomainValidationError('page.manifest','missing or mismatched chapter manifest');
  const verified=parseChapterManifest(manifest);
  const page=verified.pages.find(item=>item.id===identity.pageId);
  if(!page)throw new DomainValidationError('page.pageId','page not found in chapter');
  return page;
}
/**
 * Runtime validation of future API boundary responses.
 * Rejects inconsistent identities, unsafe paths and unlicensed claims.
 * This is not an authorisation check and must never be treated as one.
 */
export function verifyPrivateCatalogue(raw:unknown):readonly MangaEntry[] {
  return parseCatalogue(raw);
}
export function verifyPrivateManifest(raw:unknown,mangaId:string,
  expectedChapterId:string,entries:readonly MangaEntry[]):ChapterManifest {
  const entry=entries.find(item=>item.id===mangaId);
  if(!entry||!entry.chapters.some(chapter=>chapter.id===expectedChapterId))
    throw new DomainValidationError('manifest.chapterId','chapter not in catalogue series');
  const manifest=parseChapterManifest(raw);
  if(manifest.chapterId!==expectedChapterId)
    throw new DomainValidationError('manifest.chapterId','manifest does not match requested chapter');
  return manifest;
}
export function verifyPrivateRights(raw:unknown):SourceRights {
  return parseSourceRights(raw);
}
