import { useState, useCallback, useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
import UploadZone from './components/UploadZone';
import VideoPreview from './components/VideoPreview';
import ControlPanel from './components/ControlPanel';
import ConversionDisplay from './components/ConversionDisplay';
import OutputPanel from './components/OutputPanel';
import LogsPanel from './components/LogsPanel';
import { useGifEncoder, computeDimensions, MAX_FRAMES } from './hooks/useGifEncoder';
import './styles/global.css';
import './App.css';

const APP_VERSION = __APP_VERSION__;

const DEFAULT_SETTINGS = {
  fps: 10,
  scale: 320,
  quality: 'quality',
  dither: false,
  colors: 256,
  lossy: 0,
};

// status: idle | previewing | converting | done | error
export default function App() {
  const [status, setStatus] = useState('idle');
  const [videoFile, setVideoFile] = useState(null);
  const [videoMeta, setVideoMeta] = useState(null);
  const [trim, setTrim] = useState({ start: 0, end: 10 });
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [gifBlob, setGifBlob] = useState(null);
  const [convError, setConvError] = useState('');
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('eigie-theme');
      const parsed = saved ? parseInt(saved, 10) : 1;
      return parsed >= 1 && parsed <= 4 ? parsed : 1;
    } catch {
      return 1;
    }
  });

  const { progress, log, logs, error: encodeError, convert, cancel } = useGifEncoder();

  // Pre-flight frame count and RAM estimate
  const clipLen = trim.end - trim.start;
  const expectedFrames = videoMeta ? Math.max(1, Math.ceil(clipLen * settings.fps)) : 0;
  const tooManyFrames = expectedFrames > MAX_FRAMES;

  let estimatedRamMb = 0;
  if (videoMeta && expectedFrames > 0) {
    const { width, height } = computeDimensions(settings.scale, videoMeta.width, videoMeta.height);
    estimatedRamMb = Math.round(expectedFrames * width * height * 4 / (1024 * 1024));
  }

  // Apply theme to document root
  useEffect(() => {
    if (theme === 1) {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', String(theme));
    }
    try { localStorage.setItem('eigie-theme', String(theme)); } catch {}
  }, [theme]);

  const handleFile = useCallback((file) => {
    setVideoFile(file);
    setVideoMeta(null);
    setGifBlob(null);
    setConvError('');
    setStatus('previewing');
  }, []);

  const handleReset = useCallback(() => {
    setVideoFile(null);
    setVideoMeta(null);
    setGifBlob(null);
    setConvError('');
    setStatus('idle');
  }, []);

  const handleConvert = useCallback(async () => {
    if (!videoFile || tooManyFrames) return;
    setStatus('converting');
    setConvError('');
    try {
      const blob = await convert(videoFile, trim, settings);
      setGifBlob(blob);
      setStatus('done');
    } catch (err) {
      if (err.name === 'CancelError') {
        setStatus('previewing'); // Clean cancel — no error shown
      } else {
        setConvError(err.message);
        setStatus('error');
      }
    }
  }, [videoFile, trim, settings, convert, tooManyFrames]);

  const handleCancel = useCallback(() => {
    cancel();
    // Status transitions to 'previewing' via the CancelError catch in handleConvert
  }, [cancel]);

  // Auto-adjust fps (and clip length if needed) to bring expectedFrames under MAX_FRAMES
  const handleAutoAdjust = useCallback(() => {
    const len = trim.end - trim.start;
    const validFps = [8, 10, 15, 24];
    const fpsOptions = validFps.filter(f => Math.ceil(len * f) <= MAX_FRAMES);

    if (fpsOptions.length > 0) {
      // Keep the clip, just lower fps to the highest that fits
      const newFps = fpsOptions[fpsOptions.length - 1];
      setSettings(s => ({ ...s, fps: newFps }));
    } else {
      // Clip is too long even at minimum fps — shorten it too
      const maxLen = Math.floor(MAX_FRAMES / 8);
      setTrim(t => ({ ...t, end: t.start + maxLen }));
      setSettings(s => ({ ...s, fps: 8 }));
    }
  }, [trim]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-logo">
            <span className="app-logo-mark">▶</span>
            <span className="app-logo-text">eigie</span>
          </div>
          <div className="app-tagline">
            <span className="label">everything is gif is everything</span>
          </div>
          <div className="app-header-leds">
            {[1, 2, 3, 4].map((t) => (
              <span
                key={t}
                className={`header-led${theme === t ? ' header-led--active' : ''}`}
                data-led={t}
                onClick={() => setTheme(t)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setTheme(t)}
                aria-label={`Theme ${t}`}
                title={`Theme ${t}`}
              />
            ))}
          </div>
        </div>
      </header>

      <main className="app-main">
        {(convError || encodeError) && (
          <div className="app-error">
            <span className="label" style={{ color: 'var(--c-accent)' }}>
              {convError || encodeError}
            </span>
          </div>
        )}

        {status === 'idle' && (
          <div className="app-upload">
            <UploadZone onFile={handleFile} />
          </div>
        )}

        {(status === 'previewing' || status === 'converting' || status === 'error') && videoFile && !gifBlob && (
          <div className="app-workspace">
            <div className="app-col app-col--main">
              <VideoPreview
                file={videoFile}
                trim={trim}
                onTrimChange={setTrim}
                onReset={handleReset}
                onMetadata={setVideoMeta}
              />
            </div>
            <div className="app-col app-col--side">
              <ControlPanel settings={settings} onChange={setSettings} />
              <ConversionDisplay
                status={status}
                progress={progress}
                log={log}
                onConvert={handleConvert}
                onCancel={handleCancel}
                onAutoAdjust={handleAutoAdjust}
                canConvert={(status === 'previewing' || status === 'error') && !tooManyFrames}
                expectedFrames={expectedFrames}
                estimatedRamMb={estimatedRamMb}
                tooManyFrames={tooManyFrames}
                maxFrames={MAX_FRAMES}
                fps={settings.fps}
              />
            </div>
            <div className="app-logs">
              <LogsPanel logs={logs} />
            </div>
          </div>
        )}

        {status === 'done' && gifBlob && (
          <div className="app-output">
            <OutputPanel gifBlob={gifBlob} onReset={handleReset} />
            <LogsPanel logs={logs} />
          </div>
        )}
      </main>

      <footer className="app-footer">
        <span className="label">eigie · fully client-side · your video never leaves your device</span>
        <span className="label" style={{ color: 'var(--c-dim)' }}>{APP_VERSION} · gif.js · WebCodecs</span>
      </footer>
      <Analytics />
    </div>
  );
}
