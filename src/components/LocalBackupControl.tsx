import { useRef, useState, type ChangeEvent } from 'react';
import { browserStorage } from '../domain/localReaderStorage';
import {
  exportFullBackup, MAX_FULL_BACKUP_BYTES, previewFullBackup, restoreFullBackup,
  type FullBackupPreview,
} from '../domain/localFullBackup';
import type { ChapterManifest, MangaEntry } from '../domain/types';

interface Props {
  entries: readonly MangaEntry[];
  manifests: ReadonlyMap<string, ChapterManifest>;
  onRestored: () => void;
}

/** A deliberately local-only transfer tool; no backup file is uploaded to a server. */
export function LocalBackupControl({ entries, manifests, onRestored }: Props) {
  const [preview, setPreview] = useState<FullBackupPreview | null>(null);
  const [restorePersonal, setRestorePersonal] = useState(false);
  const [restoreSettings, setRestoreSettings] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function download() {
    setMessage('');
    try {
      const { document: backup, excludedInvalid } = exportFullBackup(entries, manifests, browserStorage());
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'taiyou-manga-personal-' + backup.exportedAt.slice(0, 10) + '.json';
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2500);
      setMessage(excludedInvalid > 0 ?
        'Backup downloaded. ' + excludedInvalid + ' invalid local records were excluded and preserved in this browser.' :
        'Personal library backup downloaded. Keep it private; no manga images are included.');
    } catch {
      setMessage('Could not create a backup. Check browser storage and download permissions.');
    }
  }

  async function chooseBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    setPreview(null);
    setRestoreSettings(false);
    setRestorePersonal(false);
    setMessage('');
    if (!file) return;
    if (file.size > MAX_FULL_BACKUP_BYTES) {
      setMessage('This file is too large for a Manga Library backup (maximum 2 MB).');
      return;
    }
    setBusy(true);
    try {
      const raw: unknown = JSON.parse(await file.text());
      const inspected = previewFullBackup(raw, entries, manifests, browserStorage());
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
      const result = restoreFullBackup(preview, entries, manifests, browserStorage(), restoreSettings, restorePersonal);
      onRestored();
      setPreview(null);
      setRestoreSettings(false);
      setRestorePersonal(false);
      setMessage('Restore finished: ' + result.reader.restored + ' newer progress records imported; ' +
        result.reader.newerOrEqual + ' already newer or equal; ' +
        result.reader.invalidLocal + ' protected invalid progress records; ' +
        result.reader.unavailable + ' unavailable. ' +
        result.shelvesRestored + ' personal shelves and ' + result.annotationsRestored + ' annotations restored; ' +
        result.collectionsRestored + ' collections imported and ' + result.collectionsSkipped + ' conflicting collections protected; ' +
        result.metadataSkipped + ' protected and ' + result.metadataUnavailable + ' unavailable personal records. ' +
        (result.reader.preferencesRestored ? 'Reader settings restored.' : 'Existing reader settings retained.'));
    } catch {
      setMessage('Restore could not finish. Existing progress was not deleted. Review your backup file.');
    } finally {
      setBusy(false);
    }
  }

  return <details className="backup-panel">
    <summary>Transfer reading progress between devices</summary>
    <p>Download a private JSON backup of this device's progress, reader settings, personal shelves, ratings,
      notes, tags and nested collections. Import it on another device with a preview and explicit confirmation.
      Manga images and offline downloads are never included.</p>
    <div className="backup-actions">
      <button className="secondary" type="button" onClick={download} disabled={busy}>Download personal backup</button>
      <label className="backup-file-label">Choose a backup to restore
        <input ref={inputRef} type="file" accept=".json,application/json"
          onChange={event=>{void chooseBackup(event);}} disabled={busy} />
      </label>
    </div>
    {preview && <div className="backup-preview" aria-label="Reader backup preview">
      <strong>Restore preview</strong>
      <p>{preview.reader.recognised.length} recognised manga progress records.
        {' '}{preview.reader.restorable} potentially restorable,
        {' '}{preview.reader.newerOrEqual} already newer or equal,
        {' '}{preview.reader.invalidLocal} protected invalid local records,
        {' '}{preview.reader.ignoredUnknown} unknown manga ignored.</p>
      <p>{preview.shelves.length} personal shelf records, {preview.annotations.length} notes/ratings/tags records.
        {' '}{preview.shelfRestorable + preview.annotationRestorable} eligible to restore;
        {' '}{preview.conflicts} protected existing records, {preview.unknownPersonal} unknown series ignored.</p>
      <p>{preview.collections?.items.length ?? 0} personal collections;
        {' '}{preview.collectionsRestorable} new collections available to import;
        {' '}{preview.collectionsConflicted} existing or conflicting collections protected.</p>
      {(preview.shelves.length > 0 || preview.annotations.length > 0 ||
        (preview.collections?.items.length ?? 0) > 0) && <label className="backup-checkbox">
        <input type="checkbox" checked={restorePersonal}
          onChange={event=>setRestorePersonal(event.target.checked)}/>
        Also restore personal shelves, ratings, notes, tags and collections without overwriting newer or existing records
      </label>}
      {preview.reader.document.preferences && <label className="backup-checkbox">
        <input type="checkbox" checked={restoreSettings}
          onChange={event=>setRestoreSettings(event.target.checked)} />
        Also replace this device's reader theme and image-fit settings
      </label>}
      <div className="backup-confirm">
        <button className="primary" type="button" onClick={restore}
          disabled={busy || (preview.reader.restorable === 0 && !restoreSettings &&
            !(restorePersonal && (preview.shelfRestorable + preview.annotationRestorable +
              preview.collectionsRestorable > 0)))}>Confirm restore</button>
        <button className="secondary" type="button" onClick={()=>{setPreview(null);setRestoreSettings(false);setRestorePersonal(false);
            setMessage('Restore cancelled. Nothing was changed.');}}>Cancel</button>
      </div>
    </div>}
    {message && <p className="backup-message" role="status">{message}</p>}
    <p className="backup-caution">This is manual local transfer, not cloud synchronisation. Backups may contain personal notes, so keep them private.
      Restoring never deletes a reading record, replaces a nonempty personal shelf or copies manga images.
      Existing collections are preserved when importing other collection trees.</p>
  </details>;
}
