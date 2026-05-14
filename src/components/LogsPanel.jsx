import { useEffect, useRef, useState } from 'react';
import './LogsPanel.css';

export default function LogsPanel({ logs }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(true);
  const bottomRef = useRef(null);
  const scrollRef = useRef(null);

  // Auto-scroll to bottom when new logs arrive, unless user scrolled up
  useEffect(() => {
    if (!open || !pinned) return;
    bottomRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [logs, open, pinned]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
    setPinned(atBottom);
  };

  const copyAll = () => {
    const text = logs.map((l) => `[${l.time}] [${l.type}] ${l.text}`).join('\n');
    navigator.clipboard?.writeText(text);
  };

  return (
    <div className={`logs-root ${open ? 'logs-root--open' : ''}`}>
      <button
        className="logs-toggle"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <span className="logs-toggle-arrow">{open ? '▼' : '▶'}</span>
        <span className="label">logs</span>
        <span className="logs-count label">{logs.length}</span>
        {logs.some((l) => l.type === 'error') && (
          <span className="logs-err-badge label">err</span>
        )}
      </button>

      {open && (
        <div className="logs-body">
          <div className="logs-toolbar">
            <span className="label logs-hint">{pinned ? 'auto-scroll on' : 'scrolled up'}</span>
            <button className="btn btn--ghost logs-copy" onClick={copyAll} type="button">
              copy all
            </button>
          </div>
          <div className="logs-scroll" ref={scrollRef} onScroll={onScroll}>
            {logs.length === 0 && (
              <div className="logs-empty label">no logs yet — start a conversion</div>
            )}
            {logs.map((entry, i) => (
              <div key={i} className={`log-line log-line--${entry.type}`}>
                <span className="log-time">{entry.time}</span>
                <span className="log-type">{entry.type}</span>
                <span className="log-text">{entry.text}</span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </div>
      )}
    </div>
  );
}
