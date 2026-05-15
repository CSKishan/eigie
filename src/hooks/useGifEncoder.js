import { useRef, useState, useCallback, useEffect } from 'react';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

// gifenc encodes each frame immediately and discards raw pixel data, so memory
// is bounded to ~1 frame at a time regardless of clip length.
// MAX_FRAMES raised from 300 (gif.js era) to 600 — 60 seconds at 10 fps.
export const MAX_FRAMES = 600;

class CancelError extends Error {
  constructor() { super('Conversion cancelled'); this.name = 'CancelError'; }
}

function ts() {
  return new Date().toISOString().slice(11, 23);
}

export function computeDimensions(scale, videoWidth, videoHeight) {
  if (scale === -1) return { width: videoWidth, height: videoHeight };
  const ratio = videoHeight / videoWidth;
  const w = Math.min(scale, videoWidth);
  const h = Math.round(w * ratio);
  return { width: w % 2 === 0 ? w : w - 1, height: h % 2 === 0 ? h : h - 1 };
}

// Kept exported for test-suite compatibility.
export function processFrame(imgData, prevSnapped, snapStep) {
  const data = imgData.data;
  const numPixels = data.length / 4;
  const snapped = new Uint8Array(numPixels * 3);
  let changed = 0;

  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    if (snapStep > 1) {
      r = Math.min(255, Math.round(r / snapStep) * snapStep);
      g = Math.min(255, Math.round(g / snapStep) * snapStep);
      b = Math.min(255, Math.round(b / snapStep) * snapStep);
    }

    snapped[j] = r;
    snapped[j + 1] = g;
    snapped[j + 2] = b;

    if (prevSnapped && r === prevSnapped[j] && g === prevSnapped[j + 1] && b === prevSnapped[j + 2]) {
      data[i] = 1;
      data[i + 1] = 1;
      data[i + 2] = 1;
    } else {
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      changed++;
    }
  }

  return { snapped, changeRatio: changed / numPixels };
}

/**
 * Encode one frame into the streaming gifenc GIFEncoder.
 *
 * For the first frame every pixel is encoded as-is (full palette).
 * For subsequent frames, unchanged pixels are collected into a
 * `transparentMask` and the palette is built from *only* the changed
 * pixels.  The transparent palette slot is appended at the end so
 * changed pixels can never inadvertently fall into it.
 *
 * Duplicate frames (< 2 % changed) accumulate their delay into
 * `state.pendingDelayMs` and are skipped without writing a frame.
 *
 * Returns `true` if a frame was written, `false` if it was a dup.
 */
