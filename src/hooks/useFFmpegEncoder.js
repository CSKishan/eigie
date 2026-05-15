/**
 * Tier 2 encoder — FFmpeg.wasm (lazy-loaded from CDN, ~25 MB, browser-cached).
 *
 * Advantages over gifenc (Tier 1):
 *  - palettegen: analyses all frames together → optimal 256-colour global palette
 *  - paletteuse: dither=bayer produces visibly better gradients and skin tones
 *  - Handles any codec the browser can't decode natively (some MKV/AVI/H.265)
 *
 * Limitation:
 *  - The entire input file must be written to FFmpeg's in-memory virtual FS (MEMFS).
 *    Files larger than MAX_FILE_SIZE_HD will OOM the browser tab.
 *  - Trigger Tier 2 only when file.size <= MAX_FILE_SIZE_HD.
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

// Files larger than this cannot safely be written to MEMFS.
export const MAX_FILE_SIZE_HD = 200 * 1024 * 1024; // 200 MB

// CDN source for the single-thread (no SharedArrayBuffer) FFmpeg core.
// Single-thread avoids the COOP/COEP header requirement — works on any origin.
const CDN = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm';

// Singleton: the 25 MB WASM binary is loaded once and reused across conversions.
let _ffmpeg = null;
let _loadPromise = null;

async function getFFmpeg() {
  if (_ffmpeg) return _ffmpeg;
  if (_loadPromise) return _loadPromise;

  const ffmpeg = new FFmpeg();
  _loadPromise = ffmpeg
    .load({
      coreURL: `${CDN}/ffmpeg-core.js`,
      wasmURL: `${CDN}/ffmpeg-core.wasm`,
    })
    .then(() => {
      _ffmpeg = ffmpeg;
      _loadPromise = null;
      return ffmpeg;
    });

  return _loadPromise;
}

/**
 * Convert a video clip to GIF using FFmpeg.wasm with palettegen+paletteuse.
 *
 * @param {File}   file     - The video File object (must be ≤ MAX_FILE_SIZE_HD)
 * @param {{start,end}} trim - Clip boundaries in seconds
 * @param {object} settings - App settings: { fps, scale, colors }
 * @param {object} cbs      - Callbacks: { log(text,type), setProgress(0-100), setPhase(string|null) }
 * @returns {Promise<Blob>}  - The output GIF blob
 */
export async function convertWithFFmpeg(file, trim, settings, { log, setProgress, setPhase }) {
  // ── Load (or reuse) FFmpeg ─────────────────────────────────────────────────
  setPhase('loading');
  log('loading HD encoder (FFmpeg ~25 MB, cached after first use)…', 'system');
  setProgress(2);

  let ffmpeg;
  try {
    ffmpeg = await getFFmpeg();
  } catch (err) {
    setPhase(null);
    throw new Error('Failed to load FFmpeg encoder: ' + (err.message || String(err)));
  }

  log('HD encoder ready', 'system');

  // ── Write input file to MEMFS ──────────────────────────────────────────────
  setPhase('encoding');
  const ext = (file.name.split('.').pop() || 'mp4').toLowerCase();
  const inputName = `input.${ext}`;

  log(`writing ${(file.size / 1024 / 1024).toFixed(1)} MB to encoder memory…`, 'system');
  setProgress(5);

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file));
  } catch (err) {
    setPhase(null);
    throw new Error('Failed to write video (file may be too large for HD mode): ' + (err.message || String(err)));
  }

  // ── Encode ─────────────────────────────────────────────────────────────────
  const { fps, scale, colors } = settings;
  const clipStart = trim.start;
  const duration = Math.max(0.1, trim.end - trim.start);
  const scaleFilter = scale === -1
    ? 'iw:ih:flags=lanczos'           // original resolution
    : `${scale}:-1:flags=lanczos`;    // fixed width, preserve aspect ratio

  const vf = [
    `fps=${fps}`,
    `scale=${scaleFilter}`,
    `split[s0][s1]`,
    `[s0]palettegen=max_colors=${Math.min(colors, 256)}[p]`,
    `[s1][p]paletteuse=dither=bayer:bayer_scale=5`,
  ].join(',');

  log(`encoding: palettegen+paletteuse @ ${fps}fps, ${colors} colours, ${duration.toFixed(1)}s clip…`, 'system');
  setProgress(15);

  // Wire up progress — clean up afterwards to avoid listener accumulation.
  const onProgress = ({ progress: p }) => {
    if (p >= 0 && p <= 1) setProgress(15 + Math.round(p * 80));
  };
  ffmpeg.on('progress', onProgress);

  try {
    await ffmpeg.exec([
      '-ss', String(clipStart),
      '-t', String(duration),
      '-i', inputName,
      '-vf', vf,
      '-f', 'gif',
      'output.gif',
    ]);
  } catch (err) {
    ffmpeg.off('progress', onProgress);
    try { await ffmpeg.deleteFile(inputName); } catch {}
    setPhase(null);
    throw new Error('FFmpeg encoding failed: ' + (err.message || String(err)));
  }

  ffmpeg.off('progress', onProgress);
  setProgress(97);

  // ── Read output ────────────────────────────────────────────────────────────
  let data;
  try {
    data = await ffmpeg.readFile('output.gif');
  } catch (err) {
    setPhase(null);
    throw new Error('Failed to read FFmpeg output: ' + (err.message || String(err)));
  }

  // Cleanup MEMFS
  try { await ffmpeg.deleteFile(inputName); } catch {}
  try { await ffmpeg.deleteFile('output.gif'); } catch {}

  setPhase(null);
  setProgress(100);
  return new Blob([data], { type: 'image/gif' });
}
