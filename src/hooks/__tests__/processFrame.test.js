import { describe, it, expect } from 'vitest';
import { processFrame } from '../useGifEncoder';

// Helper: build a synthetic ImageData-like object with uniform pixel colour
function makeImgData(numPixels, r, g, b) {
  const data = new Uint8ClampedArray(numPixels * 4);
  for (let i = 0; i < numPixels; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255; // alpha
  }
  return { data, length: data.length };
}

// Helper: build a pre-snapped buffer (Uint8Array, 3 bytes/pixel)
function makeSnapped(numPixels, r, g, b) {
  const buf = new Uint8Array(numPixels * 3);
  for (let i = 0; i < numPixels; i++) {
    buf[i * 3] = r;
    buf[i * 3 + 1] = g;
    buf[i * 3 + 2] = b;
  }
  return buf;
}

const TRANSPARENT_KEY = { r: 1, g: 1, b: 1 };

describe('processFrame', () => {
  // ── first frame (no prevSnapped) ──────────────────────────────────────
  describe('first frame — prevSnapped = null', () => {
    it('changeRatio is 1.0 when all pixels are "new"', () => {
      const imgData = makeImgData(100, 200, 100, 50);
      const { changeRatio } = processFrame(imgData, null, 1);
      expect(changeRatio).toBe(1);
    });

    it('no pixel is set to transparent key on the first frame', () => {
      const imgData = makeImgData(4, 200, 100, 50);
      processFrame(imgData, null, 1);
      for (let i = 0; i < 4; i++) {
        const r = imgData.data[i * 4];
        const g = imgData.data[i * 4 + 1];
        const b = imgData.data[i * 4 + 2];
        expect([r, g, b]).not.toEqual([TRANSPARENT_KEY.r, TRANSPARENT_KEY.g, TRANSPARENT_KEY.b]);
      }
    });

    it('returns a snapped buffer of the correct size (3 bytes per pixel)', () => {
      const imgData = makeImgData(100, 128, 64, 32);
      const { snapped } = processFrame(imgData, null, 1);
      expect(snapped).toBeInstanceOf(Uint8Array);
      expect(snapped.length).toBe(300); // 100 pixels × 3
    });
  });

  // ── identical second frame ────────────────────────────────────────────
  describe('identical second frame', () => {
    it('changeRatio is 0 when all pixels match prevSnapped', () => {
      const imgData = makeImgData(100, 200, 100, 50);
      const prevSnapped = makeSnapped(100, 200, 100, 50);
      const { changeRatio } = processFrame(imgData, prevSnapped, 1);
      expect(changeRatio).toBe(0);
    });

    it('all pixels are set to transparent key when identical', () => {
      const numPixels = 4;
      const imgData = makeImgData(numPixels, 200, 100, 50);
      const prevSnapped = makeSnapped(numPixels, 200, 100, 50);
      processFrame(imgData, prevSnapped, 1);
      for (let i = 0; i < numPixels; i++) {
        expect(imgData.data[i * 4]).toBe(1);
        expect(imgData.data[i * 4 + 1]).toBe(1);
        expect(imgData.data[i * 4 + 2]).toBe(1);
      }
    });
  });

  // ── partially changed frame ───────────────────────────────────────────
  describe('partially changed frame', () => {
    it('changeRatio reflects the proportion of changed pixels', () => {
      const numPixels = 100;
      // First 50 pixels: same as prevSnapped; last 50: different
      const data = new Uint8ClampedArray(numPixels * 4);
      const prevSnapped = new Uint8Array(numPixels * 3);

      for (let i = 0; i < numPixels; i++) {
        const r = i < 50 ? 100 : 200; // first half matches prev; second half differs
        data[i * 4] = r;
        data[i * 4 + 1] = 100;
        data[i * 4 + 2] = 100;
        data[i * 4 + 3] = 255;
        prevSnapped[i * 3] = 100;
        prevSnapped[i * 3 + 1] = 100;
        prevSnapped[i * 3 + 2] = 100;
      }
      const imgData = { data, length: data.length };
      const { changeRatio } = processFrame(imgData, prevSnapped, 1);
      expect(changeRatio).toBeCloseTo(0.5, 5);
    });

    it('single-pixel change in a large frame keeps changeRatio below 2% threshold', () => {
      const numPixels = 200;
      const imgData = makeImgData(numPixels, 100, 100, 100);
      const prevSnapped = makeSnapped(numPixels, 100, 100, 100);
      // Change just 1 pixel
      imgData.data[0] = 200;
      const { changeRatio } = processFrame(imgData, prevSnapped, 1);
      expect(changeRatio).toBeLessThan(0.02);
    });
  });

  // ── snapStep = 1 (no quantisation) ───────────────────────────────────
  describe('snapStep = 1 (no colour snapping)', () => {
    it('leaves pixel values unchanged', () => {
      const imgData = makeImgData(1, 37, 82, 194);
      const { snapped } = processFrame(imgData, null, 1);
      expect(snapped[0]).toBe(37);
      expect(snapped[1]).toBe(82);
      expect(snapped[2]).toBe(194);
    });
  });

  // ── snapStep > 1 (colour quantisation) ───────────────────────────────
  describe('snapStep > 1 (colour quantisation)', () => {
    it('snapStep=8: rounds channels to nearest multiple of 8', () => {
      // r=10 → round(10/8)*8 = round(1.25)*8 = 1*8 = 8
      // g=20 → round(20/8)*8 = round(2.5)*8 = 3*8 = 24  (JS rounds half-up)
      // b=30 → round(30/8)*8 = round(3.75)*8 = 4*8 = 32
      const imgData = makeImgData(1, 10, 20, 30);
      const { snapped } = processFrame(imgData, null, 8);
      expect(snapped[0]).toBe(8);
      expect(snapped[1]).toBe(24);
      expect(snapped[2]).toBe(32);
    });

    it('snapStep=16: never exceeds 255', () => {
      const imgData = makeImgData(1, 254, 255, 249);
      const { snapped } = processFrame(imgData, null, 16);
      expect(snapped[0]).toBeLessThanOrEqual(255);
      expect(snapped[1]).toBeLessThanOrEqual(255);
      expect(snapped[2]).toBeLessThanOrEqual(255);
    });

    it('snapStep=4: rounds all four lossy-light values without throwing', () => {
      [4, 8, 16].forEach((step) => {
        const imgData = makeImgData(10, 128, 64, 32);
        expect(() => processFrame(imgData, null, step)).not.toThrow();
      });
    });
  });

  // ── large pixel buffer (performance smoke test) ───────────────────────
  describe('large pixel buffer', () => {
    it('processes 320×240 = 76800 pixels without error', () => {
      const numPixels = 320 * 240;
      const imgData = makeImgData(numPixels, 100, 150, 200);
      expect(() => processFrame(imgData, null, 1)).not.toThrow();
    });

    it('processes 640×480 = 307200 pixels without error', () => {
      const numPixels = 640 * 480;
      const imgData = makeImgData(numPixels, 80, 120, 160);
      expect(() => processFrame(imgData, null, 1)).not.toThrow();
    });
  });
});
