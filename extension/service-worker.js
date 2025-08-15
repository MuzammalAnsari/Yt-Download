chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;

  if (msg.type === 'DOWNLOAD_VIA_BACKEND') {
    const { source, filename } = msg;
    const encoded = encodeURIComponent(source);
    const downloadUrl = `http://localhost:3000/download?source=${encoded}`;

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

    return true; // keep message channel open for async response
  }

  if (msg.action === 'openFormatsWindow' && msg.url) {
    chrome.windows.create({
      url: chrome.runtime.getURL(`popup.html?url=${encodeURIComponent(msg.url)}`),
      type: 'popup',
      width: 500,
      height: 700
    });
    // No response needed here
  }
});
