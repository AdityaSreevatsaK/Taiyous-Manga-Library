import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import App from './App';

describe('accessible catalogue baseline (server-rendered markup)', () => {
  it('shows a clearly identified synthetic sample catalogue and functional navigation targets', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('Sample stories are fictional.');
    expect(html).toContain('MANGA LIBRARY');
    expect(html).toContain('Search all manga');
    expect(html).toContain('Cloud settings, disconnected');
    expect(html).toContain('manga-theme-swatches');
    expect(html).toContain('manga-nav-links');
    expect(html).not.toContain('editorial-source-switcher');
    expect(html).toContain('The Lantern Archive');
    expect(html).toContain('The Silver Garden');
    expect(html).toContain('Clockwork Shore');
    expect(html).toContain('Five Chapter Scroll Trial');
    expect(html).toContain('aria-label="Your library front page"');
    expect(html).toContain('href="#content"');
    expect(html).toContain('class="editorial-home manga-editorial-home"');
    expect(html).toContain('editorial-grand');
    expect(html).toContain('editorial-journal');
    expect(html).toContain('editorial-shelves');
    expect(html).toContain('editorial-all-books');
    expect(html).toContain('Every panel holds');
    expect(html).toContain('TAIYOU&#x27;S MANGA ARCHIVE');
    expect(html).toContain('Literary Journal');
    expect(html).toContain('From your shelves');
    expect(html).not.toContain('THE ART OF TURNING PAGES');
  });
  it('does not pretend to contain private media when the empty source is selected', () => {
    const html = renderToStaticMarkup(<App initialDemo={false} />);
    expect(html).toContain('Your manga library awaits');
    expect(html).toContain('Sign in with Hugging Face to view your private manga collection.');
    expect(html).not.toContain('The Lantern Archive');
    expect(html).not.toContain('A real private reader is connected');
  });
});