function processAndEncodeFrame(gif, imgData, width, height, state, frameDelayMs, colors, snapStep) {
  const data = imgData.data; // Uint8ClampedArray (RGBA, modified in-place)
  const numPixels = width * height;
  const snapped = new Uint8Array(numPixels * 3);
  const isFirst = state.isFirst;
  const ps = state.prevSnapped;
  let changedCount = 0;
  const transparentMask = isFirst ? null : new Uint8Array(numPixels);

  // ── Pass 1: snap colors and build delta mask ──────────────────────────────
  for (let i = 0, j = 0; i < numPixels; i++, j += 3) {
    const bi = i << 2; // i * 4
    let r = data[bi], g = data[bi + 1], b = data[bi + 2];
    if (snapStep > 1) {
      r = Math.min(255, Math.round(r / snapStep) * snapStep);
      g = Math.min(255, Math.round(g / snapStep) * snapStep);
      b = Math.min(255, Math.round(b / snapStep) * snapStep);
    }
    snapped[j] = r; snapped[j + 1] = g; snapped[j + 2] = b;
    data[bi] = r; data[bi + 1] = g; data[bi + 2] = b; data[bi + 3] = 255;

    if (!isFirst && ps && r === ps[j] && g === ps[j + 1] && b === ps[j + 2]) {
      if (transparentMask) transparentMask[i] = 1;
    } else {
      changedCount++;
    }
  }

  const changeRatio = changedCount / numPixels;

  // ── Dup detection: accumulate delay, skip writing ─────────────────────────
  if (!isFirst && changeRatio < 0.02) {
    state.pendingDelayMs += frameDelayMs;
    state.skipped++;
    return false;
  }

  // ── Quantise and build indexed pixel array ────────────────────────────────
  let palette, indexed, transparentIndex;

  if (isFirst || changedCount === numPixels) {
    // First frame or complete scene change — no transparency needed.
    palette = quantize(data, colors);
    indexed = applyPalette(data, palette);
    transparentIndex = undefined;
  } else {
    // Delta frame: build palette only from changed pixels, reserve one slot
    // at the END for the transparent sentinel so changed pixels are never
    // accidentally mapped to it by applyPalette.
    const maxRealColors = Math.max(2, colors - 1);
    const changedRGBA = new Uint8ClampedArray(changedCount * 4);
    let ci = 0;
    for (let i = 0; i < numPixels; i++) {
      if (!transparentMask[i]) {
        const bi = i << 2;
        changedRGBA[ci++] = data[bi];
        changedRGBA[ci++] = data[bi + 1];
        changedRGBA[ci++] = data[bi + 2];
        changedRGBA[ci++] = 255;
      }
    }

    const basePalette = quantize(changedRGBA, maxRealColors);
    const numRealColors = basePalette.length / 3;
    transparentIndex = numRealColors;

    // Full palette: [real colors … | transparent sentinel]
    palette = new Uint8Array((numRealColors + 1) * 3);
    palette.set(basePalette, 0);
    // Sentinel color doesn't matter (it's transparent); leave as [0,0,0].

    // Map changed pixels → their palette indices (0..numRealColors-1).
    const changedIndexed = applyPalette(changedRGBA, basePalette);

    // Build full indexed array.
    indexed = new Uint8Array(numPixels);
    let ci2 = 0;
    for (let i = 0; i < numPixels; i++) {
      indexed[i] = transparentMask[i] ? transparentIndex : changedIndexed[ci2++];
    }
  }

  const delay = Math.round((frameDelayMs + state.pendingDelayMs) / 10); // centiseconds
  state.pendingDelayMs = 0;

  gif.writeFrame(indexed, width, height, {
    palette,
    delay,
    transparent: transparentIndex,
    // dispose=1: do not clear — transparent pixels composite over the previous frame.
    dispose: transparentIndex !== undefined ? 1 : 0,
  });

  state.prevSnapped = snapped;
  state.added++;
  state.isFirst = false;
  return true;
}

const HAS_RVFC = typeof HTMLVideoElement !== 'undefined'
  && 'requestVideoFrameCallback' in HTMLVideoElement.prototype;

