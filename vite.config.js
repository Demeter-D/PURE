import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

const r = (p) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  publicDir: 'public',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: r('./index.html'),
        admin: r('./admin.html'),
      },
    },
  },
});
