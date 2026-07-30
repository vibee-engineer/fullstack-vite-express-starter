import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // HMR through the nginx terminator on :8888.
    hmr: {
      clientPort: 8888,
    },
  },
  optimizeDeps: {
    // Pre-bundle the shadcn/Radix primitives so the first navigation doesn't
    // pay a cold-boot recompile cost.
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
      'axios',
      'clsx',
      'tailwind-merge',
      'class-variance-authority',
      'sonner',
    ],
  },
});
