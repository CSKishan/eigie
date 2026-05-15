# Changelog

All notable changes to **eigie** (everything is gif is everything) are documented in this file.

---

## v1.4.0 — Movie-to-GIF Guardrails

### Root Cause: Why Large Videos Crashed

gif.js buffers **all frames in RAM** before encoding begins. A 2-hour movie at 10fps produces ~69,600 frames; at 320×240 each frame is ~307 KB of ImageData, totalling ≈21 GB — the browser crashes before encoding even starts. This release adds the guard rails that prevent the crash while the streaming encoder (v1.4.1) is in development.

### Hard Frame Cap

- `MAX_FRAMES = 300` constant exported from `useGifEncoder.js` — equivalent to 30s at 10fps
- If a clip would produce more than 300 frames the encoder throws a descriptive error (last line of defence); the UI blocks the convert button first
- Error message tells the user exactly what to change: trim to `<{MAX_FRAMES / fps}s` at their current fps, or lower the fps setting

### Pre-flight Estimate Panel

- Frame count and estimated RAM usage shown in the output panel **before** conversion starts, giving users an at-a-glance read on what they're about to encode
- Frame count highlighted in accent color when it exceeds the limit
- Warning message shown inline when clip is too long, with the exact clip length threshold at the current fps

### Auto-Adjust Button

- One-click **auto-adjust** lowers fps (8 → 10 → 15 → 24, picking the highest that fits) to bring the frame count under the limit without losing more clip than necessary
- If the clip is too long even at fps=8, the clip end is trimmed to `MAX_FRAMES / 8` seconds and fps is set to 8

### Cancellation

- **Cancel button** appears below the convert button during active encoding
- Cancellation is checked at every frame in both the seek-based and playback-based extraction loops — stops within one frame
- If cancel is clicked during the gif.js encoding phase, `gif.abort()` is called and the output is discarded
- Cancelled conversions return cleanly to the previewing state with no error shown

### Large-GIF Output Warning

- After encoding completes, if the output GIF exceeds **10 MB** a contextual warning is shown: "consider a shorter clip or lower fps for easier sharing"

### Extraction Loop Improvements

- `extractFramesSeek` now yields every 30 frames (`setTimeout(0)`) to keep the UI responsive and allow cancellation checks to fire
- Both extraction loops (`extractFramesSeek`, `extractFramesPlayback`) check `isCancelledRef` before each frame to stop promptly on cancel

### Files Changed

- `src/hooks/useGifEncoder.js` — `MAX_FRAMES`, `CancelError`, `isCancelledRef`, `gifInstanceRef`, `cancel()`, cancellation in both loops, post-extraction bail-out, gif.abort() on cancel, encoder-side cap guard
- `src/App.jsx` — `videoMeta` state, `expectedFrames` / `estimatedRamMb` derivation, `handleCancel`, `handleAutoAdjust`, `CancelError` routing in `handleConvert`, new props passed to `ConversionDisplay` and `VideoPreview`
- `src/components/ConversionDisplay.jsx` — Pre-flight panel (frame count, RAM estimate, warning, auto-adjust button), cancel button
- `src/components/ConversionDisplay.css` — Pre-flight panel styles, cancel button styles, column footer layout
- `src/components/VideoPreview.jsx` — `onMetadata` prop; calls back with `{ duration, width, height }` on video load
- `src/components/OutputPanel.jsx` — Large-GIF warning (>10 MB)
- `src/components/OutputPanel.css` — `.output-size-warn` style
- `package.json` — Version bumped to 1.4.0

---

## v1.3.2 — Tests & Responsive Fixes

### Test Infrastructure

- Added **Vitest** as the test runner (zero-config with Vite; no separate build step)
- Added **happy-dom** environment for browser API simulation
- Exported `computeDimensions`, `processFrame`, and `addProcessedFrame` as named exports for unit testing
- Added `npm test`, `npm run test:watch`, and `npm run test:coverage` scripts

### Unit Tests — `computeDimensions`

