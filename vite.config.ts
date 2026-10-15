import { defineConfig } from 'vite';

export default defineConfig({
  // Relative assets work both at the domain root and under a Pages repository path.
  base: './',
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
