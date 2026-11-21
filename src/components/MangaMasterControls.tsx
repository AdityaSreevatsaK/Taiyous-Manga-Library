import {useMemo,useState,type MouseEvent} from 'react';
import type {MangaEntry,MangaProgress} from '../domain/types';
import type {PersonalAnnotation,AnnotationPatch} from '../domain/personalAnnotations';
import type {PersonalShelf,ShelfSelection} from '../domain/personalShelves';
import {MangaMasterRecordEditor} from './MangaMasterRecordEditor';
import './manga-master-record-editor.css';
import type {computeLocalReadingAnalytics} from '../domain/advancedDiscovery';
import {MangaAnalyticsPanel} from './MangaAnalyticsPanel';

interface Props {
  connected:boolean;checking:boolean;owner?:string;refreshing:boolean;
  entries:readonly MangaEntry[];
  annotations:Readonly<Record<string,PersonalAnnotation>>;
  progress:Readonly<Record<string,MangaProgress>>;
  personalShelves:Readonly<Record<string,PersonalShelf>>;
  onSaveAnnotation:(entry:MangaEntry,patch:AnnotationPatch,message:string)=>boolean;
  onSetShelf:(entry:MangaEntry,shelf:ShelfSelection)=>void;
  onResetProgress:(entry:MangaEntry)=>boolean;
  onSaveSynopsis:(entry:MangaEntry,value:string)=>boolean;
  offlineChapterIds:ReadonlySet<string>;
  analytics:ReturnType<typeof computeLocalReadingAnalytics>;
  view:'overview'|'analytics';
  overviewHref:string;analyticsHref:string;
  onView:(event:MouseEvent<HTMLAnchorElement>,view:'overview'|'analytics')=>void;
  onReading:()=>void;
  onOpenAnalyticsDetails:(event:MouseEvent<HTMLAnchorElement>,mangaId:string)=>void;
  analyticsDetailHref:(mangaId:string)=>string;
  onRefresh:()=>void;
  backHref:string;onBack:(event:MouseEvent<HTMLAnchorElement>)=>void;
  hrefFor:(entry:MangaEntry)=>string;
  onOpenDetails:(event:MouseEvent<HTMLAnchorElement>,entry:MangaEntry)=>void;
}
const storageController='https://github.com/AdityaSreevatsaK/Taiyou-Manga-Storage-Controller';
const privateDataset='https://huggingface.co/datasets/AdityaSreevatsaK/Taiyous-Manga';

/** Dedicated Master page. Personal records edit locally; protected cloud media
 * deletion remains exclusively the responsibility of the Storage Controller. */
