import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'node:path'

// Relative base lets the build run on GitHub Pages at any path
// (user-site, project-site, custom domain) without rebuilding.
export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
    },
  },
  // Don't let Vite's dep-optimizer scan research / vendor folders sitting in
  // the repo root (Capacity Gym, Syllogimous v3). They import their own deps
  // (e.g. @supabase/supabase-js) that this app doesn't ship.
  optimizeDeps: {
    entries: ['index.html', 'src/**/*.{js,jsx}'],
  },
  plugins: [react()],
});
