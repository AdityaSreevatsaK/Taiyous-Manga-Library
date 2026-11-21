import type {MouseEvent} from 'react';
import type {computeLocalReadingAnalytics} from '../domain/advancedDiscovery';

type Analytics=ReturnType<typeof computeLocalReadingAnalytics>;
interface Props{
  analytics:Analytics;
  detailHref:(mangaId:string)=>string;
  onOpenDetails:(event:MouseEvent<HTMLAnchorElement>,mangaId:string)=>void;
  onReading:()=>void;
}

/** Existing personal analytics, unchanged in meaning and without owner-password
 * gates. All figures derive from the current device's stored reading records. */
export function MangaAnalyticsPanel({analytics,detailHref,onOpenDetails,onReading}:Props){
  return <section className="analytics-shelf" aria-label="Personal reading analytics">
    <p className="eyebrow">YOUR READING SNAPSHOT / THIS DEVICE</p>
    <h2>Analytics</h2>
    <p>Only your saved device-local reading positions, personal shelves and ratings. No invented reading duration,
      historical streaks or external tracking.</p>
    <div className="analytics-grid">
      <div><strong>{analytics.started}</strong><span>Series with saved reading progress</span></div>
      <div><strong>{analytics.reading}</strong><span>Currently reading</span></div>
      <div><strong>{analytics.finished}</strong><span>Personally finished</span></div>
      <div><strong>{analytics.toRead}</strong><span>Previously saved To Be Read</span></div>
      <div><strong>{analytics.trying}</strong><span>Trying Out</span></div>
      <div><strong>{analytics.downloadedChapters}</strong><span>Offline chapters in {analytics.offlineSeries} series</span></div>
      <div><strong>{analytics.avgRating??'–'}</strong><span>Average personal rating / 10 ({analytics.rated} rated)</span></div>
      <div><strong>{analytics.total}</strong><span>Catalogue series</span></div>
    </div>
    <div className="analytics-detail-grid">
      <section className="analytics-recent">
        <h3>Recently saved positions</h3>
        {analytics.recent.length?<ul>{analytics.recent.slice(0,8).map(item=>
          <li key={item.mangaId}>
            <a href={detailHref(item.mangaId)} onClick={event=>onOpenDetails(event,item.mangaId)}>
              <strong>{item.title}</strong></a>
            <span>{item.chapter} · Page {item.page}</span>
            <time dateTime={item.savedAt}>{new Date(item.savedAt).toLocaleDateString('en-GB')}</time>
          </li>)}</ul>:<p>No saved reading positions on this device yet.</p>}
      </section>
      <section className="analytics-genres">
        <h3>Genres in currently reading</h3>
        {analytics.genres.length?<ul>{analytics.genres.slice(0,8).map(item=>
          <li key={item.name}><span>{item.name}</span><strong>{item.count}</strong></li>)}</ul>:
          <p>Start reading a series to see its genres.</p>}
      </section>
      <section className="analytics-ratings">
        <h3>My ratings distribution</h3>
        {analytics.rated?<div className="ratings-histogram">
          {analytics.ratingsDistribution.map(item=><div key={item.score}
            className="rating-column" aria-label={item.score+' out of 10: '+item.count+' manga'}>
            <span>{item.count||''}</span><div className="rating-bar"
              style={{height:(item.count/analytics.rated*100)+'%'}}/>
            <small>{item.score}</small>
          </div>)}
        </div>:<p>Rate manga on its details page to see your distribution.</p>}
      </section>
    </div>
    <button className="secondary" type="button" onClick={onReading}>View currently reading</button>
  </section>;
}
