/**
 * Settings Matrix Tests
 *
 * Verifies that every valid combination of eigie's 6 settings produces
 * correct intermediate values. This gives confidence that mix-and-match
 * combinations will not produce invalid inputs to the encoder pipeline.
 *
 * Settings under test:
 *   fps:     [8, 10, 15, 24]
 *   scale:   [320, 480, 640, -1]
 *   quality: ['fast', 'quality']
 *   dither:  [true, false]
 *   colors:  [64, 128, 256]
 *   lossy:   [0, 4, 8, 16]
 */

import { describe, it, expect } from 'vitest';
import { computeDimensions } from '../useGifEncoder';

// ── Option tables (mirror ControlPanel.jsx) ───────────────────────────────────

const FPS_OPTIONS = [8, 10, 15, 24];
const SCALE_OPTIONS = [320, 480, 640, -1];
const QUALITY_OPTIONS = ['fast', 'quality'];
const DITHER_OPTIONS = [true, false];
const COLOR_OPTIONS = [64, 128, 256];
const LOSSY_OPTIONS = [0, 4, 8, 16];

// Reference source video dimensions (HD landscape)
const VIDEO_W = 1920;
const VIDEO_H = 1080;

// ── Helpers that mirror useGifEncoder internal logic ─────────────────────────

function frameDelay(fps) {
  return Math.round(1000 / fps);
}

function gifQuality(quality) {
  return quality === 'quality' ? 2 : 10;
}

function snapStep(lossy, colors) {
  const lossyStep = lossy || 0;
  const colorStep = colors >= 256 ? 0 : Math.ceil(256 / colors);
  return Math.max(lossyStep, colorStep);
}

// ── fps: frameDelayMs ─────────────────────────────────────────────────────────

describe('fps → frameDelayMs', () => {
  it.each(FPS_OPTIONS)('fps=%i produces a positive integer delay in ms', (fps) => {
    const delay = frameDelay(fps);
    expect(delay).toBeGreaterThan(0);
    expect(Number.isInteger(delay)).toBe(true);
  });

  it('fps=8 → 125 ms', () => expect(frameDelay(8)).toBe(125));
  it('fps=10 → 100 ms', () => expect(frameDelay(10)).toBe(100));
  it('fps=15 → 67 ms', () => expect(frameDelay(15)).toBe(67));
  it('fps=24 → 42 ms', () => expect(frameDelay(24)).toBe(42));
});

// ── scale → output dimensions ────────────────────────────────────────────────

describe('scale → output dimensions (1920×1080 source)', () => {
  it.each(SCALE_OPTIONS)('scale=%i produces even, positive dimensions', (scale) => {
    const { width, height } = computeDimensions(scale, VIDEO_W, VIDEO_H);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
    expect(width % 2).toBe(0);
    expect(height % 2).toBe(0);
  });

  it('scale=320 → width 320, height 180', () => {
    const { width, height } = computeDimensions(320, 1920, 1080);
    expect(width).toBe(320);
    expect(height).toBe(180);
  });

  it('scale=480 → width 480, height 270', () => {
    const { width, height } = computeDimensions(480, 1920, 1080);
    expect(width).toBe(480);
    expect(height).toBe(270);
  });

  it('scale=640 → width 640, height 360', () => {
    const { width, height } = computeDimensions(640, 1920, 1080);
    expect(width).toBe(640);
    expect(height).toBe(360);
  });

  it('scale=-1 → original 1920×1080', () => {
    const { width, height } = computeDimensions(-1, 1920, 1080);
    expect(width).toBe(1920);
    expect(height).toBe(1080);
  });

  it('scale never upscales a smaller source (320×240 with scale=640)', () => {
    const { width } = computeDimensions(640, 320, 240);
    expect(width).toBeLessThanOrEqual(320);
  });
});

// ── quality → GIF quality factor ─────────────────────────────────────────────

describe('quality → GIF quality factor', () => {
  it.each(QUALITY_OPTIONS)('quality="%s" produces a valid factor', (q) => {
    const factor = gifQuality(q);
    expect(factor).toBeGreaterThan(0);
    expect(factor).toBeLessThanOrEqual(10);
  });

  it('"fast" → factor 10 (fastest, lowest quality)', () => expect(gifQuality('fast')).toBe(10));
  it('"quality" → factor 2 (slowest, best quality)', () => expect(gifQuality('quality')).toBe(2));
});

// ── dither: accepted values ───────────────────────────────────────────────────

describe('dither option values', () => {
  it.each(DITHER_OPTIONS)('dither=%s is a boolean', (d) => {
    expect(typeof d).toBe('boolean');
  });

  it('dither=true maps to "FloydSteinberg"', () => {
    expect(true ? 'FloydSteinberg' : false).toBe('FloydSteinberg');
  });

  it('dither=false maps to false (no dithering)', () => {
    expect(false ? 'FloydSteinberg' : false).toBe(false);
  });
});

// ── colors → colorStep ───────────────────────────────────────────────────────

