const TRUNCATION_THRESHOLD = 35;
const COPY_RESET_DELAY_MS = 1500;
const TOAST_DURATION_MS = 3000;
const ATTRIBUTION_LABEL = '⬛ CueArr';

function isUrl(str) {
  return /^https?:\/\//i.test(str);
}

function createOverlay(result, onClose = () => {}) {
  const cssX = result.topLeftX / result.devicePixelRatio;
  const cssY = result.topLeftY / result.devicePixelRatio;

  const div = document.createElement('div');
  div.className = 'qrls-overlay';
  div.style.cssText = [
    'position:fixed',
    `left:${cssX}px`,
    `top:${cssY}px`,
    'background:#ffffff',
    'border-radius:8px',
    'box-shadow:0 2px 8px rgba(0,0,0,0.25)',
    'padding:8px 12px',
    'z-index:2147483647',
    'font-family:sans-serif',
    'font-size:13px',
    'max-width:300px',
    'word-break:break-all',
    'line-height:1.4'
  ].join(';');

  const closeBtn = document.createElement('button');
  closeBtn.className = 'qrls-close';
  closeBtn.textContent = '×';
  closeBtn.style.cssText = [
    'position:absolute',
    'top:2px',
    'right:6px',
    'background:none',
    'border:none',
    'cursor:pointer',
    'font-size:16px',
    'color:#999',
    'line-height:1',
    'padding:0'
  ].join(';');
  closeBtn.addEventListener('click', () => { div.remove(); onClose(); });
  div.appendChild(closeBtn);

  if (isUrl(result.data)) {
    const a = document.createElement('a');
    a.className = 'qrls-link';
    a.setAttribute('href', result.data);
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
    a.textContent = result.data;
    a.style.cssText = 'color:#1a73e8;text-decoration:underline;display:block;padding-right:16px;';
    a.addEventListener('click', () => { div.remove(); onClose(); });
    div.appendChild(a);
  } else {
    if (result.data.length > TRUNCATION_THRESHOLD) {
      const truncatedSpan = document.createElement('span');
      truncatedSpan.className = 'qrls-text-truncated';
      truncatedSpan.textContent = result.data.slice(0, TRUNCATION_THRESHOLD) + '…';
      truncatedSpan.style.cssText = 'display:block;color:#333;margin-bottom:6px;padding-right:16px;';
      div.appendChild(truncatedSpan);

      const fullSpan = document.createElement('span');
      fullSpan.className = 'qrls-text-full';
      fullSpan.textContent = result.data;
      fullSpan.style.cssText = 'display:none;color:#333;margin-bottom:6px;padding-right:16px;';
      div.appendChild(fullSpan);

      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'qrls-toggle-btn';
      toggleBtn.textContent = 'Show more';
      toggleBtn.style.cssText = [
        'background:#f1f3f4',
        'color:#333',
        'border:none',
        'border-radius:4px',
        'padding:3px 10px',
        'cursor:pointer',
        'font-size:12px',
        'margin-right:6px'
      ].join(';');
      toggleBtn.addEventListener('click', () => {
        if (toggleBtn.textContent === 'Show more') {
          truncatedSpan.style.display = 'none';
          fullSpan.style.display = 'block';
          toggleBtn.textContent = 'Show less';
        } else {
          truncatedSpan.style.display = 'block';
          fullSpan.style.display = 'none';
          toggleBtn.textContent = 'Show more';
        }
      });
      div.appendChild(toggleBtn);
    } else {
      const span = document.createElement('span');
      span.className = 'qrls-text';
      span.textContent = result.data;
      span.style.cssText = 'display:block;color:#333;margin-bottom:6px;padding-right:16px;';
      div.appendChild(span);
    }

    const copyBtn = document.createElement('button');
    copyBtn.className = 'qrls-copy-btn';
    copyBtn.textContent = 'Copy';
    copyBtn.style.cssText = [
      'background:#1a73e8',
      'color:#fff',
      'border:none',
      'border-radius:4px',
      'padding:3px 10px',
      'cursor:pointer',
      'font-size:12px'
    ].join(';');
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(result.data).then(() => {
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, COPY_RESET_DELAY_MS);
      }).catch(() => {
        copyBtn.textContent = 'Failed';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, COPY_RESET_DELAY_MS);
      });
    });
    div.appendChild(copyBtn);
  }

  const attribution = document.createElement('div');
  attribution.textContent = ATTRIBUTION_LABEL;
  attribution.style.cssText = 'font-size:10px;color:#aaa;text-align:right;margin-top:4px;';
  div.appendChild(attribution);

  return div;
}

function createBackdrop() {
  const div = document.createElement('div');
  div.className = 'qrls-backdrop';
  div.style.cssText = [
    'position:fixed',
    'inset:0',
    'background:rgba(0,0,0,0.45)',
    'z-index:2147483646',
    'opacity:0',
    'transition:opacity 0.2s ease'
  ].join(';');
  div.addEventListener('click', () => {
    removeOverlays();
    syncBackdrop();
  });
  return div;
}

let _savedOverflow = null;

function showBackdrop() {
  if (document.querySelector('.qrls-backdrop')) return;
  _savedOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  const backdrop = createBackdrop();
  document.body.appendChild(backdrop);
  requestAnimationFrame(() => { backdrop.style.opacity = '1'; });
}

function syncBackdrop() {
  if (document.querySelectorAll('.qrls-overlay').length > 0) return;
  const backdrop = document.querySelector('.qrls-backdrop');
  if (!backdrop) return;
  backdrop.style.opacity = '0';
  document.body.style.overflow = _savedOverflow || '';
  _savedOverflow = null;
  setTimeout(() => backdrop.remove(), 200);
}

function createToast() {
  const div = document.createElement('div');
  div.className = 'qrls-toast';
  div.textContent = 'No QR codes found';
  div.style.cssText = [
    'position:fixed',
    'bottom:24px',
    'left:50%',
    'transform:translateX(-50%)',
    'background:#333',
    'color:#fff',
    'padding:10px 20px',
    'border-radius:6px',
    'font-family:sans-serif',
    'font-size:14px',
    'z-index:2147483647',
    'opacity:1',
    'transition:opacity 0.5s ease'
  ].join(';');
  return div;
}

function removeOverlays() {
  document.querySelectorAll('.qrls-overlay').forEach(el => el.remove());
}

function showToast() {
  const toast = createToast();
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 500);
  }, TOAST_DURATION_MS);
}

function injectOverlays(results) {
  showBackdrop();
  results.forEach(result => {
    document.body.appendChild(createOverlay(result, syncBackdrop));
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHECK_TOGGLE') {
    const overlays = document.querySelectorAll('.qrls-overlay');
    if (overlays.length > 0) {
      removeOverlays();
      syncBackdrop();
      sendResponse({ toggled: true });
    } else {
      sendResponse({ toggled: false });
    }
    return true;
  }

  if (message.type === 'SHOW_RESULTS') {
    if (!message.results || message.results.length === 0) {
      showToast();
    } else {
      injectOverlays(message.results);
    }
    return false;
  }

  return false;
});

if (typeof module !== 'undefined') {
  module.exports = { isUrl, createOverlay, createToast, createBackdrop, showBackdrop, syncBackdrop };
}