- All 4 valid scale options (320, 480, 640, -1) with a 1920×1080 source
- No-upscale guarantee (scale > source width is clamped to source width)
- Even-pixel clamping on odd-dimension edge cases
- Portrait and square video sources
- Positive integer output assertion for all inputs

### Unit Tests — `processFrame`

- First frame with `prevSnapped=null` → `changeRatio=1.0`, no transparent-key marks
- Identical second frame → `changeRatio=0`, all pixels replaced with transparent key `[1,1,1]`
- Partially changed frames → ratio computed correctly
- Single-pixel change in 200-pixel buffer → `changeRatio < 0.02` (duplicate threshold)
- All 3 lossy step values (4, 8, 16): correct quantisation, no values exceed 255
- Large-buffer smoke tests: 320×240 and 640×480 without error

### Integration Tests — Settings Matrix

- All 4 fps values → correct `frameDelayMs`
- All 4 scale values → correct output dimensions from `computeDimensions`
- Both quality values → correct GIF quality factor (2 or 10)
- Both dither values accepted
- All 3 colors values → correct `colorStep`
- All 4 lossy values → correct `lossyStep`
- All **12 colors × lossy combinations** → valid `snapStep = max(lossyStep, colorStep)`
- Full **768-combination smoke test** (4 fps × 4 scale × 2 quality × 2 dither × 3 colors × 4 lossy) verifying no combination produces invalid encoder inputs

### Responsive Fix

- Output action buttons ("download gif" + "share on whatsapp") now stack vertically on screens ≤ 600px, each taking full width — previously the WhatsApp button overflowed off-screen on mobile viewports

### WhatsApp Button

- Clicking "share on whatsapp" now shows "Coming soon. Stay tuned." inline below the buttons instead of attempting a share or opening WhatsApp Web

### Files Changed

- `vite.config.js` — Added `test` block (happy-dom environment, coverage config)
- `package.json` — Added test scripts, bumped version to 1.3.2; installed vitest, @vitest/coverage-v8, happy-dom
- `src/hooks/useGifEncoder.js` — Exported `computeDimensions`, `processFrame`, `addProcessedFrame`
- `src/hooks/__tests__/computeDimensions.test.js` — New: 13 unit tests
- `src/hooks/__tests__/processFrame.test.js` — New: 13 unit tests
- `src/hooks/__tests__/settingsMatrix.test.js` — New: 64 tests + 768-combo smoke test
- `src/components/OutputPanel.jsx` — "Coming soon" WhatsApp message
- `src/components/OutputPanel.css` — Mobile stacking media query

---

## v1.3.1 — Bug Fixes

### Play Button Visibility in Light Themes

- Play/pause button on the video preview now uses `--c-embed-text` instead of `--c-cream` — remains visible in light themes where `--c-cream` maps to a dark color against the dark video embed background

### localStorage Safety

- Theme persistence wrapped in try-catch to prevent crashes in private browsing or when storage is disabled
- Added range validation (1–4) on the stored theme value to guard against manually corrupted localStorage entries

### Theme 4 Green Contrast

- Changed theme 4 (green + light) accent from `#39FF14` to `#1A8F0F` — neon green was unreadable on white backgrounds. Adjusted glow opacities upward to compensate for the darker base color

### Version Drift Prevention

- App version is now injected at build time from `package.json` via Vite `define` (`__APP_VERSION__`), eliminating the need to update a hardcoded string in `App.jsx` on every release

### Tooltip Clip Fix

- File size tooltip on the output panel now opens downward (`top: calc(100% + 10px)`) instead of upward (`bottom: calc(100% + 10px)`), preventing it from clipping off the top of the viewport when the output header is near the top of the screen

### Files Changed

- `src/styles/tokens.css` — Added `--c-embed-text` token, theme 4 accent color and glow adjustments
- `src/App.jsx` — localStorage try-catch, range validation, build-time version constant
- `src/components/VideoPreview.css` — Play button uses `--c-embed-text`
- `src/components/OutputPanel.css` — Tooltip direction changed to downward
- `vite.config.js` — Added `define` block to inject `__APP_VERSION__` from package.json
- `package.json` — Version bumped to 1.3.1