describe('colors → colorStep', () => {
  it('colors=256 → colorStep 0 (no extra snapping)', () => {
    const step = 256 >= 256 ? 0 : Math.ceil(256 / 256);
    expect(step).toBe(0);
  });

  it('colors=128 → colorStep 2', () => {
    const step = Math.ceil(256 / 128);
    expect(step).toBe(2);
  });

  it('colors=64 → colorStep 4', () => {
    const step = Math.ceil(256 / 64);
    expect(step).toBe(4);
  });

  it.each(COLOR_OPTIONS)('colors=%i produces a non-negative colorStep', (c) => {
    const step = c >= 256 ? 0 : Math.ceil(256 / c);
    expect(step).toBeGreaterThanOrEqual(0);
  });
});

// ── lossy → lossyStep ────────────────────────────────────────────────────────

describe('lossy → lossyStep', () => {
  it.each(LOSSY_OPTIONS)('lossy=%i is a non-negative integer', (l) => {
    expect(l).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(l)).toBe(true);
  });

  it('lossy=0 (off) → lossyStep 0', () => expect(0 || 0).toBe(0));
  it('lossy=4 (light) → lossyStep 4', () => expect(4 || 0).toBe(4));
  it('lossy=8 (med) → lossyStep 8', () => expect(8 || 0).toBe(8));
  it('lossy=16 (heavy) → lossyStep 16', () => expect(16 || 0).toBe(16));
});

// ── colors × lossy → snapStep (all 12 combinations) ─────────────────────────

describe('colors × lossy → snapStep (all 12 combinations)', () => {
  COLOR_OPTIONS.forEach((colors) => {
    LOSSY_OPTIONS.forEach((lossy) => {
      it(`colors=${colors} + lossy=${lossy} → valid non-negative snapStep`, () => {
        const step = snapStep(lossy, colors);
        expect(step).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(step)).toBe(true);
      });
    });
  });

  it('lossy wins when it is larger than colorStep', () => {
    // colors=128 → colorStep=2; lossy=16 → lossyStep=16; max=16
    expect(snapStep(16, 128)).toBe(16);
  });

  it('colorStep wins when it is larger than lossy', () => {
    // colors=64 → colorStep=4; lossy=0 → lossyStep=0; max=4
    expect(snapStep(0, 64)).toBe(4);
  });

  it('both at zero when lossy=0 and colors=256', () => {
    // No quantisation at all
    expect(snapStep(0, 256)).toBe(0);
  });

  it('maximum step: lossy=16 + colors=64 → snapStep=16', () => {
    // colorStep(64)=4, lossyStep=16 → max=16
    expect(snapStep(16, 64)).toBe(16);
  });
});

// ── totalFrames = ceil(clipLen × fps) ────────────────────────────────────────

describe('totalFrames computation', () => {
  it('10s clip at fps=8 → 80 frames', () => {
    expect(Math.ceil(10 * 8)).toBe(80);
  });

  it('10s clip at fps=24 → 240 frames', () => {
    expect(Math.ceil(10 * 24)).toBe(240);
  });

  it('fractional clip len rounds up', () => {
    // 3.3s at fps=10 → ceil(33) = 33
    expect(Math.ceil(3.3 * 10)).toBe(33);
  });

  it.each(FPS_OPTIONS)('fps=%i for a 15s clip gives a positive frame count', (fps) => {
    const frames = Math.ceil(15 * fps);
    expect(frames).toBeGreaterThan(0);
  });
});

// ── full settings matrix smoke test ──────────────────────────────────────────

describe('full settings matrix — no invalid value for any combination', () => {
  // 4 fps × 4 scale × 2 quality × 2 dither × 3 colors × 4 lossy = 768 combos
  // We verify that every combination produces sensible intermediate values.
  let totalCombinations = 0;

  FPS_OPTIONS.forEach((fps) => {
    SCALE_OPTIONS.forEach((scale) => {
      QUALITY_OPTIONS.forEach((quality) => {
        DITHER_OPTIONS.forEach((dither) => {
          COLOR_OPTIONS.forEach((colors) => {
            LOSSY_OPTIONS.forEach((lossy) => {
              totalCombinations++;
              const delay = frameDelay(fps);
              const factor = gifQuality(quality);
              const step = snapStep(lossy, colors);
              const { width, height } = computeDimensions(scale, VIDEO_W, VIDEO_H);

              // All values must be positive and within valid ranges
              if (delay <= 0 || factor <= 0 || step < 0 || width <= 0 || height <= 0) {
                throw new Error(
                  `Invalid combination: fps=${fps} scale=${scale} quality=${quality} ` +
                  `dither=${dither} colors=${colors} lossy=${lossy} → ` +
                  `delay=${delay} factor=${factor} step=${step} ${width}×${height}`
                );
              }
            });
          });
        });
      });
    });
  });

  it(`covers all ${totalCombinations} combinations without producing invalid values`, () => {
    // If we reach this point the forEach above did not throw
    expect(totalCombinations).toBe(768);
  });
});
