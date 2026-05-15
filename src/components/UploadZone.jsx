import { useRef, useState, useCallback } from 'react';
import './UploadZone.css';

const ACCEPTED = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/mpeg'];

export default function UploadZone({ onFile }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');

  const validate = useCallback((file) => {
    if (!file) return false;
    if (!file.type.startsWith('video/') && !ACCEPTED.includes(file.type)) {
      setError('ERR: unsupported format. use mp4, webm, mov, avi, mkv');
      return false;
    }
    if (file.size > 2 * 1024 * 1024 * 1024) {
      setError('ERR: file too large (max 2gb)');
      return false;
    }
    setError('');
    return true;
  }, []);

  const handleFile = useCallback((file) => {
    if (validate(file)) onFile(file);
  }, [validate, onFile]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  }, [handleFile]);

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => setDragOver(false), []);

  const onInputChange = useCallback((e) => {
    handleFile(e.target.files[0]);
  }, [handleFile]);

  return (
    <div className="upload-root">
      <div className="upload-header">
        <span className="label">input</span>
        <span className="label upload-formats">mp4 · webm · mov · avi · mkv</span>
      </div>

      <div
        className={`upload-zone ${dragOver ? 'upload-zone--active' : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        aria-label="Upload video file"
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          onChange={onInputChange}
          style={{ display: 'none' }}
        />

        <div className="upload-icon">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M16 4L16 22M16 4L10 10M16 4L22 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/>
            <path d="M4 24V28H28V24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/>
          </svg>
        </div>

        <p className="upload-label">
          {dragOver ? 'drop to load' : 'drag video here'}
        </p>
        <p className="upload-sub">or click to browse</p>

        <div className="upload-corner upload-corner--tl" />
        <div className="upload-corner upload-corner--tr" />
        <div className="upload-corner upload-corner--bl" />
        <div className="upload-corner upload-corner--br" />
      </div>

      {error && (
        <div className="upload-error">
          <span className="label" style={{ color: 'var(--c-accent)' }}>{error}</span>
        </div>
      )}
    </div>
  );
}
