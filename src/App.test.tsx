import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import App from './App';

describe('accessible catalogue baseline (server-rendered markup)', () => {
  it('shows a clearly identified synthetic sample catalogue and functional navigation targets', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('Fictional demonstration');
    expect(html).toContain('The Lantern Archive');
    expect(html).toContain('The Silver Garden');
    expect(html).toContain('Clockwork Shore');
    expect(html).toContain('Five Chapter Scroll Trial');
    expect(html).toContain('aria-label="Manga catalogue"');
    expect(html).toContain('href="#content"');
    expect((html.match(/class="book-card"/g) ?? []).length).toBe(4);
    expect(html).toContain('A place for');
    expect(html).toContain('editorial-overview');
    expect(html).toContain('book-tags');
    expect(html).toContain('Story Complete');
    expect(html).toContain('Updating');
    expect(html).toContain('On Hiatus');
    expect(html).not.toContain('THE ART OF TURNING PAGES');
  });
  it('does not pretend to contain private media when the empty source is selected', () => {
    const html = renderToStaticMarkup(<App initialDemo={false} />);
    expect(html).toContain('Your collection is not connected yet');
    expect(html).toContain('Sign in with Hugging Face to connect your private manga library.');
    expect(html).not.toContain('The Lantern Archive');
    expect(html).not.toContain('A real private reader is connected');
  });
});
