import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // @ffmpeg packages ship as ESM with dynamic imports — Vite's CommonJS
    // pre-bundler breaks them.  Exclude to let them load as-is.
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  define: {
    __APP_VERSION__: JSON.stringify('v' + pkg.version),
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/*.test.js', 'src/**/*.test.jsx'],
    coverage: {
      provider: 'v8',
      include: ['src/hooks/**'],
      reporter: ['text', 'html'],
    },
  },
})
