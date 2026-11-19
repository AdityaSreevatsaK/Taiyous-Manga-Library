import { useEffect, useRef, useState } from 'react';
import { downloadSyntheticChapter, readReceipt, removeOfflineChapter, verifyOfflineChapter, type OfflineVerify } from '../data/offlineChapters';
import type { ChapterManifest } from '../domain/types';

export function OfflineChapterControl({ manifest, onChange }: {
  manifest: ChapterManifest; onChange: () => void;
}) {
  const [state, setState] = useState<OfflineVerify | null>(null);
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [message, setMessage] = useState('');
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    let cancelled = false;
    void verifyOfflineChapter(manifest).then(result => { if (!cancelled) setState(result); });
    return () => { cancelled = true; };
  }, [manifest]);
  useEffect(() => () => abort.current?.abort(), []);
  const status = state?.status ?? (readReceipt(manifest).status === 'missing' ? 'missing' : 'checking');
  const needsRemoval = status === 'partial' || status === 'corrupt';

  async function download() {
    if (busy) return;
    const controller = new AbortController();
    abort.current = controller;
    setMessage(''); setCompleted(0); setBusy(true);
    try {
      await downloadSyntheticChapter(manifest, (done) => setCompleted(done), controller.signal);
      setState(await verifyOfflineChapter(manifest));
      setMessage('Chapter saved locally and verified.');
      onChange();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save this chapter.');
      setState(await verifyOfflineChapter(manifest));
    } finally { setBusy(false); abort.current = null; }
  }
  async function remove() {
    if (busy) return;
    setMessage(''); setBusy(true);
    try {
      await removeOfflineChapter(manifest);
      setCompleted(0);
      setState({status:'missing'});
      setMessage('Offline copy removed. Reading progress is unchanged.');
      onChange();
    } catch {
      setMessage('Unable to remove this offline copy. It has not been marked as removed.');
      setState(await verifyOfflineChapter(manifest));
    } finally { setBusy(false); }
  }
  return <div className="offline-chapter-control">
    <span className="offline-chapter-state" aria-live="polite">{busy && abort.current ?
      `Saving ${completed} of ${manifest.pages.length}` :
      status === 'complete' ? 'Available offline' :
      needsRemoval ? 'Offline copy needs repair' :
      status === 'unavailable' ? 'Offline storage unavailable' :
      status === 'checking' ? 'Checking offline copy' : 'Not downloaded'}</span>
    {busy && abort.current ?
      <button className="secondary" type="button" onClick={()=>abort.current?.abort()}>Cancel download</button> :
      status === 'complete' || needsRemoval ?
      <button className="secondary" type="button" disabled={busy} onClick={()=>{void remove();}}>Remove offline copy</button> :
      <button className="secondary" type="button" disabled={busy || status === 'checking' || status === 'unavailable'}
        onClick={()=>{void download();}}>Download chapter</button>}
    {busy && <progress className="offline-download-progress" max={manifest.pages.length}
      value={completed} aria-label="Offline chapter download progress" />}
    {message && <span className="offline-chapter-feedback" role="status">{message}</span>}
  </div>;
}
