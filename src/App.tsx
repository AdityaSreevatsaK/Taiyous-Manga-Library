import { useState } from 'react';
import { entries } from './data/catalogue';
import { searchCatalogue } from './domain/search';
import './styles.css';
const features = ["Series catalogue","Chapters and volumes","Image reading (planned)","Page progress (planned)"];
export default function App() {
  const [query, setQuery] = useState('');
  const results = searchCatalogue(entries, query);
  return <main className="app">
    <header className="masthead">
      <p className="eyebrow">TAIYOU'S PERSONAL COLLECTION</p>
      <h1>Manga</h1>
      <p className="intro">A private manga collection that will eventually support reading direction, image-page manifests, saved progress and offline chapters.</p>
      <span className="status">Scaffold · No private catalogue connected</span>
    </header>
    <section aria-label="Manga catalogue" className="workspace">
      <div className="workspace-head">
        <div><h2>Your catalogue</h2><p>Local search only. Import, sync and playback are not yet implemented.</p></div>
        <label className="query">Find by title or alias
          <input type="search" value={query} onChange={event=>setQuery(event.target.value)}
            placeholder="Search your catalogue…" autoComplete="off" />
        </label>
      </div>
      {results.length ? <ul className="results">
        {results.map(item=><li key={item.id}>{item.title}</li>)}
      </ul> : <p className="empty">No matching items. The catalogue is empty until a private storage adapter is designed and approved.</p>}
    </section>
    <section className="features" aria-label="Planned capabilities"><h2>Planned capabilities</h2>
      <ul>{features.map(item=><li key={item}>{item}</li>)}</ul>
    </section>
    <footer>Independent application · No shared sign-in, media access or automatic deployment enabled.</footer>
  </main>;
}
