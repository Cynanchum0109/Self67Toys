import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const app = process.env.APP === 'arcade' ? 'arcade' : 'hatchery';

export default defineConfig({
  // Toy 平台把作品挂在 /toy/<slug>/<id>-v2/ 下，必须用相对路径
  base: './',
  root: path.resolve(__dirname, 'apps', app),
  publicDir: path.resolve(__dirname, 'public'),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') }
  },
  server: { port: 3000, host: '0.0.0.0' },
  build: {
    outDir: path.resolve(__dirname, 'dist', app),
    emptyOutDir: true,
    assetsInlineLimit: 0
  }
});