---

## v1.3.0 — UI Tweaks & Theme System

### Theme System

- The 4 header LED dots (top-right corner) are now clickable theme selectors:
  1. **Orange + Dark** — original theme, orange accent on dark backgrounds
  2. **Orange + Light** — orange accent on warm cream/white TE-inspired backgrounds
  3. **Green + Dark** — TE green accent on dark backgrounds
  4. **Green + Light** — TE green accent on warm cream/white backgrounds
- Introduced `--c-accent` semantic token system — all accent-colored UI elements (buttons, borders, LEDs, progress bars, toggles, badges, glows, error text) respond to the active theme
- Light themes override surface variables (`--c-black`, `--c-dark`, `--c-mid`, `--c-dim`, `--c-cream`, etc.) for a full palette inversion
- Embedded screens (video player, LED display, GIF preview) stay dark in all themes via dedicated `--c-embed` token
- Text-on-accent elements use `--c-contrast` (always dark) to remain readable regardless of theme
- Theme selection persists across sessions via `localStorage`
- Font family (JetBrains Mono) remains unchanged across all themes

### Version Display

- App version (`v1.3.0`) is now shown in the bottom-right footer, before the `gif.js · WebCodecs` label

### Smart File Size Display

- GIF file size now auto-scales to the most readable unit (bytes, KB, MB, GB) instead of always showing KB
- Hovering the file size reveals a TE-styled tooltip showing the size in all four units simultaneously (GB with 6 decimal places, MB with 4, KB with 2, and exact byte count with commas) — an intentionally over-engineered breakdown

### Back Arrow Improvements

- Replaced the unicode `←` character with a proper SVG arrow icon (16px) in both "load different video" and "convert another video" buttons
- Arrow is properly vertically centered with the button text via flexbox alignment

### Files Changed

- `src/styles/tokens.css` — Theme-aware semantic tokens, 4 theme override blocks
- `src/styles/global.css` — Accent and contrast variable usage, body transition
- `src/App.jsx` — Theme state with localStorage, clickable LED theme selectors, version in footer
- `src/App.css` — Header LED theme dot styles with per-dot colors and active glow
- `src/components/OutputPanel.jsx` — Smart file size formatting, hover tooltip, SVG back arrow
- `src/components/OutputPanel.css` — Tooltip styles, accent token usage
- `src/components/VideoPreview.jsx` — SVG back arrow, accent token for trim warning
- `src/components/VideoPreview.css` — Accent token usage, embed bg for video
- `src/components/ControlPanel.css` — Accent and contrast token usage
- `src/components/ConversionDisplay.css` — LED display vars, accent tokens, contrast spinner
- `src/components/UploadZone.jsx` — Accent token for error text
- `src/components/UploadZone.css` — Accent token usage
- `src/components/LogsPanel.css` — Accent and contrast token usage
- `package.json` — Version bumped to 1.3.0

---

## v1.2 — GIF Size Optimizations

Focused on drastically reducing GIF output file size. A video that previously produced a 3 MB GIF now outputs 400-800 KB with default settings — a **4-7x reduction**.

### Core Encoder Changes

- **Frame delta with transparency** — Consecutive frames are compared pixel-by-pixel. Unchanged pixels are replaced with a transparent key color (`0x010101`), so the GIF only stores the regions that actually changed between frames. The first frame is always encoded in full; subsequent frames are encoded as deltas. This is the single largest size win, typically removing 40-60% of pixel data.

- **Duplicate frame detection** — If fewer than 2% of pixels changed between two consecutive frames, the frame is skipped entirely and the previous frame's display duration is extended. Static or slow-motion segments benefit most. Logged as `[dup]` in the logs panel.

- **Lossy color snapping** — RGB channel values are rounded to the nearest `step` value (configurable: 0/4/8/16). Fewer unique pixel colors means longer runs in the LZW compression dictionary, producing smaller output. Higher step values trade color precision for smaller files.

