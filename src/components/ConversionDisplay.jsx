import './ConversionDisplay.css';

function LEDDisplay({ text, maxLen = 28 }) {
  const padded = text.slice(0, maxLen).padEnd(maxLen, ' ');
  return (
    <div className="led-display" aria-label={text}>
      <span className="led-text">{padded}</span>
    </div>
  );
}

function ProgressBar({ value }) {
  const segments = 20;
  const filled = Math.round((value / 100) * segments);
  return (
    <div className="prog-bar" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      {Array.from({ length: segments }, (_, i) => (
        <div key={i} className={`prog-seg ${i < filled ? 'prog-seg--on' : ''}`} />
      ))}
      <span className="prog-pct">{String(value).padStart(3, ' ')}%</span>
    </div>
  );
}

export default function ConversionDisplay({ status, progress, log, onConvert, canConvert }) {
  const isConverting = status === 'converting';
  const isDone = status === 'done';
  const isError = status === 'error';

  const displayText = isConverting
    ? log.slice(0, 28)
    : isDone
    ? 'conversion complete'
    : isError
    ? 'error — see below'
    : 'ready to convert';

  return (
    <div className="conv-root panel">
      <div className="conv-header">
        <span className="label">output</span>
        <div className="conv-status-row">
          <span className={`conv-status-dot ${isConverting ? 'conv-status-dot--active' : isDone ? 'conv-status-dot--done' : ''}`} />
          <span className="label conv-status-label">
            {isConverting ? 'processing' : isDone ? 'done' : isError ? 'error' : 'idle'}
          </span>
        </div>
      </div>
      <hr className="divider" />

      <div className="conv-body">
        <LEDDisplay text={displayText} />
        <ProgressBar value={isConverting ? progress : isDone ? 100 : 0} />
      </div>

      <hr className="divider" />
      <div className="conv-footer">
        <button
          className="btn btn--primary conv-btn"
          onClick={onConvert}
          disabled={!canConvert || isConverting}
        >
          {isConverting ? (
            <>
              <span className="conv-spinner" />
              converting...
            </>
          ) : (
            'convert to gif'
          )}
        </button>
      </div>
    </div>
  );
}
