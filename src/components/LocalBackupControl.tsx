import { useRef, useState, type ChangeEvent } from 'react';
import { browserStorage } from '../domain/localReaderStorage';
import {
  exportLocalReaderBackup, MAX_READER_BACKUP_BYTES, previewLocalReaderBackup,
  restoreLocalReaderBackup, type BackupPreview,
} from '../domain/localReaderBackup';
import type { ChapterManifest, MangaEntry } from '../domain/types';

interface Props {
  entries: readonly MangaEntry[];
  manifests: ReadonlyMap<string, ChapterManifest>;
  onRestored: () => void;
}

/** A deliberately local-only transfer tool; no backup file is uploaded to a server. */
export function LocalBackupControl({ entries, manifests, onRestored }: Props) {
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [restoreSettings, setRestoreSettings] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function download() {
    setMessage('');
    try {
      const { document: backup, excludedInvalid } = exportLocalReaderBackup(entries, manifests, browserStorage());
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'taiyou-manga-progress-' + backup.exportedAt.slice(0, 10) + '.json';
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2500);
      setMessage(excludedInvalid > 0 ?
        'Backup downloaded. ' + excludedInvalid + ' invalid local records were excluded and preserved in this browser.' :
        'Progress backup downloaded to this device. No manga images are included.');
    } catch {
      setMessage('Could not create a backup. Check browser storage and download permissions.');
    }
  }

  async function chooseBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    setPreview(null);
    setRestoreSettings(false);
    setMessage('');
    if (!file) return;
    if (file.size > MAX_READER_BACKUP_BYTES) {
      setMessage('This file is too large for a reader progress backup (maximum 256 KB).');
      return;
    }
    setBusy(true);
    try {
      const raw: unknown = JSON.parse(await file.text());
      const inspected = previewLocalReaderBackup(raw, entries, manifests, browserStorage());
      setPreview(inspected);
      setMessage('Backup validated. Review the counts below before restoring anything.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Backup could not be read. Nothing was imported.');
    } finally {
      setBusy(false);
    }
  }

  function restore() {
    if (!preview || busy) return;
    setBusy(true);
    try {
      const result = restoreLocalReaderBackup(preview, entries, manifests, browserStorage(), restoreSettings);
      onRestored();
      setPreview(null);
      setRestoreSettings(false);
      setMessage('Restore finished: ' + result.restored + ' newer progress records imported; ' +
        result.newerOrEqual + ' already newer or equal; ' +
        result.invalidLocal + ' protected because existing records are invalid; ' +
        result.unavailable + ' unavailable. ' +
        (result.preferencesRestored ? 'Reading settings restored.' : 'Existing reading settings retained.'));
    } catch {
      setMessage('Restore could not finish. Existing progress was not deleted. Review your backup file.');
    } finally {
      setBusy(false);
    }
  }

  return <details className="backup-panel">
    <summary>Transfer reading progress between devices</summary>
    <p>Download a small JSON backup of this device's chapter positions and reader settings.
      Import it on another device to keep the newest saved positions. Manga images and offline downloads are not included.</p>
    <div className="backup-actions">
      <button className="secondary" type="button" onClick={download} disabled={busy}>Download progress backup</button>
      <label className="backup-file-label">Choose a backup to restore
        <input ref={inputRef} type="file" accept=".json,application/json"
          onChange={event=>{void chooseBackup(event);}} disabled={busy} />
      </label>
    </div>
    {preview && <div className="backup-preview" aria-label="Reader backup preview">
      <strong>Restore preview</strong>
      <p>{preview.recognised.length} recognised manga records. {preview.restorable} potentially restorable,
        {' '}{preview.newerOrEqual} already newer or equal, {preview.invalidLocal} protected invalid local records,
        {' '}{preview.ignoredUnknown} unknown manga ignored.</p>
      {preview.document.preferences && <label className="backup-checkbox">
        <input type="checkbox" checked={restoreSettings}
          onChange={event=>setRestoreSettings(event.target.checked)} />
        Also replace this device's reader theme and image-fit settings
      </label>}
      <div className="backup-confirm">
        <button className="primary" type="button" onClick={restore}
          disabled={busy || (preview.restorable === 0 && !restoreSettings)}>Confirm restore</button>
        <button className="secondary" type="button" onClick={()=>{setPreview(null);setRestoreSettings(false);setMessage('Restore cancelled. Nothing was changed.');}}>Cancel</button>
      </div>
    </div>}
    {message && <p className="backup-message" role="status">{message}</p>}
    <p className="backup-caution">This is a manual local transfer, not cloud sync. Keep backup files private. Restoring never deletes a reading record or copies manga media.</p>
  </details>;
}
