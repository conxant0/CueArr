function isUrl(str) {
  return /^https?:\/\//i.test(str);
}

function createOverlay(result) {
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
  closeBtn.addEventListener('click', () => div.remove());
  div.appendChild(closeBtn);

  if (isUrl(result.data)) {
    const a = document.createElement('a');
    a.className = 'qrls-link';
    a.setAttribute('href', result.data);
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
    a.textContent = result.data;
    a.style.cssText = 'color:#1a73e8;text-decoration:underline;display:block;padding-right:16px;';
    a.addEventListener('click', () => div.remove());
    div.appendChild(a);
  } else {
    const span = document.createElement('span');
    span.className = 'qrls-text';
    span.textContent = result.data;
    span.style.cssText = 'display:block;color:#333;margin-bottom:6px;padding-right:16px;';
    div.appendChild(span);

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
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
      }).catch(() => {
        copyBtn.textContent = 'Failed';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
      });
    });
    div.appendChild(copyBtn);
  }

  return div;
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
  }, 3000);
}

function injectOverlays(results) {
  results.forEach(result => {
    document.body.appendChild(createOverlay(result));
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHECK_TOGGLE') {
    const overlays = document.querySelectorAll('.qrls-overlay');
    if (overlays.length > 0) {
      removeOverlays();
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
  module.exports = { isUrl, createOverlay, createToast };
}
