/** Port of Taiyous-Personal-Library's LibraryDashboard cloud indicator.
 * The rendered SVG is the same Lucide Cloud (25px, 1.9 stroke); only the
 * surrounding popover and data source remain owned by Manga Library. */
export function CloudConnectionIndicator({connected}:{connected:boolean}){
  return <span className="cloud-status-icon" aria-hidden="true">
    <svg xmlns="http://www.w3.org/2000/svg" width="25" height="25"
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 16.25"/>
      <path d="M8 16h12"/>
    </svg>
    <span className={'cloud-status-dot '+(connected?'is-connected':'is-disconnected')}/>
  </span>;
}
