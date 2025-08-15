// server.js
// Backend that provides /formats and /download endpoints.
// Requires: ffmpeg in PATH.

const express = require('express');
const cors = require('cors');
const ytdl = require('@distube/ytdl-core');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// GET /formats?url=<youtube_url>
// Returns JSON: { title, thumbnail, formats: [{ itag, container, qualityLabel, hasAudio, hasVideo, approxSize }] }
app.get('/formats', async (req, res) => {
  const videoUrl = req.query.url;
  if (!videoUrl) return res.status(400).json({ error: 'Missing url param' });

  try {
    if (!ytdl.validateURL(videoUrl)) return res.status(400).json({ error: 'Invalid YouTube URL' });

    const info = await ytdl.getInfo(videoUrl);

    const formats = info.formats
      // keep formats that have a URL and are audio/video related
      .filter(f => f && (f.hasVideo || f.hasAudio) && f.itag && (f.container || f.mimeType))
      .map(f => ({
        itag: f.itag,
        container: f.container || (f.mimeType || '').split('/')[1] || 'mp4',
        qualityLabel: f.qualityLabel || (f.audioBitrate ? `${f.audioBitrate}kbps` : null),
        hasAudio: !!f.hasAudio,
        hasVideo: !!f.hasVideo,
        approxSize: f.contentLength ? Math.round(Number(f.contentLength) / (1024 * 1024)) + ' MB' : 'N/A'
      }));

    // dedupe by itag (just in case)
    const seen = new Set();
    const deduped = [];
    for (const f of formats) {
      if (!seen.has(f.itag)) {
        seen.add(f.itag);
        deduped.push(f);
      }
    }

    res.json({
      title: info.videoDetails.title,
      thumbnail: (info.videoDetails.thumbnails && info.videoDetails.thumbnails.slice(-1)[0]?.url) || null,
      formats: deduped
    });
  } catch (err) {
    console.error('formats error', err);
    res.status(500).json({ error: 'Failed to fetch formats', details: err.message });
  }
});

// GET /download?url=<youtube_url>&itag=<itag>
// Streams the selected format to the client; merges with best audio if selected format lacks audio.
// GET /download?url=<youtube_url>&itag=<itag>
app.get('/download', async (req, res) => {
  const videoUrl = req.query.url;
  const itag = req.query.itag;
  if (!videoUrl || !itag) return res.status(400).send('Missing url or itag');

  try {
    if (!ytdl.validateURL(videoUrl)) return res.status(400).send('Invalid YouTube URL');

    const info = await ytdl.getInfo(videoUrl);

    const chosen = ytdl.chooseFormat(info.formats, { quality: itag.toString() });
    if (!chosen) return res.status(400).send('Format not found');

    const safeTitle = (info.videoDetails.title || 'video')
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
      .slice(0, 200);
    const filename = `${safeTitle}.mp4`;

    if (chosen.hasAudio && chosen.hasVideo) {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', chosen.mimeType || 'video/mp4');
      return ytdl(videoUrl, { format: chosen, highWaterMark: 1 << 25 }).pipe(res);
    }

    let videoFormat = chosen.hasVideo ? chosen : null;
    let audioFormat = chosen.hasAudio ? chosen : null;

    if (!videoFormat) {
      const videoCandidates = info.formats.filter(f => f.hasVideo && !f.hasAudio);
      videoCandidates.sort((a, b) =>
        (parseInt((b.qualityLabel || '').replace(/\D/g, '')) || 0) -
        (parseInt((a.qualityLabel || '').replace(/\D/g, '')) || 0)
      );
      videoFormat = videoCandidates[0];
    }

    if (!audioFormat) {
      const audioCandidates = info.formats.filter(f => f.hasAudio && !f.hasVideo);
      audioCandidates.sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0));
      audioFormat = audioCandidates[0];
    }

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'video/mp4');

    const ffmpeg = spawn('ffmpeg', [
      '-loglevel', 'error',
      '-i', 'pipe:3',
      '-i', 'pipe:4',
      '-map', '0:v:0',
      '-map', '1:a:0',
      '-c:v', 'copy',
      '-c:a', 'aac', '-b:a', '192k',
      '-shortest',
      '-movflags', 'frag_keyframe+empty_moov',
      '-f', 'mp4',
      'pipe:1'
    ], {
      stdio: ['ignore', 'pipe', 'pipe', 'pipe', 'pipe']
    });

    ffmpeg.on('error', err => {
      console.error('ffmpeg spawn error', err);
      res.end();
    });

    ffmpeg.stdout.pipe(res);

    const videoStream = ytdl(videoUrl, { format: videoFormat, highWaterMark: 1 << 25 });
    const audioStream = ytdl(videoUrl, { format: audioFormat, highWaterMark: 1 << 25 });

    videoStream.pipe(ffmpeg.stdio[3]);
    audioStream.pipe(ffmpeg.stdio[4]);

    req.on('close', () => {
      videoStream.destroy();
      audioStream.destroy();
      ffmpeg.kill('SIGKILL');
    });

  } catch (err) {
    console.error('download error', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});


app.get('/', (_, res) => res.send('YT downloader backend running'));
app.listen(PORT, () => console.log(`YT downloader backend listening on http://localhost:${PORT}`));
