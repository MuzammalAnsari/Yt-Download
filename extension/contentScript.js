// Lightweight content script to discover video sources on the page.
// Sends found sources to popup when requested via messaging.

function findVideoSources() {
  const sources = [];

  // 1) <video> elements and <source> children
  document.querySelectorAll('video').forEach(video => {
    // pick src if present
    if (video.currentSrc) {
      sources.push({ url: video.currentSrc, type: 'video', label: 'video.currentSrc' });
    } else if (video.src) {
      sources.push({ url: video.src, type: 'video', label: 'video.src' });
    }
    // any <source> tags
    video.querySelectorAll('source').forEach(s => {
      if (s.src) sources.push({ url: s.src, type: s.type || 'video', label: 'source tag' });
    });
  });

  // 2) Open Graph / meta tags (common for some players)
  const ogVideo = document.querySelector('meta[property="og:video"]') || document.querySelector('meta[name="og:video"]');
  if (ogVideo && ogVideo.content) {
    sources.push({ url: ogVideo.content, type: 'og:video', label: 'meta og:video' });
  }
  const twitterPlayer = document.querySelector('meta[name="twitter:player:stream"]');
  if (twitterPlayer && twitterPlayer.content) {
    sources.push({ url: twitterPlayer.content, type: 'twitter', label: 'twitter:stream' });
  }

  // 3) generic common tags (schema.org)
  const itemprop = document.querySelector('[itemprop="contentUrl"]');
  if (itemprop && itemprop.content) {
    sources.push({ url: itemprop.content, type: 'itemprop', label: 'itemprop contentUrl' });
  }

  // 4) search common player data attributes/JS variables (best-effort)
  // Example: HTML5 players may expose sources array in window variables - can't reliably enumerate all providers
  // Keep minimal — avoid heavy scanning.

  // Filter unique and http/https only
  const unique = {};
  const filtered = sources
    .map(s => ({ ...s, url: s.url }))
    .filter(s => s.url && /^https?:\/\//i.test(s.url))
    .filter(s => {
      if (unique[s.url]) return false;
      unique[s.url] = true;
      return true;
    });

  return filtered;
}

// Provide a message API so popup can ask for sources
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg === 'GET_VIDEO_SOURCES') {
    const found = findVideoSources();
    sendResponse({ ok: true, sources: found });
  }
});
