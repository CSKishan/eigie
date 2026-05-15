import { describe, it, expect } from 'vitest';
import { computeDimensions } from '../useGifEncoder';

describe('computeDimensions', () => {
  // ── scale = -1 (original) ─────────────────────────────────────────────
  describe('scale = -1 (original dimensions)', () => {
    it('returns source dimensions unchanged for 1920×1080', () => {
      expect(computeDimensions(-1, 1920, 1080)).toEqual({ width: 1920, height: 1080 });
    });

    it('returns source dimensions unchanged for 320×240', () => {
      expect(computeDimensions(-1, 320, 240)).toEqual({ width: 320, height: 240 });
    });

    it('returns source dimensions unchanged for portrait 480×640', () => {
      expect(computeDimensions(-1, 480, 640)).toEqual({ width: 480, height: 640 });
    });
  });

  // ── scale smaller than source (normal shrink case) ────────────────────
  describe('scale smaller than source', () => {
    it('constrains 1920×1080 to 320px wide, preserving aspect ratio', () => {
      const { width, height } = computeDimensions(320, 1920, 1080);
      expect(width).toBe(320);
      // height = round(320 * (1080/1920)) = round(180) = 180
      expect(height).toBe(180);
    });

    it('constrains 1920×1080 to 480px wide', () => {
      const { width, height } = computeDimensions(480, 1920, 1080);
      expect(width).toBe(480);
      expect(height).toBe(270);
    });

    it('constrains 1920×1080 to 640px wide', () => {
      const { width, height } = computeDimensions(640, 1920, 1080);
      expect(width).toBe(640);
      expect(height).toBe(360);
    });
  });

  // ── scale larger than source (no upscaling) ───────────────────────────
  describe('scale larger than source (no upscale)', () => {
    it('does not upscale a 320×240 source when scale=480', () => {
      const { width, height } = computeDimensions(480, 320, 240);
      expect(width).toBe(320);
      expect(height).toBe(240);
    });

    it('does not upscale a 320×240 source when scale=640', () => {
      const { width } = computeDimensions(640, 320, 240);
      expect(width).toBe(320);
    });
  });

  // ── even-pixel clamping ───────────────────────────────────────────────
  describe('even-pixel clamping (codec compatibility)', () => {
    it('forces odd width down to even', () => {
      // 321px scale with 640×480 → width = min(321, 640) = 321, which is odd → 320
      const { width } = computeDimensions(321, 640, 480);
      expect(width % 2).toBe(0);
    });

    it('forces odd height down to even', () => {
      // 320 width on a 640×481 source → height = round(320 * 481/640) = round(240.5) = 241 (odd) → 240
      const { height } = computeDimensions(320, 640, 481);
      expect(height % 2).toBe(0);
    });

    it('returns even dimensions for all standard scale options on 1920×1080', () => {
      [320, 480, 640].forEach((scale) => {
        const { width, height } = computeDimensions(scale, 1920, 1080);
        expect(width % 2).toBe(0);
        expect(height % 2).toBe(0);
      });
    });
  });

  // ── portrait video ────────────────────────────────────────────────────
  describe('portrait video', () => {
    it('constrains 480×640 to 320px wide with correct portrait ratio', () => {
      const { width, height } = computeDimensions(320, 480, 640);
      expect(width).toBe(320);
      // height = round(320 * (640/480)) = round(426.67) = 427 → even → 426
      expect(height).toBe(426);
    });
  });

  // ── square video ──────────────────────────────────────────────────────
  describe('square video', () => {
    it('returns equal width and height for a square source', () => {
      const { width, height } = computeDimensions(320, 720, 720);
      expect(width).toBe(320);
      expect(height).toBe(320);
    });
  });

  // ── output dimensions are always positive integers ─────────────────────
  describe('output sanity', () => {
    it('always returns positive integers for all valid scale options', () => {
      const scales = [320, 480, 640, -1];
      scales.forEach((scale) => {
        const { width, height } = computeDimensions(scale, 1920, 1080);
        expect(width).toBeGreaterThan(0);
        expect(height).toBeGreaterThan(0);
        expect(Number.isInteger(width)).toBe(true);
        expect(Number.isInteger(height)).toBe(true);
      });
    });
  });
});
