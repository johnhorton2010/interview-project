import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The backend runs on :8080 (Spring Boot default). We proxy /api in dev so the
// browser makes same-origin requests and we avoid CORS config on the backend.
const API_TARGET = process.env.VITE_API_BASE_URL || 'http://localhost:8080';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
    watch: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/**/*.test.js',
        'src/test/**',          // fixtures + sample-payload builder
        'src/main.jsx',         // React mount entrypoint
        'src/styles/tokens.js', // static token maps
      ],
    },
  },
});
