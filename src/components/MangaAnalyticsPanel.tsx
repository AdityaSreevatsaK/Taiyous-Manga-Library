import {useEffect,useMemo,useState,type MouseEvent} from 'react';
import type {MangaEntry} from '../domain/types';
import type {computeLocalReadingAnalytics} from '../domain/advancedDiscovery';
import {clearMangaUsage,mangaDuration,mangaLocalDay,readMangaUsage,setMangaUsageEnabled,
  type MangaUsageEvent} from '../domain/usageAnalytics';
import './manga-usage-analytics.css';

type Analytics=ReturnType<typeof computeLocalReadingAnalytics>;
interface Props{
  analytics:Analytics;entries:readonly MangaEntry[];
  detailHref:(mangaId:string)=>string;
  onOpenDetails:(event:MouseEvent<HTMLAnchorElement>,mangaId:string)=>void;
  onReading:()=>void;
}
function downloadAnalytics():void{
  const data={...readMangaUsage(),exportedAt:new Date().toISOString()};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='taiyou-manga-analytics-'+mangaLocalDay()+'.json';a.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const eventLabel=(event:MangaUsageEvent):string=>{
  switch(event.kind){
    case 'chapter-opened':return 'Opened chapter';
    case 'page-viewed':return 'Viewed page'+(event.page?' '+event.page:'');
    case 'chapter-completed':return 'Marked chapter complete';
    case 'chapter-reopened':return 'Reopened chapter';
    case 'shelf-changed':return 'Updated personal shelf';
    case 'personal-edit':return 'Updated personal details';
  }
};
/** Live, private analytics from real device-local activity, never reconstructed history. */
export function MangaAnalyticsPanel({analytics,entries,detailHref,onOpenDetails,onReading}:Props){
  const [usage,setUsage]=useState(readMangaUsage);
  const [confirmClear,setConfirmClear]=useState(false);
  const [clearText,setClearText]=useState('');
  useEffect(()=>{
    const update=()=>setUsage(readMangaUsage());
    window.addEventListener('taiyou-manga-usage-changed',update);
    window.addEventListener('storage',update);
    const refresh=window.setInterval(update,30000);
    return ()=>{window.removeEventListener('taiyou-manga-usage-changed',update);
      window.removeEventListener('storage',update);window.clearInterval(refresh);};
  },[]);
  const titleById=useMemo(()=>new Map(entries.map(e=>[e.id,e])),[entries]);
  const totals=Object.values(usage.days).reduce((acc,day)=>({
    appMs:acc.appMs+day.appMs,readingMs:acc.readingMs+day.readingMs,offlineMs:acc.offlineMs+day.offlineMs
  }),{appMs:0,readingMs:0,offlineMs:0});
  const today=usage.days[mangaLocalDay()]??{appMs:0,readingMs:0,offlineMs:0};
  const days=Array.from({length:14},(_,index)=>{
    const date=new Date();date.setHours(12,0,0,0);date.setDate(date.getDate()-13+index);
    const key=mangaLocalDay(date);
    return {key,date,...(usage.days[key]??{appMs:0,readingMs:0,offlineMs:0})};
  });
  const maxMs=Math.max(60000,...days.map(day=>day.appMs));
  const mostRead=Object.entries(usage.mangaReadingMs).sort((a,b)=>b[1]-a[1]).slice(0,12);
  const history=[...usage.events].reverse().slice(0,50);
  return <section className="analytics-shelf manga-usage-dashboard" aria-label="Personal reading analytics">
    <p className="eyebrow">YOUR MANGA READING JOURNAL / THIS DEVICE</p>
    <h2>Analytics</h2>
    <p>Actual saved progress and approximate active reading time, recorded locally on this device.
      Time tracking begins with this update; earlier reading minutes cannot be reconstructed.</p>
    <div className="manga-usage-times" aria-label="Time spent reading manga">
      <article><span>Active app time</span><strong>{mangaDuration(totals.appMs)}</strong>
        <small>Foreground and non-idle</small></article>
      <article><span>Manga reading time</span><strong>{mangaDuration(totals.readingMs)}</strong>
        <small>While a manga chapter was open</small></article>
      <article><span>Reading today</span><strong>{mangaDuration(today.readingMs)}</strong>
        <small>On this device</small></article>
      <article><span>Offline app time</span><strong>{mangaDuration(totals.offlineMs)}</strong>
        <small>While disconnected</small></article>
    </div>
    <div className="analytics-grid">
      <div><strong>{analytics.started}</strong><span>Series with saved reading progress</span></div>
      <div><strong>{analytics.reading}</strong><span>Currently reading</span></div>
      <div><strong>{analytics.finished}</strong><span>Personally finished</span></div>
      <div><strong>{analytics.toRead}</strong><span>To Be Read</span></div>
      <div><strong>{analytics.trying}</strong><span>Trying Out</span></div>
      <div><strong>{analytics.downloadedChapters}</strong><span>Offline chapters in {analytics.offlineSeries} series</span></div>
      <div><strong>{analytics.avgRating??'–'}</strong><span>Average rating / 10 ({analytics.rated} rated)</span></div>
      <div><strong>{analytics.total}</strong><span>Catalogue series</span></div>
    </div>
    <div className="manga-usage-panels">
      <section className="manga-usage-panel" aria-label="Last 14 days of reading activity">
        <h3>Last 14 days</h3>
        <div className="manga-usage-chart" role="group" aria-label="Daily app and reading times">
          {days.map(d=><div key={d.key} className="manga-usage-day"
            title={d.key+': app '+mangaDuration(d.appMs)+', reading '+mangaDuration(d.readingMs)}>
            <div className="manga-usage-track">
              <div className="manga-usage-app-bar" style={{height:d.appMs/maxMs*100+'%'}}/>
              <div className="manga-usage-read-bar" style={{height:d.readingMs/maxMs*100+'%'}}/>
            </div><small>{d.date.toLocaleDateString('en-GB',{weekday:'short'}).slice(0,2)}</small>
          </div>)}
        </div>
        <p className="manga-usage-legend">App usage <span>■</span>  Reading time <b>■</b></p>
      </section>
      <section className="manga-usage-panel">
        <h3>Most read manga</h3>
        {mostRead.length?<ol className="manga-usage-rank">
          {mostRead.map(([id,ms])=><li key={id}>
            {titleById.has(id)?<a href={detailHref(id)} onClick={event=>onOpenDetails(event,id)}>
              {titleById.get(id)!.title}</a>:<span>Series no longer in catalogue</span>}
            <strong>{mangaDuration(ms)}</strong>
          </li>)}</ol>:<p>No tracked reading time yet. Open and read a chapter to begin.</p>}
      </section>
      <section className="manga-usage-panel">
        <h3>Recent reading positions</h3>
        {analytics.recent.length?<ol className="manga-usage-positions">
          {analytics.recent.slice(0,12).map(item=><li key={item.mangaId}>
            <a href={detailHref(item.mangaId)} onClick={event=>onOpenDetails(event,item.mangaId)}>
              {item.title}</a>
            <span>{item.chapter} · Page {item.page} · {new Date(item.savedAt).toLocaleString('en-GB')}</span>
          </li>)}</ol>:<p>Open a chapter and load a page to save its reading position.</p>}
      </section>
      <section className="manga-usage-panel">
        <h3>Reading activity</h3>
        {history.length?<ol className="manga-usage-history">
          {history.map((e,i)=><li key={e.at+e.kind+e.mangaId+i}>
            <span><strong>{titleById.get(e.mangaId)?.title??'Unlisted manga'}</strong>
              {' · '+eventLabel(e)}{e.chapterId?
                ' · '+(titleById.get(e.mangaId)?.chapters.find(c=>c.id===e.chapterId)?.label??'Chapter'):''}
              {e.detail?' · '+e.detail:''}</span>
            <time dateTime={e.at}>{new Date(e.at).toLocaleString('en-GB')}</time>
          </li>)}</ol>:<p>No reading actions have been recorded yet.</p>}
      </section>
    </div>
    <div className="analytics-detail-grid">
      <section className="analytics-genres"><h3>Genres in Currently Reading</h3>
        {analytics.genres.length?<ul>{analytics.genres.slice(0,8).map(g=><li key={g.name}>
          <span>{g.name}</span><strong>{g.count}</strong></li>)}</ul>:
          <p>Start reading a manga to see its genres.</p>}
      </section>
      <section className="analytics-ratings"><h3>My ratings distribution</h3>
        {analytics.rated?<div className="ratings-histogram">{analytics.ratingsDistribution.map(r=>
          <div className="rating-column" key={r.score} aria-label={r.score+'/10: '+r.count+' manga'}>
            <span>{r.count||''}</span><div className="rating-bar"
              style={{height:r.count/analytics.rated*100+'%'}}/><small>{r.score}</small>
          </div>)}</div>:<p>Rate manga to see your distribution.</p>}
      </section>
    </div>
    <section className="manga-usage-panel manga-usage-privacy" aria-label="Reading analytics controls">
      <h3>Privacy and controls</h3>
      <p>Active time is counted only while this tab is visible, focused and recently used.
        These figures and the activity journal stay in your browser. No analytics are uploaded to Hugging Face.
        Clearing site data removes this history, not the cloud manga catalogue.</p>
      <label><input type="checkbox" checked={usage.enabled}
        onChange={event=>setUsage(setMangaUsageEnabled(event.target.checked))}/>
        Record reading activity on this device</label>
      <div className="manga-usage-buttons">
        <button type="button" onClick={downloadAnalytics}>Export analytics JSON</button>
        <button type="button" disabled={confirmClear} onClick={()=>setConfirmClear(true)}>Clear analytics</button>
        <button className="secondary" type="button" onClick={onReading}>View Currently Reading</button>
      </div>
      {confirmClear&&<div className="manga-usage-clear" role="group" aria-label="Confirm clearing analytics">
        <p>This removes your usage statistics and activity journal from this device only.
          Saved reading positions, ratings and the private manga catalogue remain unchanged.</p>
        <label htmlFor="manga-clear-analytics">Type CLEAR ANALYTICS to continue</label>
        <input id="manga-clear-analytics" value={clearText} onChange={event=>setClearText(event.target.value)}
          autoComplete="off"/>
        <div className="manga-usage-buttons">
          <button type="button" disabled={clearText!=='CLEAR ANALYTICS'} onClick={()=>{
            setUsage(clearMangaUsage());setClearText('');setConfirmClear(false);
          }}>Confirm clear analytics</button>
          <button type="button" onClick={()=>{setConfirmClear(false);setClearText('');}}>Cancel</button>
        </div>
      </div>}
    </section>
  </section>;
}
