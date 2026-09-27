import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `--mode single` produces one self-contained HTML file (web demo / itch.io / artifact).
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    target: 'es2022',
    assetsInlineLimit: 100000,
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    globals: true,
  },
}));
