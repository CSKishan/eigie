import './ControlPanel.css';

const FPS_OPTIONS = [8, 10, 15, 24];
const SCALE_OPTIONS = [
  { label: '320px', value: 320 },
  { label: '480px', value: 480 },
  { label: '640px', value: 640 },
  { label: 'orig', value: -1 },
];
const QUALITY_OPTIONS = [
  { label: 'fast', value: 'fast' },
  { label: 'quality', value: 'quality' },
];
const COLOR_OPTIONS = [
  { label: '64', value: 64 },
  { label: '128', value: 128 },
  { label: '256', value: 256 },
];
const LOSSY_OPTIONS = [
  { label: 'off', value: 0 },
  { label: 'light', value: 4 },
  { label: 'med', value: 8 },
  { label: 'heavy', value: 16 },
];
const ENCODER_OPTIONS = [
  { label: 'standard', value: 'standard', title: 'gifenc — streams frames, works on any file size' },
  { label: 'hd', value: 'hd', title: 'FFmpeg palettegen — optimal palette, file ≤ 200 MB' },
];

/**
 * @param {function|null} isOptionDisabled  - receives raw option object, returns bool
 */
function SegmentedControl({ label, options, value, onChange, getLabel, getValue, isOptionDisabled }) {
  return (
    <div className="ctrl-block">
      <span className="label">{label}</span>
      <div className="ctrl-segments">
        {options.map((opt) => {
          const v = getValue ? getValue(opt) : opt;
          const l = getLabel ? getLabel(opt) : opt;
          const active = v === value;
          const disabled = isOptionDisabled ? isOptionDisabled(opt) : false;
          return (
            <button
              key={v}
              className={`ctrl-seg${active ? ' ctrl-seg--active' : ''}${disabled ? ' ctrl-seg--disabled' : ''}`}
              onClick={() => !disabled && onChange(v)}
              disabled={disabled}
              title={opt.title ?? undefined}
              type="button"
            >
              {l}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function ControlPanel({ settings, onChange, canUseHD }) {
  return (
    <div className="ctrl-root panel">
      <div className="ctrl-header">
        <span className="label">settings</span>
        <div className="ctrl-led-row">
          <span className="ctrl-led ctrl-led--on" />
          <span className="ctrl-led" />
          <span className="ctrl-led" />
        </div>
      </div>
      <hr className="divider" />

      <div className="ctrl-body">
        <SegmentedControl
          label="fps"
          options={FPS_OPTIONS}
          value={settings.fps}
          onChange={(v) => onChange({ ...settings, fps: v })}
        />

        <SegmentedControl
          label="width"
          options={SCALE_OPTIONS}
          value={settings.scale}
          onChange={(v) => onChange({ ...settings, scale: v })}
          getLabel={(o) => o.label}
          getValue={(o) => o.value}
        />

        <SegmentedControl
          label="quality"
          options={QUALITY_OPTIONS}
          value={settings.quality}
          onChange={(v) => onChange({ ...settings, quality: v })}
          getLabel={(o) => o.label}
          getValue={(o) => o.value}
        />

        <SegmentedControl
          label="colors"
          options={COLOR_OPTIONS}
          value={settings.colors}
          onChange={(v) => onChange({ ...settings, colors: v })}
          getLabel={(o) => o.label}
          getValue={(o) => o.value}
        />

        <SegmentedControl
          label="lossy"
          options={LOSSY_OPTIONS}
          value={settings.lossy}
          onChange={(v) => onChange({ ...settings, lossy: v })}
          getLabel={(o) => o.label}
          getValue={(o) => o.value}
        />

        <div className="ctrl-block">
          <span className="label">dither</span>
          <button
            className={`ctrl-toggle ${settings.dither ? 'ctrl-toggle--on' : ''}`}
            onClick={() => onChange({ ...settings, dither: !settings.dither })}
            type="button"
          >
            <span className="ctrl-toggle-dot" />
            <span className="ctrl-toggle-label">{settings.dither ? 'floyd' : 'off'}</span>
          </button>
        </div>

        <SegmentedControl
          label="encoder"
          options={ENCODER_OPTIONS}
          value={settings.encoder}
          onChange={(v) => onChange({ ...settings, encoder: v })}
          getLabel={(o) => o.label}
          getValue={(o) => o.value}
          isOptionDisabled={(o) => o.value === 'hd' && !canUseHD}
        />
      </div>
    </div>
  );
}
