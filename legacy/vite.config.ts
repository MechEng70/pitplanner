import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  plugins: [preact()],
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: { outDir: 'dist', target: 'es2022' },
});
