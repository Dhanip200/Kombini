import { SessionBrain } from '../src/memory/session-brain';

describe('SessionBrain', () => {
  let brain: SessionBrain;

  beforeEach(() => {
    brain = new SessionBrain();
  });

  test('should store and retrieve page data', () => {
    const url = 'https://example.com';
    const html = '<html><body>Test</body></html>';
    const summary = 'A test page.';
    
    brain.storePage(url, html, summary);
    const page = brain.getPage(url);
    
    expect(page).toBeDefined();
    expect(page?.url).toBe(url);
    expect(page?.summary).toBe(summary);
  });

  test('should query memory correctly', () => {
    brain.storePage('https://apple.com', '...', 'Tech company');
    brain.storePage('https://google.com', '...', 'Search engine');
    
    const results = brain.queryMemory('Search');
    expect(results.length).toBe(1);
    expect(results[0].url).toBe('https://google.com');
  });
});
