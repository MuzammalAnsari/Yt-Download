// popup.js

const BACKEND = 'http://localhost:3000';

// Elements
const videoUrlEl = document.getElementById('videoUrl');
const detectBtn = document.getElementById('detectBtn');
const fetchBtn = document.getElementById('fetchBtn');
const formatsList = document.getElementById('formatsList');
const statusEl = document.getElementById('status');
const videoInfo = document.getElementById('videoInfo');
const thumb = document.getElementById('thumb');
const titleEl = document.getElementById('title');
const progressBar = document.getElementById('progressBar');

// --- Helper functions ---
function setStatus(s = '') {
  statusEl.textContent = s;
}

function setProgress(percent) {
  if (progressBar) {
    progressBar.style.width = `${percent}%`;
    progressBar.textContent = `${percent}%`;
  }
}

// --- Detect current tab ---
detectBtn.addEventListener('click', async () => {
  setStatus('Detecting current tab URL...');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) {
    setStatus('No active tab URL');
    return;
  }
  videoUrlEl.value = tab.url;
  setStatus('');
});

// --- Fetch formats ---
fetchBtn.addEventListener('click', fetchFormats);

async function fetchFormats() {
  const url = videoUrlEl.value.trim();
  if (!url) {
    setStatus('Paste a YouTube URL');
    return;
  }

  setStatus('Fetching formats...');
  formatsList.innerHTML = '';
  videoInfo.classList.add('hidden');
  setProgress(0);

  try {
    const res = await fetch(`${BACKEND}/formats?url=${encodeURIComponent(url)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'unknown' }));
      setStatus('Error: ' + (err.error || res.statusText));
      return;
    }

    const data = await res.json();
    titleEl.textContent = data.title || '';
    thumb.src = data.thumbnail || '';
    if (data.thumbnail) videoInfo.classList.remove('hidden');

    const formats = (data.formats || []).slice().sort((a, b) => {
      const score = f =>
        (f.hasVideo && f.hasAudio ? 10000 : 0) +
        (parseInt((f.qualityLabel || '0').replace(/\D/g, '')) || 0);
      return score(b) - score(a);
    });

    if (formats.length === 0) {
      setStatus('No formats found');
      return;
    }

    formats.forEach(f => {
      const li = document.createElement('li');
      li.className = 'format-item';

      const left = document.createElement('div');
      left.className = 'format-left';
      left.innerHTML = `
        <div class="quality">${f.qualityLabel || 'Audio'}</div>
        <div class="details">
          ${f.container} · ${f.approxSize || ''} 
          ${f.hasVideo ? ' · video' : ''}${f.hasAudio ? ' · audio' : ''}
        </div>
      `;

      const btn = document.createElement('button');
      btn.className = 'buy';
      btn.textContent = 'Download';
      btn.addEventListener('click', () => {
        formatsList.innerHTML = ''; // hide other formats
        startDownload(url, f.itag, f.container, f.qualityLabel);
      });

      li.appendChild(left);
      li.appendChild(btn);
      formatsList.appendChild(li);
    });

    setStatus('');
  } catch (err) {
    console.error(err);
    setStatus('Failed to fetch formats');
  }
}

// --- Start download ---
async function startDownload(videoUrl, itag, container, qlabel) {
  setStatus('Preparing download...');
  setProgress(0);

  try {
    const downloadUrl = `${BACKEND}/download?url=${encodeURIComponent(videoUrl)}&itag=${encodeURIComponent(itag)}`;
    const safeFilename = `video_${(qlabel || itag).replace(/\s+/g, '_')}.${container || 'mp4'}`;

    // Use Chrome downloads API directly
    chrome.downloads.download(
      { url: downloadUrl, filename: safeFilename, saveAs: true },
      downloadId => {
        if (chrome.runtime.lastError) {
          setStatus('Download failed: ' + chrome.runtime.lastError.message);
          return;
        }
        setStatus('Downloading...');
        simulateProgress();
      }
    );
  } catch (err) {
    console.error(err);
    setStatus('Error starting download');
  }
}

// --- Fake progress bar for UX ---
function simulateProgress() {
  let p = 0;
  const interval = setInterval(() => {
    p += 5;
    if (p >= 100) {
      setProgress(100);
      clearInterval(interval);
    } else {
      setProgress(p);
    }
  }, 300);
}

// --- Auto-fetch if URL passed in query ---
document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const autoUrl = params.get("url");
  if (autoUrl) {
    videoUrlEl.value = autoUrl;
    fetchFormats();
  }
});
