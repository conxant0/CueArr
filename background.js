async function ensureContentScript(tabId) {
  try {
    const [{ result: alreadyInjected }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        if (window.__qrlsContentInjected) return true;
        window.__qrlsContentInjected = true;
        return false;
      }
    });
    if (!alreadyInjected) {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    }
  } catch {
    // Page does not support script injection (chrome://, web store, etc.)
  }
}

function waitForOffscreenReady() {
  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, 2000);
    const listener = (message) => {
      if (message.type === 'OFFSCREEN_READY') {
        clearTimeout(timeout);
        chrome.runtime.onMessage.removeListener(listener);
        resolve();
      }
    };
    chrome.runtime.onMessage.addListener(listener);
  });
}

let _offscreenCreating = null;

async function ensureOffscreenDocument() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });
  if (contexts.length > 0) return;
  if (_offscreenCreating) {
    await _offscreenCreating;
    return;
  }
  const readyPromise = waitForOffscreenReady();
  _offscreenCreating = chrome.offscreen.createDocument({
    url: chrome.runtime.getURL('offscreen.html'),
    reasons: ['DOM_SCRAPING'],
    justification: 'Decode QR codes from screenshot using jsQR and canvas'
  }).then(() => readyPromise).finally(() => { _offscreenCreating = null; });
  await _offscreenCreating;
}

async function handleTrigger(tab) {
  await ensureContentScript(tab.id);

  // Round-trip to content.js: remove overlays if any exist, otherwise proceed
  let toggleResponse;
  try {
    toggleResponse = await chrome.tabs.sendMessage(tab.id, { type: 'CHECK_TOGGLE' });
  } catch {
    toggleResponse = { toggled: false };
  }
  if (toggleResponse.toggled) return;

  let imageDataUrl;
  try {
    imageDataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
  } catch {
    chrome.tabs.sendMessage(tab.id, { type: 'SHOW_RESULTS', results: [] }).catch(() => {});
    return;
  }

  await ensureOffscreenDocument();
  let results;
  try {
    results = await chrome.runtime.sendMessage({ type: 'DECODE_QR', imageDataUrl });
  } catch (err) {
    console.error('Failed to decode QR via offscreen document:', err);
    chrome.tabs.sendMessage(tab.id, { type: 'SHOW_RESULTS', results: [] }).catch(() => {});
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'SHOW_RESULTS', results: results || [] });
  } catch {
    // Tab navigated away or content script unavailable
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'DEBUG_DUMP') {
    const { scanWidth, scanHeight, dpr, srcWidth, srcHeight } = message.meta;
    console.group(`CueArr scan failure (scan ${scanWidth}x${scanHeight}, dpr=${dpr}, src ${srcWidth}x${srcHeight})`);
    for (const { label, dataUrl } of message.dumps) console.log(label, dataUrl);
    console.groupEnd();
  }
});

chrome.action.onClicked.addListener((tab) => {
  handleTrigger(tab).catch(console.error);
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
  }
});
