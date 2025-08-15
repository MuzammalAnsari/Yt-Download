// background service worker
const BACKEND_BASE = 'http://localhost:3000'; // change to your backend domain in production

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'DOWNLOAD_VIA_BACKEND') {
    const { source, filename } = msg;
    // construct backend proxy URL
    const encoded = encodeURIComponent(source);
    const downloadUrl = `${BACKEND_BASE}/download?source=${encoded}`;

    // Use chrome.downloads.download to let Chrome manage the download (resume, progress, etc).
    chrome.downloads.download({
      url: downloadUrl,
      filename: filename || undefined,
      conflictAction: 'uniquify',
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ ok: true, downloadId });
      }
    });

    // Keep message channel open for async response
    return true;
  }
});


chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "openFormatsWindow" && msg.url) {
    chrome.windows.create({
      url: chrome.runtime.getURL(`popup.html?url=${encodeURIComponent(msg.url)}`),
      type: "popup",
      width: 500,
      height: 700
    });
  }
});
