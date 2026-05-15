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

export default function ConversionDisplay({
  status, progress, log, ffmpegPhase,
  onConvert, onCancel, onAutoAdjust, canConvert,
  expectedFrames, estimatedRamMb, tooManyFrames, maxFrames, fps,
}) {
  const isConverting = status === 'converting';
  const isDone = status === 'done';
  const isError = status === 'error';
  const showPreflight = expectedFrames > 0 && !isConverting && !isDone;

  let displayText;
  if (isConverting) {
    if (ffmpegPhase === 'loading') displayText = 'loading HD encoder…';
    else if (ffmpegPhase === 'encoding') displayText = log.slice(0, 28) || 'encoding…';
    else displayText = log.slice(0, 28);
  } else if (isDone) {
    displayText = 'conversion complete';
  } else if (isError) {
    displayText = 'error — see below';
  } else if (tooManyFrames) {
    displayText = 'clip too long';
  } else {
    displayText = 'ready to convert';
  }

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

        {showPreflight && (
          <div className="conv-preflight">
            <div className="conv-preflight-row">
              <span className="label conv-preflight-key">frames</span>
              <span className={`conv-preflight-val${tooManyFrames ? ' conv-preflight-val--warn' : ''}`}>
                {expectedFrames}
              </span>
              <span className="label conv-preflight-key">est. ram</span>
              <span className="conv-preflight-val">{estimatedRamMb} mb</span>
            </div>
            {tooManyFrames && (
              <>
                <p className="label conv-preflight-warn">
                  limit is {maxFrames} frames — trim clip to under {Math.ceil(maxFrames / fps)}s
                  at {fps}fps, or lower the fps setting
                </p>
                <button className="btn btn--ghost conv-adjust-btn" onClick={onAutoAdjust}>
                  auto-adjust ↓
                </button>
              </>
            )}
          </div>
        )}
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
        {isConverting && (
          <button className="btn btn--ghost conv-cancel-btn" onClick={onCancel}>
            cancel
          </button>
        )}
      </div>
    </div>
  );
}