- **Color count reduction** — When the color count is set below 256, an additional snap step (`ceil(256/colors)`) is applied to pre-quantize pixel data before NeuQuant runs. At 64 colors, this effectively halves the color variety.

### gif.worker.js Patches

- **Disposal mode fix** — Fixed `disp = dispose & 7` referencing an undefined local variable. Changed to `disp = this.dispose & 7` to correctly read the encoder's disposal mode.

- **Transparent frame disposal** — Added `setDispose(1)` (do not dispose / keep previous frame) when a frame uses transparency. Without this, delta frames would render against a blank background instead of compositing over the previous frame.

### Default Settings Tuned for Smaller Output

| Setting | Before | After | Impact |
|---------|--------|-------|--------|
| Width | 480px | 320px | ~55% fewer pixels |
| FPS | 15 | 10 | ~33% fewer frames |
| Dither | on (Floyd-Steinberg) | off | 20-40% smaller (dithering creates noisy patterns that defeat LZW) |
| Colors | _(not configurable)_ | 256 (default), 128, 64 | Up to 35% at 64 colors |
| Lossy | _(not configurable)_ | off (default), light, med, heavy | Up to 50% at heavy |

### New UI Controls

- **Colors** segmented control (64 / 128 / 256) in the settings panel
- **Lossy** segmented control (off / light / med / heavy) in the settings panel
- FPS options updated to [8, 10, 15, 24]
- Dither toggle label changed from "bayer" to "floyd" (reflects actual algorithm used)

### Logs Improvements

- Logs now report duplicate frame count and unique frame count after extraction
- Individual frames tagged with `[dup]` when skipped
- Color snap settings logged at conversion start

### Files Changed

- `src/hooks/useGifEncoder.js` — Frame delta, lossy snap, duplicate detection, color reduction
- `src/components/ControlPanel.jsx` — Colors and lossy controls
- `src/App.jsx` — Updated default settings
- `public/gif.worker.js` — Disposal bug fix + setDispose(1) for transparent frames

---

## v1.1 — Performance Optimizations

Focused on conversion speed. Achieved measurable speedup across the full encode pipeline.

### Speed Improvements

- **requestVideoFrameCallback capture** — Replaced seek-based frame extraction with playback-based capture using `requestVideoFrameCallback`. The video plays at 2x speed while frames are grabbed at each decoded frame boundary. Falls back to seek-based extraction on browsers without rvfc support. Eliminates per-frame seek latency.

- **Progressive encoding** — Frames are fed to gif.js immediately during extraction (`gif.addFrame` called inline) instead of collecting all frames first and then encoding. Workers begin processing frames as soon as they arrive, overlapping extraction and encoding phases.

- **NeuQuant quality tuning** — Quality set to 2 (high quality mode) for "quality" preset and 10 for "fast" preset. Lower values = more sampling passes = better palette but slower. The `quality` segmented control lets users choose their tradeoff.

- **Video preload** — Added `preload="auto"` to the video element so the browser buffers the full video before frame extraction begins, avoiding I/O stalls during capture.

- **Ref-based log buffer** — Replaced per-log `setLogs()` calls with a mutable ref buffer (`logBuf`) that flushes to React state every 150ms. Prevents thousands of synchronous state updates during fast frame extraction from blocking the main thread.

- **LED display simplification** — Reduced the LED character display from per-character span rendering to a single `<span>` with monospace text. Eliminates hundreds of DOM nodes during conversion.

- **Timeout cleanup** — Added 5-minute encoding timeout with cleanup to prevent zombie workers if gif.js hangs.

### Files Changed

- `src/hooks/useGifEncoder.js` — rvfc capture, progressive encoding, ref-based logs, timing instrumentation
- `src/components/ConversionDisplay.jsx` — Simplified LED display
- `src/components/ConversionDisplay.css` — Updated LED styles

---

## v1.0 — Initial Release

