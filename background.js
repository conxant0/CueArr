async function ensureOffscreenDocument() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });
  if (contexts.length === 0) {
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL('offscreen.html'),
      reasons: ['DOM_SCRAPING'],
      justification: 'Decode QR codes from screenshot using jsQR and canvas'
    });
  }
}

async function handleTrigger(tab) {
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
    chrome.tabs.sendMessage(tab.id, { type: 'SHOW_RESULTS', results: [] });
    return;
  }

  await ensureOffscreenDocument();
  const results = await chrome.runtime.sendMessage({ type: 'DECODE_QR', imageDataUrl });

  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'SHOW_RESULTS', results: results || [] });
  } catch {
    // Tab navigated away or content script unavailable
  }
}

chrome.action.onClicked.addListener((tab) => {
  handleTrigger(tab).catch(console.error);
});
