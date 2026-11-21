import {useEffect,useMemo,useState,type MouseEvent} from 'react';
import type {MangaEntry} from '../domain/types';
import type {computeLocalReadingAnalytics} from '../domain/advancedDiscovery';
import {clearMangaUsage,mangaDuration,mangaLocalDay,readMangaUsage,setMangaUsageEnabled,
  type MangaUsageEvent} from '../domain/usageAnalytics';
import {BarChart3Icon,BookOpenIcon,Clock3Icon,DownloadIcon,EraserIcon,
  ShieldCheckIcon,WifiOffIcon} from './SharedLibraryIcons';
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
/** Match Novel's four-metric reading dashboard; keep manga-only insights on demand. */
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
  const totals=useMemo(()=>Object.values(usage.days).reduce((acc,day)=>({
    appMs:acc.appMs+day.appMs,readingMs:acc.readingMs+day.readingMs,offlineMs:acc.offlineMs+day.offlineMs
  }),{appMs:0,readingMs:0,offlineMs:0}),[usage]);
  const today=usage.days[mangaLocalDay()]??{appMs:0,readingMs:0,offlineMs:0};
  const days=useMemo(()=>Array.from({length:14},(_,index)=>{
    const date=new Date();date.setHours(12,0,0,0);date.setDate(date.getDate()-(13-index));
    const key=mangaLocalDay(date);
    return {key,date,...(usage.days[key]??{appMs:0,readingMs:0,offlineMs:0})};
  }),[usage]);
  const maxMs=Math.max(60000,...days.map(day=>day.appMs));
  const mostRead=Object.entries(usage.mangaReadingMs).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const history=[...usage.events].reverse().slice(0,50);
  const metrics=[
    {icon:Clock3Icon,name:'Active app time',value:mangaDuration(totals.appMs),note:'Foreground and non-idle'},
    {icon:BookOpenIcon,name:'Reading time',value:mangaDuration(totals.readingMs),note:'While a manga was open'},
    {icon:WifiOffIcon,name:'Offline app time',value:mangaDuration(totals.offlineMs),note:'While disconnected'},
    {icon:BarChart3Icon,name:'Today',value:mangaDuration(today.readingMs),note:'Estimated reading'},
  ];
  return <section className="analytics-shelf manga-usage-dashboard" aria-label="Personal reading analytics">
    <header className="manga-usage-header">
      <div>
        <span className="manga-usage-overline">YOUR LIBRARY JOURNAL</span>
        <h2>Reading analytics</h2>
        <p>Find your reading rhythm. Timings are estimates of active use on <strong>this device only</strong>.</p>
      </div>
      <span className="manga-usage-private"><ShieldCheckIcon size={16}/> Private and on-device</span>
    </header>
    <div className="manga-usage-times" aria-label="Time spent reading manga">
      {metrics.map(metric=><article className="manga-usage-metric" key={metric.name}>
        <span className="manga-usage-metric-label"><metric.icon size={18}/>{metric.name}</span>
        <strong>{metric.value}</strong>
        <small>{metric.note}</small>
      </article>)}
    </div>
    <div className="manga-usage-main-grid">
      <section className="manga-usage-panel manga-usage-chart-card"
        aria-label="Past 14 days of app and reading time">
        <div className="manga-usage-card-head"><h3>Last 14 days</h3><span>App usage / reading</span></div>
        <div className="manga-usage-chart" role="group" aria-label="Daily app and reading times">
          {days.map(day=><div className="manga-usage-day" key={day.key}
            title={day.key+': App '+mangaDuration(day.appMs)+', reading '+mangaDuration(day.readingMs)+', offline '+mangaDuration(day.offlineMs)}>
            <div className="manga-usage-track" role="img"
              aria-label={day.key+': '+mangaDuration(day.appMs)+' app, '+mangaDuration(day.readingMs)+' reading'}>
              <div className="manga-usage-app-bar" title="Active app time"
                style={{height:Math.max(0,day.appMs/maxMs*100)+'%'}}/>
              <div className="manga-usage-read-bar" title="Reading time"
                style={{height:Math.max(0,day.readingMs/maxMs*100)+'%'}}/>
            </div><span>{day.date.toLocaleDateString('en-GB',{weekday:'short'}).slice(0,2)}</span>
          </div>)}
        </div>
        <div className="manga-usage-legend">
          <span><i className="manga-usage-legend-app"/> Active app</span>
          <span><i className="manga-usage-legend-reading"/> Reading</span>
        </div>
      </section>
      <section className="manga-usage-panel" aria-label="Time spent on individual manga">
        <div className="manga-usage-card-head"><h3>Most read manga</h3><span>On this device</span></div>
        {mostRead.length?<ol className="manga-usage-rank">
          {mostRead.map(([id,ms])=><li key={id}>
            {titleById.has(id)?<a href={detailHref(id)} onClick={event=>onOpenDetails(event,id)}>
              {titleById.get(id)!.title}</a>:<span>Series no longer in catalogue</span>}
            <strong>{mangaDuration(ms)}</strong>
          </li>)}</ol>:<p className="manga-usage-empty">
            Your reading statistics will appear as you read manga chapters.</p>}
      </section>
    </div>
    <details className="manga-usage-more">
      <summary>More manga insights</summary>
      <div className="analytics-grid" aria-label="Additional manga reading statistics">
        <div><strong>{analytics.started}</strong><span>Series with saved reading progress</span></div>
        <div><strong>{analytics.reading}</strong><span>Currently reading</span></div>
        <div><strong>{analytics.finished}</strong><span>Personally finished</span></div>
        <div><strong>{analytics.toRead}</strong><span>To Be Read</span></div>
        <div><strong>{analytics.trying}</strong><span>Trying Out</span></div>
        <div><strong>{analytics.downloadedChapters}</strong><span>Offline chapters in {analytics.offlineSeries} series</span></div>
        <div><strong>{analytics.avgRating??'–'}</strong><span>Average rating / 10 ({analytics.rated} rated)</span></div>
        <div><strong>{analytics.total}</strong><span>Catalogue series</span></div>
      </div>
      <div className="manga-usage-detail-grid">
        <section className="manga-usage-panel">
          <h3>Recent reading positions</h3>
          {analytics.recent.length?<ol className="manga-usage-positions">
            {analytics.recent.slice(0,12).map(item=><li key={item.mangaId}>
              <a href={detailHref(item.mangaId)} onClick={event=>onOpenDetails(event,item.mangaId)}>{item.title}</a>
              <span>{item.chapter} · Page {item.page} · {new Date(item.savedAt).toLocaleString('en-GB')}</span>
            </li>)}</ol>:<p>Open a chapter and load a page to save its reading position.</p>}
        </section>
        <section className="manga-usage-panel">
          <h3>Reading activity</h3>
          {history.length?<ol className="manga-usage-history">
            {history.map((event,index)=><li key={event.at+event.kind+event.mangaId+index}>
              <span><strong>{titleById.get(event.mangaId)?.title??'Unlisted manga'}</strong>
                {' · '+eventLabel(event)}{event.chapterId?
                ' · '+(titleById.get(event.mangaId)?.chapters.find(c=>c.id===event.chapterId)?.label??'Chapter'):''}
                {event.detail?' · '+event.detail:''}</span>
              <time dateTime={event.at}>{new Date(event.at).toLocaleString('en-GB')}</time>
            </li>)}</ol>:<p>No reading actions have been recorded yet.</p>}
        </section>
        <section className="manga-usage-panel analytics-genres">
          <h3>Genres in Currently Reading</h3>
          {analytics.genres.length?<ul>{analytics.genres.slice(0,8).map(g=><li key={g.name}>
            <span>{g.name}</span><strong>{g.count}</strong></li>)}</ul>:
          <p>Start reading a manga to see its genres.</p>}
        </section>
        <section className="manga-usage-panel analytics-ratings">
          <h3>My ratings distribution</h3>
          {analytics.rated?<div className="ratings-histogram">{analytics.ratingsDistribution.map(r=>
            <div className="rating-column" key={r.score} aria-label={r.score+'/10: '+r.count+' manga'}>
              <span>{r.count||''}</span><div className="rating-bar"
                style={{height:r.count/analytics.rated*100+'%'}}/><small>{r.score}</small>
            </div>)}</div>:<p>Rate manga to see your distribution.</p>}
        </section>
      </div>
    </details>
    <section className="manga-usage-privacy" aria-label="Reading analytics controls">
      <div className="manga-usage-privacy-copy">
        <h3>Privacy and controls</h3>
        <p>Time is counted only while the tab is visible, focused and recently used. Reading manga chapters counts towards reading time; offline time overlaps with app time. No third-party analytics, cloud uploads or device tracking.</p>
        <p>Existing reading history cannot be reconstructed, so tracking starts from this release. Clearing browser data also clears these statistics.</p>
        <label className="manga-usage-privacy-toggle">
          <input type="checkbox" checked={usage.enabled}
            onChange={event=>setUsage(setMangaUsageEnabled(event.target.checked))}/>
          Record analytics on this device
        </label>
      </div>
      <div className="manga-usage-privacy-actions">
        <button type="button" onClick={downloadAnalytics}><DownloadIcon size={15}/> Export JSON</button>
        <button type="button" disabled={confirmClear} onClick={()=>setConfirmClear(true)}>
          <EraserIcon size={15}/> Clear analytics
        </button>
      </div>
      {confirmClear&&<div className="manga-usage-clear" role="group" aria-label="Confirm clearing analytics">
        <p>This removes this device’s statistics and activity journal only.
          Saved reading positions, ratings and private manga remain unchanged.</p>
        <label htmlFor="manga-clear-analytics">Type CLEAR ANALYTICS to continue</label>
        <input id="manga-clear-analytics" value={clearText} onChange={event=>setClearText(event.target.value)}
          autoComplete="off"/>
        <div className="manga-usage-privacy-actions">
          <button type="button" disabled={clearText!=='CLEAR ANALYTICS'} onClick={()=>{
            setUsage(clearMangaUsage());setClearText('');setConfirmClear(false);
          }}>Confirm clear analytics</button>
          <button type="button" onClick={()=>{setConfirmClear(false);setClearText('');}}>Cancel</button>
        </div>
      </div>}
    </section>
  </section>;
}
