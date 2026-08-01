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
    // The default stays `node`: the domain suites are pure functions over the model and
    // pay nothing for a DOM. Only the component suites take jsdom, which costs a couple
    // of hundred milliseconds of environment construction per file.
    environment: 'node',
    environmentMatchGlobs: [['src/**/*.test.jsx', 'jsdom']],
    include: ['src/**/*.test.{js,jsx}'],
    setupFiles: ['./src/test/setup.js'],
    // Off, as every suite imports describe/it/expect from 'vitest' — which is also why
    // setup.js has to register Testing Library's afterEach(cleanup) by hand.
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        // Covers .test.jsx too: counting the component suites as production source would
        // add a few thousand self-covering lines and inflate the totals this report exists
        // to expose.
        'src/**/*.test.{js,jsx}',
        'src/test/**',          // fixtures, setup and render helpers
        'src/main.jsx',         // React mount entrypoint
        'src/styles/tokens.js', // static token maps
      ],
      // No thresholds on purpose: coverage picks the next thing to test, it is not a gate.
    },
  },
});
