import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true
  },
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      // Non-regression floor (current ~24%). Target 88% per production plan;
      // reached progressively as components are decomposed & tested (WP3c).
      thresholds: {
        statements: 20,
        branches: 50,
        functions: 60,
        lines: 20
      }
    }
  }
});
