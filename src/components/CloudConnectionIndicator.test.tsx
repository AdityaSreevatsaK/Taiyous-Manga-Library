import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {CloudConnectionIndicator} from './CloudConnectionIndicator';

describe('Novel Library cloud connection indicator parity',()=>{
  it('renders the exact 25px Lucide Cloud glyph with a 1.9 stroke',()=>{
    const html=renderToStaticMarkup(<CloudConnectionIndicator connected/>);
    expect(html).toContain('width="25"');
    expect(html).toContain('height="25"');
    expect(html).toContain('stroke-width="1.9"');
    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain('d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 16.25"');
    expect(html).toContain('d="M8 16h12"');
    expect(html).toContain('cloud-status-dot is-connected');
  });
  it('changes only the dot status, not the cloud geometry',()=>{
    const green=renderToStaticMarkup(<CloudConnectionIndicator connected/>);
    const red=renderToStaticMarkup(<CloudConnectionIndicator connected={false}/>);
    expect(red).toContain('cloud-status-dot is-disconnected');
    expect(red.replace('is-disconnected','is-connected')).toBe(green);
  });
});
