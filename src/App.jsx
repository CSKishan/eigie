import { useState, useCallback } from 'react';
import UploadZone from './components/UploadZone';
import VideoPreview from './components/VideoPreview';
import ControlPanel from './components/ControlPanel';
import ConversionDisplay from './components/ConversionDisplay';
import OutputPanel from './components/OutputPanel';
import LogsPanel from './components/LogsPanel';
import { useGifEncoder } from './hooks/useGifEncoder';
import './styles/global.css';
import './App.css';

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
  const [trim, setTrim] = useState({ start: 0, end: 10 });
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [gifBlob, setGifBlob] = useState(null);
  const [convError, setConvError] = useState('');

  const { progress, log, logs, error: encodeError, convert } = useGifEncoder();

  const handleFile = useCallback((file) => {
    setVideoFile(file);
    setGifBlob(null);
    setConvError('');
    setStatus('previewing');
  }, []);

  const handleReset = useCallback(() => {
    setVideoFile(null);
    setGifBlob(null);
    setConvError('');
    setStatus('idle');
  }, []);

  const handleConvert = useCallback(async () => {
    if (!videoFile) return;
    setStatus('converting');
    setConvError('');
    try {
      const blob = await convert(videoFile, trim, settings);
      setGifBlob(blob);
      setStatus('done');
    } catch (err) {
      setConvError(err.message);
      setStatus('error');
    }
  }, [videoFile, trim, settings, convert]);

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
            <span className="header-led header-led--on" />
            <span className="header-led" />
            <span className="header-led" />
            <span className="header-led" />
          </div>
        </div>
      </header>

      <main className="app-main">
        {(convError || encodeError) && (
          <div className="app-error">
            <span className="label" style={{ color: 'var(--c-orange)' }}>
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
              />
            </div>
            <div className="app-col app-col--side">
              <ControlPanel settings={settings} onChange={setSettings} />
              <ConversionDisplay
                status={status}
                progress={progress}
                log={log}
                onConvert={handleConvert}
                canConvert={status === 'previewing' || status === 'error'}
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
        <span className="label" style={{ color: 'var(--c-dim)' }}>gif.js · WebCodecs</span>
      </footer>
    </div>
  );
}
