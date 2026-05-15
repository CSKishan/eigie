import { useRef, useState, useEffect, useCallback } from 'react';
import './VideoPreview.css';

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 10);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${ms}`;
}

export default function VideoPreview({ file, trim, onTrimChange, onReset, onMetadata }) {
  const videoRef = useRef(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [objectUrl, setObjectUrl] = useState('');

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onLoadedMetadata = useCallback(() => {
    const v = videoRef.current;
    const d = v.duration;
    setDuration(d);
    onTrimChange({ start: 0, end: Math.min(d, 15) });
    if (onMetadata) {
      onMetadata({ duration: d, width: v.videoWidth, height: v.videoHeight });
    }
  }, [onTrimChange, onMetadata]);

  const onTimeUpdate = useCallback(() => {
    const t = videoRef.current?.currentTime ?? 0;
    setCurrentTime(t);
    if (t >= trim.end) {
      videoRef.current.pause();
      setPlaying(false);
      videoRef.current.currentTime = trim.start;
    }
  }, [trim]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) {
      v.pause();
      setPlaying(false);
    } else {
      if (v.currentTime < trim.start || v.currentTime >= trim.end) {
        v.currentTime = trim.start;
      }
      v.play();
      setPlaying(true);
    }
  }, [playing, trim]);

  const onStartChange = useCallback((e) => {
    const val = parseFloat(e.target.value);
    if (val < trim.end - 0.5) {
      onTrimChange({ ...trim, start: val });
      if (videoRef.current) videoRef.current.currentTime = val;
    }
  }, [trim, onTrimChange]);

  const onEndChange = useCallback((e) => {
    const val = parseFloat(e.target.value);
    if (val > trim.start + 0.5) {
      onTrimChange({ ...trim, end: val });
    }
  }, [trim, onTrimChange]);

  const trimDuration = trim.end - trim.start;
  const startPct = duration ? (trim.start / duration) * 100 : 0;
  const endPct = duration ? (trim.end / duration) * 100 : 100;
  const playheadPct = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="preview-root">
      <div className="preview-header">
        <span className="label">preview</span>
        <div className="preview-meta">
          <span className="label">{file.name.slice(0, 28)}{file.name.length > 28 ? '…' : ''}</span>
          <span className="label preview-size">{(file.size / 1024 / 1024).toFixed(1)}mb</span>
        </div>
      </div>

      <div className="preview-video-wrap">
        <video
          ref={videoRef}
          src={objectUrl}
          onLoadedMetadata={onLoadedMetadata}
          onTimeUpdate={onTimeUpdate}
          className="preview-video"
          playsInline
          muted={false}
        />
        <button className="preview-play-btn" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect x="3" y="2" width="4" height="14" fill="currentColor"/>
              <rect x="11" y="2" width="4" height="14" fill="currentColor"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 2L15 9L4 16V2Z" fill="currentColor"/>
            </svg>
          )}
        </button>
      </div>

      {/* Timeline / Trim */}
      <div className="trim-root">
        <div className="trim-header">
          <span className="label">trim</span>
          <span className="label trim-duration" style={{ color: trimDuration > 15 ? 'var(--c-accent)' : 'var(--c-muted)' }}>
            {formatTime(trimDuration)}
            {trimDuration > 15 && ' · long gif ahead'}
          </span>

        </div>

        <div className="trim-track">
          {/* Selected region */}
          <div
            className="trim-region"
            style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
          />
          {/* Playhead */}
          <div className="trim-playhead" style={{ left: `${playheadPct}%` }} />

          {/* Start handle */}
          <input
            type="range"
            className="trim-handle trim-handle--start"
            min={0}
            max={duration}
            step={0.1}
            value={trim.start}
            onChange={onStartChange}
          />
          {/* End handle */}
          <input
            type="range"
            className="trim-handle trim-handle--end"
            min={0}
            max={duration}
            step={0.1}
            value={trim.end}
            onChange={onEndChange}
          />
        </div>

        <div className="trim-times">
          <div className="trim-time-block">
            <span className="label">start</span>
            <span className="value">{formatTime(trim.start)}</span>
          </div>
          <div className="trim-time-block trim-time-block--right">
            <span className="label">end</span>
            <span className="value">{formatTime(trim.end)}</span>
          </div>
        </div>
      </div>

      <div className="preview-footer">
        <button className="btn btn--ghost" onClick={onReset}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M14 8H2M2 8L7 3M2 8L7 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/>
          </svg>
          load different video
        </button>
        <span className="label">{formatTime(duration)} total</span>
      </div>
    </div>
  );
}
