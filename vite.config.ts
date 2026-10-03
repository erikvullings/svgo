import { defineConfig } from 'vite';
import { cpSync } from 'node:fs';
import { resolve } from 'node:path';

export default defineConfig(({ mode }) => ({
  base: './',
  build: {
    outDir: mode === 'procyon' ? 'dist/procyon' : 'docs',
    emptyOutDir: true
  },
  plugins: mode === 'procyon' ? [{
    name: 'local-monaco',
    transformIndexHtml(html: string) {
      return html.replace(
        'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs/loader.min.js',
        './monaco/vs/loader.js'
      );
    },
    closeBundle() {
      cpSync(
        resolve('node_modules/monaco-editor/min/vs'),
        resolve('dist/procyon/monaco/vs'),
        { recursive: true }
      );
    }
  }] : []
}));
