global.chrome = { runtime: { onMessage: { addListener: jest.fn() } } };

const { isUrl, createOverlay, createToast, createBackdrop, showBackdrop, syncBackdrop } = require('../content');

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
  const shortText = 'a'.repeat(34);
  const longText  = 'a'.repeat(36);

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

  test('truncated span shows first 34 chars followed by ellipsis character', () => {
    const el = createOverlay({ data: longText, topLeftX: 0, topLeftY: 0, devicePixelRatio: 1 });
    expect(el.querySelector('.qrls-text-truncated').textContent).toBe(longText.slice(0, 35) + '…');
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

describe('createBackdrop', () => {
  test('has class qrls-backdrop', () => {
    const el = createBackdrop();
    expect(el.classList.contains('qrls-backdrop')).toBe(true);
  });

  test('is position fixed', () => {
    const el = createBackdrop();
    expect(el.style.position).toBe('fixed');
  });

  test('has z-index 2147483646', () => {
    const el = createBackdrop();
    expect(el.style.zIndex).toBe('2147483646');
  });

  test('starts with opacity 0', () => {
    const el = createBackdrop();
    expect(el.style.opacity).toBe('0');
  });

  test('has semi-transparent dark background', () => {
    const el = createBackdrop();
    expect(el.style.background).toContain('rgba');
  });
});

describe('showBackdrop / syncBackdrop', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.body.style.overflow = '';
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('showBackdrop appends a .qrls-backdrop to body', () => {
    showBackdrop();
    expect(document.querySelector('.qrls-backdrop')).not.toBeNull();
  });

  test('showBackdrop sets body overflow to hidden', () => {
    showBackdrop();
    expect(document.body.style.overflow).toBe('hidden');
  });

  test('showBackdrop does not add a second backdrop if one already exists', () => {
    showBackdrop();
    showBackdrop();
    expect(document.querySelectorAll('.qrls-backdrop').length).toBe(1);
  });

  test('syncBackdrop removes the backdrop when no overlays remain', () => {
    showBackdrop();
    syncBackdrop();
    jest.advanceTimersByTime(200);
    expect(document.querySelector('.qrls-backdrop')).toBeNull();
  });

  test('syncBackdrop restores body overflow when backdrop is removed', () => {
    document.body.style.overflow = 'auto';
    showBackdrop();
    syncBackdrop();
    expect(document.body.style.overflow).toBe('auto');
  });

  test('syncBackdrop keeps backdrop when overlays still exist', () => {
    showBackdrop();
    const overlay = document.createElement('div');
    overlay.className = 'qrls-overlay';
    document.body.appendChild(overlay);
    syncBackdrop();
    jest.advanceTimersByTime(200);
    expect(document.querySelector('.qrls-backdrop')).not.toBeNull();
  });

  test('syncBackdrop does nothing when no backdrop exists', () => {
    expect(() => syncBackdrop()).not.toThrow();
  });
});

describe('backdrop integration', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.body.style.overflow = '';
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('clicking × on the only overlay removes the backdrop', () => {
    const overlay = createOverlay(
      { data: 'hello', topLeftX: 0, topLeftY: 0, devicePixelRatio: 1 },
      syncBackdrop
    );
    document.body.appendChild(overlay);
    showBackdrop();

    overlay.querySelector('.qrls-close').click();
    jest.advanceTimersByTime(200);

    expect(document.querySelector('.qrls-backdrop')).toBeNull();
  });

  test('clicking × when another overlay remains keeps the backdrop', () => {
    const overlay1 = createOverlay(
      { data: 'hello', topLeftX: 0, topLeftY: 0, devicePixelRatio: 1 },
      syncBackdrop
    );
    const overlay2 = createOverlay(
      { data: 'world', topLeftX: 0, topLeftY: 0, devicePixelRatio: 1 },
      syncBackdrop
    );
    document.body.appendChild(overlay1);
    document.body.appendChild(overlay2);
    showBackdrop();

    overlay1.querySelector('.qrls-close').click();
    jest.advanceTimersByTime(200);

    expect(document.querySelector('.qrls-backdrop')).not.toBeNull();
  });

  test('clicking a link on the only overlay removes the backdrop', () => {
    const overlay = createOverlay(
      { data: 'https://example.com', topLeftX: 0, topLeftY: 0, devicePixelRatio: 1 },
      syncBackdrop
    );
    document.body.appendChild(overlay);
    showBackdrop();

    overlay.querySelector('a.qrls-link').click();
    jest.advanceTimersByTime(200);

    expect(document.querySelector('.qrls-backdrop')).toBeNull();
  });

  test('clicking a link when another overlay remains keeps the backdrop', () => {
    const overlay1 = createOverlay(
      { data: 'https://example.com', topLeftX: 0, topLeftY: 0, devicePixelRatio: 1 },
      syncBackdrop
    );
    const overlay2 = createOverlay(
      { data: 'world', topLeftX: 0, topLeftY: 0, devicePixelRatio: 1 },
      syncBackdrop
    );
    document.body.appendChild(overlay1);
    document.body.appendChild(overlay2);
    showBackdrop();

    overlay1.querySelector('a.qrls-link').click();
    jest.advanceTimersByTime(200);

    expect(document.querySelector('.qrls-backdrop')).not.toBeNull();
  });

  test('clicking the backdrop removes all overlays and itself', () => {
    const overlay1 = createOverlay(
      { data: 'hello', topLeftX: 0, topLeftY: 0, devicePixelRatio: 1 },
      syncBackdrop
    );
    const overlay2 = createOverlay(
      { data: 'world', topLeftX: 0, topLeftY: 0, devicePixelRatio: 1 },
      syncBackdrop
    );
    document.body.appendChild(overlay1);
    document.body.appendChild(overlay2);
    showBackdrop();

    document.querySelector('.qrls-backdrop').click();
    jest.advanceTimersByTime(200);

    expect(document.querySelectorAll('.qrls-overlay').length).toBe(0);
    expect(document.querySelector('.qrls-backdrop')).toBeNull();
  });
});
