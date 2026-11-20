import { useEffect, useRef, type ReactNode } from 'react';
import type { CloudRead } from '../data/privateLibrary';
import { CloudConnectionIndicator } from './CloudConnectionIndicator';

type Cloud = CloudRead | {status:'checking';message:string};

/** The private storage tools belong beside the brand, not in the reading area.
 * This control never implies connectivity merely because the device is online.
 */
export function MangaCloudMenu({cloud,online,demo,count,onSample,onPrivate,onLogout,onRefresh,refreshing,children}:{
  cloud:Cloud;online:boolean;demo:boolean;count:number;
  onSample:()=>void;onPrivate:()=>void;onLogout:()=>void;onRefresh?:()=>void;refreshing?:boolean;children?:ReactNode;
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
  return <details className="manga-cloud-menu cloud-connect" ref={root}>
    <summary className="cloud-status-toggle" aria-haspopup="true" aria-label={'Cloud settings, '+(healthy?'connected':'disconnected')}
      title={healthy?'Cloud connected · Open settings':'Cloud disconnected · Open settings'}>
      <CloudConnectionIndicator connected={healthy}/>
    </summary>
    <div className="manga-cloud-panel cloud-connect-body">
      <h2 className="cloud-settings-heading">Cloud library settings</h2>
      <p className="cloud-settings-state">Connection: {healthy?'Connected':'Disconnected'}</p>
      <p className="manga-cloud-state" role="status">{connected
        ? online?'Connected securely with Hugging Face':'Signed in. Device offline.'
        :cloud.status==='checking'?'Checking your connection…':'Not connected'}</p>
      <p className="manga-cloud-explanation">{connected
        ? count+' '+(count===1?'manga':'manga')+' in your private catalogue. No chapter images are exposed publicly.'
        :cloud.message}</p>
      <div className="manga-cloud-actions">
        {connected ? <>
          {onRefresh&&<button type="button" className="secondary" disabled={refreshing}
            onClick={onRefresh}>{refreshing?'Refreshing…':'Refresh cloud'}</button>}
          <button type="button" className="secondary"
            onClick={onLogout}>Sign out of Hugging Face</button>
        </>
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
