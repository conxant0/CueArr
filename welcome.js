const isMac = navigator.platform.toUpperCase().includes('MAC');
document.getElementById('shortcut-key').textContent = isMac ? 'Option+Q' : 'Alt+Q';

document.getElementById('change-shortcut-btn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});
