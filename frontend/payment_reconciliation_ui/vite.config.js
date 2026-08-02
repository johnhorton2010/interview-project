import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

export default defineConfig(({ mode }) => {
  // APP_API_PREFIX is defined once in the repo-root .env and shared with Spring
  // (app.custom.restcontroller.prefix) and the nginx proxy. The empty prefix argument
  // makes loadEnv return every key rather than just VITE_*, but only this one is read
  // out and defined below — nothing else reaches the bundle. envDir is deliberately
  // left alone so this package's own .env still drives import.meta.env.
  const rootEnv = loadEnv(mode, repoRoot, '');
  const API_PREFIX =
    process.env.APP_API_PREFIX  // Docker build arg — the root .env is outside the build context
    || rootEnv.APP_API_PREFIX   // repo-root .env, for `npm run dev` and `npm test`
    || '/api/v1';

  // The backend runs on :8080 (Spring Boot default). We proxy the API prefix in dev so
  // the browser makes same-origin requests and we avoid CORS config on the backend.
  const API_TARGET = process.env.VITE_API_BASE_URL || 'http://localhost:8080';

  return {
    plugins: [react()],
    // Baked in at build time and read by src/api/client.js. Also applies under vitest, so
    // the dev server, the production build and the test run all agree on one value.
    define: {
      __API_PREFIX__: JSON.stringify(API_PREFIX),
    },
    server: {
      port: 5173,
      proxy: {
        [API_PREFIX]: {
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
  };
});
