import { useRef, useState, useCallback, useEffect } from 'react';
import GIF from 'gif.js';

// Hard cap on frames to prevent browser OOM crashes.
// At 10fps this is 30 seconds; raised to 600 in v1.4.1 with omggif streaming encoder.
export const MAX_FRAMES = 300;

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

const TRANSPARENT_KEY = 0x010101;

const HAS_RVFC = typeof HTMLVideoElement !== 'undefined'
  && 'requestVideoFrameCallback' in HTMLVideoElement.prototype;

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

export function addProcessedFrame(gif, ctx, canvas, frameDelayMs, state, snapStep) {
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { snapped, changeRatio } = processFrame(imgData, state.prevSnapped, snapStep);

  if (state.prevSnapped && changeRatio < 0.02) {
    if (gif.frames.length > 0) {
      gif.frames[gif.frames.length - 1].delay += Math.round(frameDelayMs / 10);
    }
    state.skipped++;
    return false;
  }

  if (state.prevSnapped === null) {
    gif.options.transparent = null;
  } else {
    gif.options.transparent = TRANSPARENT_KEY;
  }

  gif.addFrame(imgData, { delay: frameDelayMs, copy: true });
  state.prevSnapped = snapped;
  state.added++;
  return true;
}

export function useGifEncoder() {
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState('');
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');

  const logBuf = useRef([]);
  const flushTimer = useRef(null);
  const isCancelledRef = useRef(false);
  const gifInstanceRef = useRef(null);

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

  async function extractFramesSeek(video, canvas, ctx, clipStart, fps, totalFrames, gif, frameDelayMs, snapStep, frameState, pushLog, setProgress) {
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
      const added = addProcessedFrame(gif, ctx, canvas, frameDelayMs, frameState, snapStep);

      setProgress(Math.round((i + 1) / totalFrames * 45));
      if (i % 10 === 0 || i === totalFrames - 1) {
        pushLog(`frame ${i + 1}/${totalFrames} (seek)${!added ? ' [dup]' : ''}`, 'system');
      }
      // Yield every 30 frames so the UI can repaint and cancel checks can fire
      if (i % 30 === 29) await new Promise(r => setTimeout(r, 0));
    }
    return frameState.added + frameState.skipped;
  }

  function extractFramesPlayback(video, canvas, ctx, clipStart, clipEnd, fps, totalFrames, gif, frameDelayMs, snapStep, frameState, pushLog, setProgress) {
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
          const added = addProcessedFrame(gif, ctx, canvas, frameDelayMs, frameState, snapStep);
          captured++;

          setProgress(Math.round(captured / totalFrames * 45));
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
      video.addEventListener("ended", () => { resolve(captured); // video ended before rvfc loop could terminate — resolve with whatever was captured
      }, {once: true});
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

    const { fps, scale, quality, dither, colors, lossy } = settings;
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

    // Guard against browser OOM — this check is a safety net; App.jsx blocks the button first.
    if (totalFrames > MAX_FRAMES) {
      URL.revokeObjectURL(objectUrl);
      throw new Error(
        `Too many frames (${totalFrames}). Trim the clip to under ${Math.ceil(MAX_FRAMES / fps)}s at ${fps}fps, or lower the fps setting.`
      );
    }

    pushLogNow(`source: ${video.videoWidth}×${video.videoHeight}, ${clipLen.toFixed(2)}s`, 'system');
    pushLogNow(`output: ${width}×${height} @ ${fps}fps → ${totalFrames} frames`, 'system');
    pushLogNow(`method: ${HAS_RVFC ? 'requestVideoFrameCallback (fast)' : 'seek-based (fallback)'}`, 'system');
    if (snapStep > 0) pushLogNow(`color snap: step=${snapStep} (lossy=${lossyStep}, colors=${colors})`, 'system');

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const workerCount = Math.min(navigator.hardwareConcurrency || 2, 4);
    const gif = new GIF({
      workers: workerCount,
      quality: quality === 'quality' ? 2 : 10,
      width,
      height,
      workerScript: '/gif.worker.js',
      dither: dither ? 'FloydSteinberg' : false,
      repeat: 0,
    });

    pushLog(`encoding with ${workerCount} workers (${quality === 'quality' ? 'high quality' : 'fast'})`, 'system');

    const frameState = { prevSnapped: null, skipped: 0, added: 0 };

    pushLogNow('extracting frames…', 'system');
    const t0 = performance.now();

    let framesExtracted;
    if (HAS_RVFC) {
      framesExtracted = await extractFramesPlayback(
        video, canvas, ctx, clipStart, clipEnd, fps, totalFrames,
        gif, frameDelayMs, snapStep, frameState, pushLog, setProgress
      );
    } else {
      framesExtracted = await extractFramesSeek(
        video, canvas, ctx, clipStart, fps, totalFrames,
        gif, frameDelayMs, snapStep, frameState, pushLog, setProgress
      );
    }

    URL.revokeObjectURL(objectUrl);

    // If cancelled during extraction, bail out before encoding starts.
    if (isCancelledRef.current) {
      pushLogNow('conversion cancelled', 'system');
      throw new CancelError();
    }

    const extractMs = performance.now() - t0;
    pushLogNow(`extracted ${framesExtracted} frames → ${frameState.added} unique, ${frameState.skipped} duplicates skipped`, 'system');
    pushLogNow(`extraction took ${(extractMs / 1000).toFixed(2)}s — encoding…`, 'system');

    setProgress(50);

    gif.on('progress', (p) => {
      setProgress(50 + Math.round(p * 49));
    });

    gifInstanceRef.current = gif;
    const t1 = performance.now();
    const blob = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Encoding timed out after 5 minutes')), 5 * 60 * 1000);
      gif.on('finished', (b) => {
        clearTimeout(timer);
        gifInstanceRef.current = null;
        // If cancel was clicked during encoding, discard the result.
        if (isCancelledRef.current) { reject(new CancelError()); } else { resolve(b); }
      });
      gif.render();
    });
    const encodeMs = performance.now() - t1;

    setProgress(100);
    const totalMs = extractMs + encodeMs;
    pushLogNow(`done — ${(blob.size / 1024).toFixed(0)} KB in ${(totalMs / 1000).toFixed(2)}s (extract: ${(extractMs / 1000).toFixed(2)}s, encode: ${(encodeMs / 1000).toFixed(2)}s)`, 'system');
    if (frameState.skipped > 0) {
      pushLogNow(`optimized: ${frameState.skipped} duplicate frames removed, ${frameState.added} frames encoded`, 'system');
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
    if (gifInstanceRef.current) {
      try { gifInstanceRef.current.abort(); } catch {}
      gifInstanceRef.current = null;
    }
  }, []);

  return { progress, log, logs, error, convert: convertWithError, cancel };
}
