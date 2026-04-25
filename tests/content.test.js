global.chrome = { runtime: { onMessage: { addListener: jest.fn() } } };

const { isUrl, createOverlay, createToast } = require('../content');

describe('isUrl', () => {
  test('returns true for http URL', () => {
    expect(isUrl('http://example.com')).toBe(true);
  });
  test('returns true for https URL', () => {
    expect(isUrl('https://example.com')).toBe(true);
  });
  test('returns false for plain text', () => {
    expect(isUrl('hello world')).toBe(false);
  });
  test('returns false for wifi QR data', () => {
    expect(isUrl('WIFI:T:WPA;S:MyNet;P:pass;;')).toBe(false);
  });
});

describe('createOverlay', () => {
  test('has class qrls-overlay', () => {
    const el = createOverlay({ data: 'https://example.com', topLeftX: 0, topLeftY: 0, devicePixelRatio: 1 });
    expect(el.classList.contains('qrls-overlay')).toBe(true);
  });

  test('URL content renders an anchor tag', () => {
    const el = createOverlay({ data: 'https://example.com', topLeftX: 0, topLeftY: 0, devicePixelRatio: 1 });
    const anchor = el.querySelector('a.qrls-link');
    expect(anchor).not.toBeNull();
    expect(anchor.getAttribute('href')).toBe('https://example.com');
    expect(anchor.getAttribute('target')).toBe('_blank');
  });

  test('non-URL content renders a copy button and no anchor', () => {
    const el = createOverlay({ data: 'plain text', topLeftX: 0, topLeftY: 0, devicePixelRatio: 1 });
    expect(el.querySelector('.qrls-copy-btn')).not.toBeNull();
    expect(el.querySelector('a.qrls-link')).toBeNull();
  });

  test('positions overlay using coordinates divided by devicePixelRatio', () => {
    const el = createOverlay({ data: 'https://a.com', topLeftX: 200, topLeftY: 400, devicePixelRatio: 2 });
    expect(el.style.left).toBe('100px');
    expect(el.style.top).toBe('200px');
  });

  test('contains a dismiss button with class qrls-close', () => {
    const el = createOverlay({ data: 'https://a.com', topLeftX: 0, topLeftY: 0, devicePixelRatio: 1 });
    expect(el.querySelector('.qrls-close')).not.toBeNull();
  });
});

describe('createToast', () => {
  test('has class qrls-toast', () => {
    const toast = createToast();
    expect(toast.classList.contains('qrls-toast')).toBe(true);
  });
  test('contains "No QR codes found"', () => {
    const toast = createToast();
    expect(toast.textContent).toContain('No QR codes found');
  });
});

describe('createOverlay — show-more', () => {
  const shortText = 'a'.repeat(100);
  const longText  = 'a'.repeat(101);

  test('text exactly 100 chars renders full text, no toggle button', () => {
    const el = createOverlay({ data: shortText, topLeftX: 0, topLeftY: 0, devicePixelRatio: 1 });
    expect(el.querySelector('.qrls-toggle-btn')).toBeNull();
    expect(el.querySelector('.qrls-text').textContent).toBe(shortText);
  });

  test('text 101 chars renders truncated span, full span, and toggle button', () => {
    const el = createOverlay({ data: longText, topLeftX: 0, topLeftY: 0, devicePixelRatio: 1 });
    expect(el.querySelector('.qrls-text-truncated')).not.toBeNull();
    expect(el.querySelector('.qrls-text-full')).not.toBeNull();
    expect(el.querySelector('.qrls-toggle-btn')).not.toBeNull();
  });

  test('default state: truncated span visible, full span hidden, button says "Show more"', () => {
    const el = createOverlay({ data: longText, topLeftX: 0, topLeftY: 0, devicePixelRatio: 1 });
    expect(el.querySelector('.qrls-text-truncated').style.display).toBe('block');
    expect(el.querySelector('.qrls-text-full').style.display).toBe('none');
    expect(el.querySelector('.qrls-toggle-btn').textContent).toBe('Show more');
  });

  test('truncated span shows first 100 chars followed by ellipsis character', () => {
    const el = createOverlay({ data: longText, topLeftX: 0, topLeftY: 0, devicePixelRatio: 1 });
    expect(el.querySelector('.qrls-text-truncated').textContent).toBe(longText.slice(0, 100) + '…');
  });

  test('clicking toggle once shows full span and relabels button "Show less"', () => {
    const el = createOverlay({ data: longText, topLeftX: 0, topLeftY: 0, devicePixelRatio: 1 });
    el.querySelector('.qrls-toggle-btn').click();
    expect(el.querySelector('.qrls-text-truncated').style.display).toBe('none');
    expect(el.querySelector('.qrls-text-full').style.display).toBe('block');
    expect(el.querySelector('.qrls-toggle-btn').textContent).toBe('Show less');
  });

  test('clicking toggle twice collapses back to truncated, button says "Show more"', () => {
    const el = createOverlay({ data: longText, topLeftX: 0, topLeftY: 0, devicePixelRatio: 1 });
    el.querySelector('.qrls-toggle-btn').click();
    el.querySelector('.qrls-toggle-btn').click();
    expect(el.querySelector('.qrls-text-truncated').style.display).toBe('block');
    expect(el.querySelector('.qrls-text-full').style.display).toBe('none');
    expect(el.querySelector('.qrls-toggle-btn').textContent).toBe('Show more');
  });

  test('full span always contains the complete untruncated text', () => {
    const el = createOverlay({ data: longText, topLeftX: 0, topLeftY: 0, devicePixelRatio: 1 });
    expect(el.querySelector('.qrls-text-full').textContent).toBe(longText);
  });

  test('copy button is present for long text regardless of toggle state', () => {
    const el = createOverlay({ data: longText, topLeftX: 0, topLeftY: 0, devicePixelRatio: 1 });
    expect(el.querySelector('.qrls-copy-btn')).not.toBeNull();
    el.querySelector('.qrls-toggle-btn').click();
    expect(el.querySelector('.qrls-copy-btn')).not.toBeNull();
  });
});
