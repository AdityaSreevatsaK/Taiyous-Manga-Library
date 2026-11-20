import { useEffect, useRef, type ReactNode } from 'react';
import type { CloudRead } from '../data/privateLibrary';

type Cloud = CloudRead | {status:'checking';message:string};

/** The private storage tools belong beside the brand, not in the reading area.
 * This control never implies connectivity merely because the device is online.
 */
export function MangaCloudMenu({cloud,online,demo,count,onSample,onPrivate,onLogout,children}:{
  cloud:Cloud;online:boolean;demo:boolean;count:number;
  onSample:()=>void;onPrivate:()=>void;onLogout:()=>void;children?:ReactNode;
}) {
  const connected=cloud.status==='connected';
  const healthy=connected&&online;
  const root=useRef<HTMLDetailsElement>(null);
  useEffect(()=>{
    const onOutside=(event:PointerEvent)=>{
      if(root.current?.open&&!root.current.contains(event.target as Node))root.current.open=false;
    };
    const onEscape=(event:KeyboardEvent)=>{
      if(event.key==='Escape'&&root.current?.open){
        root.current.open=false;
        root.current.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown',onOutside);
    document.addEventListener('keydown',onEscape);
    return ()=>{
      document.removeEventListener('pointerdown',onOutside);
      document.removeEventListener('keydown',onEscape);
    };
  },[]);
  return <details className="manga-cloud-menu" ref={root}>
    <summary aria-label={'Cloud settings, '+(healthy?'connected':'disconnected')}
      title={connected?'Private Hugging Face library connected':'Private Hugging Face library'}>
      <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true" fill="none"
        stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7.2 18.3h10.2a4.15 4.15 0 0 0 .13-8.29 5.7 5.7 0 0 0-10.94-.9A4.66 4.66 0 0 0 7.2 18.3Z"/>
      </svg>
      <span className={'manga-cloud-dot'+(healthy?' is-connected':'')} aria-hidden="true"/>
    </summary>
    <div className="manga-cloud-panel">
      <p className="manga-cloud-overline">YOUR LIBRARY / STORAGE</p>
      <h2>Private manga library</h2>
      <p className="manga-cloud-state" role="status">{connected
        ? online?'Connected securely with Hugging Face':'Signed in. Device offline.'
        :cloud.status==='checking'?'Checking your connection…':'Not connected'}</p>
      <p className="manga-cloud-explanation">{connected
        ? count+' '+(count===1?'manga':'manga')+' in your private catalogue. No chapter images are exposed publicly.'
        :cloud.message}</p>
      <div className="manga-cloud-actions">
        {connected ? <button type="button" className="secondary"
          onClick={onLogout}>Sign out of Hugging Face</button>
          :<a className="primary manga-oauth-link" href="/api/auth/login">Sign in with Hugging Face</a>}
      </div>
      <div className="manga-cloud-divider"/>
      <p className="manga-cloud-overline">VIEWING</p>
      <div className="manga-source-options">
        <button type="button" className={!demo?'is-selected':''}
          aria-pressed={!demo} onClick={onPrivate}>My library ({connected?count:0})</button>
        <button type="button" className={demo?'is-selected':''}
          aria-pressed={demo} onClick={onSample}>Try the sample reader</button>
      </div>
      <p className="manga-source-note">Sample stories are fictional. They are never mixed with your private collection.</p>
      <div className="manga-cloud-divider"/>
      <div className="manga-cloud-backup">{children}</div>
    </div>
  </details>;
}
