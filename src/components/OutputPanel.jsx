import { useEffect, useState } from 'react';
import './OutputPanel.css';

function canShare() {
  return typeof navigator.share === 'function' && typeof navigator.canShare === 'function';
}

function formatFileSize(bytes) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} gb`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} mb`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} kb`;
  return `${bytes} b`;
}

function allSizes(bytes) {
  return [
    { unit: 'gb', value: (bytes / (1024 * 1024 * 1024)).toFixed(6) },
    { unit: 'mb', value: (bytes / (1024 * 1024)).toFixed(4) },
    { unit: 'kb', value: (bytes / 1024).toFixed(2) },
    { unit: 'bytes', value: bytes.toLocaleString() },
  ];
}

export default function OutputPanel({ gifBlob, onReset }) {
  const [gifUrl, setGifUrl] = useState('');
  const [gifSize, setGifSize] = useState(0);
  const [shareError, setShareError] = useState('');
  const [shareMessage, setShareMessage] = useState('');

  useEffect(() => {
    if (!gifBlob) return;
    const url = URL.createObjectURL(gifBlob);
    setGifUrl(url);
    setGifSize(gifBlob.size);
    return () => URL.revokeObjectURL(url);
  }, [gifBlob]);

  const download = () => {
    const a = document.createElement('a');
    a.href = gifUrl;
    a.download = `gif-${Date.now()}.gif`;
    a.click();
  };

  const shareWhatsApp = () => {
    setShareError('');
    setShareMessage('Coming soon. Stay tuned.');
  };

  if (!gifBlob || !gifUrl) return null;

  return (
    <div className="output-root">
      <div className="output-header">
        <span className="label">result</span>
        <div className="output-size-wrap">
          <span className="label output-size" style={{ color: 'var(--c-accent)' }}>
            {formatFileSize(gifSize)}
          </span>
          <div className="output-size-tooltip">
            <span className="label tooltip-title">how big is this?</span>
            {allSizes(gifSize).map(({ unit, value }) => (
              <div key={unit} className="tooltip-row">
                <span className="tooltip-unit">{unit}</span>
                <span className="tooltip-value">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="output-preview">
        <img src={gifUrl} alt="Generated GIF" className="output-gif" />
        <div className="output-badge">
          <span className="label">gif</span>
        </div>
      </div>

      <div className="output-actions">
        <button className="btn btn--primary output-dl-btn" onClick={download}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1V10M7 10L3 6M7 10L11 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/>
            <path d="M1 12H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/>
          </svg>
          download gif
        </button>

        <button className="btn btn--whatsapp" onClick={shareWhatsApp}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          share on whatsapp
        </button>
      </div>

      {shareError && (
        <p className="output-share-error label" style={{ color: 'var(--c-accent)' }}>
          {shareError}
        </p>
      )}

      {shareMessage && (
        <p className="output-share-message label" style={{ color: 'var(--c-muted)' }}>
          {shareMessage}
        </p>
      )}

      <button className="btn btn--ghost output-reset" onClick={onReset}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M14 8H2M2 8L7 3M2 8L7 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/>
        </svg>
        convert another video
      </button>
    </div>
  );
}