export function useGifEncoder() {
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState('');
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');

  const logBuf = useRef([]);
  const flushTimer = useRef(null);
  const isCancelledRef = useRef(false);

  const flushLogs = useCallback(() => {
    const buf = logBuf.current;
    if (buf.length === 0) return;
    const snapshot = buf.slice();
    logBuf.current = [];
    setLogs((prev) => {
      const combined = prev.concat(snapshot);
      return combined.length > 200 ? combined.slice(-200) : combined;
    });
    setLog(snapshot[snapshot.length - 1].text);
  }, []);

  const pushLog = useCallback((text, type = 'info') => {
    logBuf.current.push({ time: ts(), text, type });
    if (!flushTimer.current) {
      flushTimer.current = setTimeout(() => {
        flushTimer.current = null;
        flushLogs();
      }, 150);
    }
  }, [flushLogs]);

  const pushLogNow = useCallback((text, type = 'info') => {
    logBuf.current.push({ time: ts(), text, type });
    if (flushTimer.current) { clearTimeout(flushTimer.current); flushTimer.current = null; }
    flushLogs();
  }, [flushLogs]);

  useEffect(() => {
    return () => { if (flushTimer.current) clearTimeout(flushTimer.current); };
  }, []);

  async function extractFramesSeek(video, canvas, ctx, clipStart, fps, totalFrames,
    gif, frameDelayMs, snapStep, colors, frameState, pushLog, setProgress) {
    for (let i = 0; i < totalFrames; i++) {
      if (isCancelledRef.current) break;
      const t = clipStart + (i / fps);
      await new Promise((resolve, reject) => {
        video.addEventListener('seeked', resolve, { once: true });
        video.addEventListener('error', () => reject(new Error('Seek failed')), { once: true });
        video.currentTime = t;
      });
      if (isCancelledRef.current) break;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const added = processAndEncodeFrame(gif, imgData, canvas.width, canvas.height,
        frameState, frameDelayMs, colors, snapStep);

      setProgress(Math.round((i + 1) / totalFrames * 99));
      if (i % 10 === 0 || i === totalFrames - 1) {
        pushLog(`frame ${i + 1}/${totalFrames} (seek)${!added ? ' [dup]' : ''}`, 'system');
      }
      if (i % 30 === 29) await new Promise(r => setTimeout(r, 0));
    }
    return frameState.added + frameState.skipped;
  }

  function extractFramesPlayback(video, canvas, ctx, clipStart, clipEnd, fps, totalFrames,
    gif, frameDelayMs, snapStep, colors, frameState, pushLog, setProgress) {
    return new Promise((resolve, reject) => {
      let captured = 0;
      const interval = 1 / fps;
      let nextCaptureTime = clipStart;

      function onFrame(now, metadata) {
        if (isCancelledRef.current) {
          video.pause();
          resolve(captured);
          return;
        }

        const t = metadata.mediaTime;

        while (nextCaptureTime <= t && captured < totalFrames) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const added = processAndEncodeFrame(gif, imgData, canvas.width, canvas.height,
            frameState, frameDelayMs, colors, snapStep);
          captured++;

          setProgress(Math.round(captured / totalFrames * 99));
          if (captured % 10 === 0 || captured === totalFrames) {
            pushLog(`frame ${captured}/${totalFrames}${!added ? ' [dup]' : ''}`, 'system');
          }
          nextCaptureTime += interval;
        }

        if (captured >= totalFrames || t >= clipEnd) {
          video.pause();
          resolve(captured);
          return;
        }

        video.requestVideoFrameCallback(onFrame);
      }

      video.addEventListener('error', () => reject(new Error('Playback failed')), { once: true });
      video.addEventListener('ended', () => { resolve(captured); }, { once: true });
      video.currentTime = clipStart;
      video.addEventListener('seeked', () => {
        video.playbackRate = 2;
        video.requestVideoFrameCallback(onFrame);
        video.play().catch(reject);
      }, { once: true });
    });
  }

  const convert = useCallback(async (file, trim, settings) => {
    isCancelledRef.current = false;
    setError('');
    setProgress(0);
    logBuf.current = [];
    setLogs([]);

    const { fps, scale, colors, lossy } = settings;
    const frameDelayMs = Math.round(1000 / fps);

    const lossyStep = lossy || 0;
    const colorStep = colors >= 256 ? 0 : Math.ceil(256 / colors);
    const snapStep = Math.max(lossyStep, colorStep);

    pushLogNow('loading video…', 'system');
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = objectUrl;

    await new Promise((resolve, reject) => {
      video.addEventListener('loadedmetadata', resolve, { once: true });
      video.addEventListener('error', () => reject(new Error('Failed to load video')), { once: true });
    });

    const clipStart = Math.max(0, trim.start);
    const clipEnd = Math.min(video.duration, trim.end);
    const clipLen = clipEnd - clipStart;
    const totalFrames = Math.max(1, Math.ceil(clipLen * fps));
    const { width, height } = computeDimensions(scale, video.videoWidth, video.videoHeight);

    if (totalFrames > MAX_FRAMES) {
      URL.revokeObjectURL(objectUrl);
      throw new Error(
        `Too many frames (${totalFrames}). Trim the clip to under ${Math.ceil(MAX_FRAMES / fps)}s at ${fps}fps, or lower the fps setting.`
      );
    }

    pushLogNow(`source: ${video.videoWidth}×${video.videoHeight}, ${clipLen.toFixed(2)}s`, 'system');
    pushLogNow(`output: ${width}×${height} @ ${fps}fps → ${totalFrames} frames`, 'system');
    pushLogNow(`encoder: gifenc streaming (memory-bounded)`, 'system');
    pushLogNow(`method: ${HAS_RVFC ? 'requestVideoFrameCallback (fast)' : 'seek-based (fallback)'}`, 'system');
    if (snapStep > 0) pushLogNow(`color snap: step=${snapStep} (lossy=${lossyStep}, colors=${colors})`, 'system');

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // gifenc GIFEncoder: frames written one-at-a-time and immediately
    // converted to compressed LZW data — raw pixel data is discarded.
    const gif = GIFEncoder();

    const frameState = {
      prevSnapped: null,
      skipped: 0,
      added: 0,
      pendingDelayMs: 0,
      isFirst: true,
    };

    pushLogNow('extracting frames…', 'system');
    const t0 = performance.now();

    let framesExtracted;
    if (HAS_RVFC) {
      framesExtracted = await extractFramesPlayback(
        video, canvas, ctx, clipStart, clipEnd, fps, totalFrames,
        gif, frameDelayMs, snapStep, colors, frameState, pushLog, setProgress
      );
    } else {
      framesExtracted = await extractFramesSeek(
        video, canvas, ctx, clipStart, fps, totalFrames,
        gif, frameDelayMs, snapStep, colors, frameState, pushLog, setProgress
      );
    }

    URL.revokeObjectURL(objectUrl);

    if (isCancelledRef.current) {
      pushLogNow('conversion cancelled', 'system');
      throw new CancelError();
    }

    const extractMs = performance.now() - t0;
    pushLogNow(`extracted ${framesExtracted} frames → ${frameState.added} unique, ${frameState.skipped} duplicates skipped`, 'system');
    pushLogNow(`finalising gif…`, 'system');

    // gifenc: synchronous finalisation — no separate encoding phase.
    gif.finish();
    const bytes = gif.bytes();
    const blob = new Blob([bytes], { type: 'image/gif' });

    setProgress(100);
    pushLogNow(`done — ${(blob.size / 1024).toFixed(0)} KB in ${((performance.now() - t0) / 1000).toFixed(2)}s`, 'system');
    if (frameState.skipped > 0) {
      pushLogNow(`optimised: ${frameState.skipped} duplicate frames removed, ${frameState.added} frames encoded`, 'system');
    }
    return blob;
  }, [pushLog, pushLogNow, flushLogs]);

  const convertWithError = useCallback(async (...args) => {
    try {
      return await convert(...args);
    } catch (err) {
      if (err.name !== 'CancelError') {
        const msg = err.message || String(err);
        setError(msg);
        pushLogNow(msg, 'error');
      }
      throw err;
    }
  }, [convert, pushLogNow]);

  const cancel = useCallback(() => {
    isCancelledRef.current = true;
    // gifenc is synchronous — no worker to abort.
  }, []);

  // Exposed so the FFmpeg path (bypassing convert()) can drive the same UI.
  const resetState = useCallback(() => {
    isCancelledRef.current = false;
    setProgress(0);
    setLog('');
    setError('');
    logBuf.current = [];
    if (flushTimer.current) { clearTimeout(flushTimer.current); flushTimer.current = null; }
    setLogs([]);
  }, []);

  return { progress, log, logs, error, convert: convertWithError, cancel, setProgress, pushLogNow, resetState };
}