export function MangaMasterControls({connected,checking,owner,refreshing,entries,
  annotations,progress,personalShelves,onSaveAnnotation,onSetShelf,onResetProgress,onSaveSynopsis,
  offlineChapterIds,analytics,view,overviewHref,analyticsHref,onView,
  onReading,onOpenAnalyticsDetails,analyticsDetailHref,onRefresh,backHref,onBack,hrefFor,onOpenDetails}:Props){
  const [search,setSearch]=useState('');
  const [limit,setLimit]=useState(30);
  const [expanded,setExpanded]=useState<string|null>(null);
  const results=useMemo(()=>{
    const needle=search.trim().toLocaleLowerCase();
    return [...entries].filter(entry=>!needle||
      [entry.title,entry.id,...entry.creators,...(entry.creatorRoles??[]).map(value=>value.name)]
        .some(value=>value.toLocaleLowerCase().includes(needle)))
      .sort((a,b)=>a.title.localeCompare(b.title));
  },[entries,search]);
  const rated=entries.filter(entry=>annotations[entry.id]?.rating).length;
  const started=entries.filter(entry=>progress[entry.id]).length;
  return <section className="manga-master-page" aria-labelledby="manga-master-title">
    <header className="manga-master-page-head">
      <div><p className="eyebrow">PRIVATE LIBRARY ADMINISTRATION</p>
        <h1 id="manga-master-title">Master Controls</h1>
        <p>Manage your private manga records and explore your reading journal, with the same layout as the Novel Library.</p></div>
      <a className="manga-master-back" href={backHref} onClick={onBack}>← Back to library</a>
    </header>
    <nav className="manga-master-sections" aria-label="Master Controls sections">
      <a href={overviewHref} aria-current={view==='overview'?'page':undefined}
        onClick={event=>onView(event,'overview')}>Library management</a>
      <a href={analyticsHref} aria-current={view==='analytics'?'page':undefined}
        onClick={event=>onView(event,'analytics')}>Analytics</a>
    </nav>
    {view==='analytics'?<MangaAnalyticsPanel analytics={analytics} entries={entries}
      detailHref={analyticsDetailHref}
      onOpenDetails={onOpenAnalyticsDetails} onReading={onReading}/>:
      checking?<p role="status">Checking private library access…</p>:
      !connected?<section className="manga-master-panel">
        <h2>Private owner access required</h2>
        <p>Sign in with your owning Hugging Face account to view Master Controls.</p>
        <a className="primary" href="/api/auth/login">Sign in with Hugging Face</a>
      </section>:<>
      <p className="manga-master-owner">Private catalogue connected as <strong>{owner??'the authenticated owner'}</strong></p>
      <div className="manga-master-summary" aria-label="Private catalogue summary">
        <div><strong>{entries.length.toLocaleString()}</strong><span>Manga titles</span></div>
        <div><strong>{started.toLocaleString()}</strong><span>Reading records</span></div>
        <div><strong>{rated.toLocaleString()}</strong><span>Personal ratings</span></div>
        <div><strong>{offlineChapterIds.size.toLocaleString()}</strong><span>Offline chapters</span></div>
      </div>
      <section className="manga-master-panel" aria-labelledby="manga-master-storage">
        <h2 id="manga-master-storage">Storage and synchronisation</h2>
        <p>Your catalogue and artwork remain in your private Hugging Face dataset.
          Uploads, publication changes and deletion are performed through the Manga Storage Controller.</p>
        <div className="manga-master-actions">
          <button type="button" className="primary" disabled={refreshing}
            onClick={onRefresh}>{refreshing?'Refreshing…':'Refresh catalogue'}</button>
          <a href={storageController} target="_blank" rel="noopener noreferrer">
            Manga Storage Controller ↗</a>
          <a href={privateDataset} target="_blank" rel="noopener noreferrer">View private dataset ↗</a>
        </div>
      </section>
      <section className="manga-master-panel" aria-labelledby="manga-master-records">
        <div className="manga-master-records-head"><div>
          <h2 id="manga-master-records">Manage manga records</h2>
          <p>Expand a manga to edit rating, notes, personal tags, synopsis, shelf and reading progress. Source metadata and deletion remain protected by the Storage Controller.</p></div>
          <label>Search master records
            <input type="search" value={search} placeholder="Title, author or ID…"
              onChange={event=>{setSearch(event.target.value);setLimit(30);}}/>
          </label>
        </div>
        {results.length?<div className="manga-master-record-list">
          {results.slice(0,limit).map(entry=><article key={entry.id} className="manga-master-record">
            <div><strong>{entry.title}</strong>
              <span>{entry.creators.join(', ')||'Creator not supplied'}</span></div>
            <span className="manga-master-publication">{entry.publicationStatus==='completed'?'Completed':
              entry.publicationStatus==='ongoing'?'Ongoing':
              entry.publicationStatus==='hiatus'?'On Hiatus':entry.publicationStatus==='dropped'?'Dropped':'Unknown'}</span>
            <div className="manga-master-record-meta">
              {entry.chapters.length} chapters
              <span> · </span>
              {progress[entry.id]?'In progress':'Not started'}
              <span> · </span>
              {annotations[entry.id]?.rating?annotations[entry.id]!.rating+'/10':'Unrated'}
            </div>
            <div className="manga-master-record-actions">
              <button type="button" aria-expanded={expanded===entry.id}
                aria-controls={'manga-master-edit-'+entry.id}
                onClick={()=>setExpanded(current=>current===entry.id?null:entry.id)}>
                {expanded===entry.id?'Close editor':'Edit record'}
              </button>
              <a className="manga-master-record-open" href={hrefFor(entry)}
                onClick={event=>onOpenDetails(event,entry)}>Open details ↗</a>
            </div>
            {expanded===entry.id&&<div id={'manga-master-edit-'+entry.id}
              className="manga-master-edit-container">
              <MangaMasterRecordEditor entry={entry} annotation={annotations[entry.id]}
                progress={progress[entry.id]} shelf={personalShelves[entry.id]}
                onSaveAnnotation={onSaveAnnotation} onSetShelf={onSetShelf}
                onResetProgress={onResetProgress} onSaveSynopsis={onSaveSynopsis}/>
            </div>}
          </article>)}
        </div>:<p role="status">No manga match your search.</p>}
        {results.length>limit&&<button type="button" className="manga-master-show-more"
          onClick={()=>setLimit(current=>current+30)}>
          Show more ({results.length-limit} remaining)</button>}
      </section>
    </>}
  </section>;
}