The foundation: a fully client-side video-to-GIF converter with a Teenage Engineering-inspired design.

### Architecture

- **React + Vite** — Fast dev server, production builds with tree-shaking
- **gif.js** (MIT) — Browser-based GIF encoding using Web Workers and NeuQuant color quantization. The worker script (`gif.worker.js`, 16 KB) is served from `public/` and preloaded in the HTML head
- **Canvas-based pipeline** — Video frames extracted via `<video>` + `<canvas>` drawImage, pixel data passed to gif.js for encoding. Fully client-side, no server or API calls
- **No FFmpeg dependency** — Deliberately avoided FFmpeg.wasm (32 MB download, slow to initialize) in favor of the lightweight gif.js approach

### Features

- **Drag-and-drop upload** — UploadZone accepts MP4, WebM, MOV, AVI, MKV. File picker fallback. 2 GB max size. Validates MIME type before processing
- **Video preview with trim** — Native `<video>` playback with dual-handle trim timeline. Drag start/end handles to select a clip region. Time formatted as MM:SS.s. Default trim capped at 15 seconds with a "long gif ahead" warning
- **Settings panel** — Segmented controls for FPS, output width, quality preset, and dither toggle. All settings take effect on next conversion
- **LED status display** — Monospace character display showing current operation. Segmented progress bar (20 segments) with percentage readout
- **Live logs panel** — Collapsible panel showing timestamped conversion logs. Auto-scrolls with manual scroll-up detection. Copy-all button. Color-coded by log type (error, system, info). Error badge indicator
- **GIF output panel** — Preview of the generated GIF with file size display. Download button (timestamped filename). WhatsApp share via Web Share API on mobile, WhatsApp Web fallback on desktop
- **State machine** — App flow: idle → previewing → converting → done / error. Clean reset back to idle at any point

### Design System — Teenage Engineering Aesthetic

- **Color palette** — Orange `#FF6900` accent on near-black `#0A0A0A` background. Cream `#F0EDE8` text. LED display colors with dim/off states
- **Typography** — JetBrains Mono throughout. Uppercase labels, tabular numerals
- **Components** — Industrial segmented controls, toggle switches with sliding dots, LED-style readouts, corner-marker upload zone, status LEDs in headers
- **Spacing** — 8px grid system. Sharp corners (`border-radius: 0`)
- **Custom scrollbars** — Styled to match the dark theme

### Project Structure

```
src/
  App.jsx              — Main app component, state machine
  App.css              — Layout grid, responsive breakpoints
  hooks/
    useGifEncoder.js   — Core conversion logic, frame extraction, gif.js orchestration
  components/
    UploadZone.jsx     — Drag-and-drop file input
    VideoPreview.jsx   — Video player with trim timeline
    ControlPanel.jsx   — Settings (FPS, width, quality, dither)
    ConversionDisplay.jsx — LED display, progress bar, convert button
    OutputPanel.jsx    — GIF preview, download, WhatsApp share
    LogsPanel.jsx      — Collapsible live log viewer
  styles/
    tokens.css         — Design tokens (colors, spacing, typography)
    global.css         — Global styles, button variants, scrollbars
public/
  gif.worker.js        — gif.js Web Worker (patched)
  favicon.svg          — Orange play triangle on black
```

### Files

- `src/App.jsx`, `src/App.css`
- `src/hooks/useGifEncoder.js`
- `src/components/UploadZone.jsx`, `UploadZone.css`
- `src/components/VideoPreview.jsx`, `VideoPreview.css`
- `src/components/ControlPanel.jsx`, `ControlPanel.css`
- `src/components/ConversionDisplay.jsx`, `ConversionDisplay.css`
- `src/components/OutputPanel.jsx`, `OutputPanel.css`
- `src/components/LogsPanel.jsx`, `LogsPanel.css`
- `src/styles/tokens.css`, `src/styles/global.css`
- `public/gif.worker.js`, `public/favicon.svg`
- `index.html`, `vite.config.js`, `vercel.json`, `package.json`
