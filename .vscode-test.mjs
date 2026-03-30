import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
  files: 'out/test/**/*.test.js',
  mocha: {
    ui: 'tdd',
    timeout: 20000,
    color: true,
  },
  coverage: {
    reporter: ['text', 'lcov'],
    exclude: ['out/test/**', 'src/test/**'],
    all: true,
    branches: 95,
    functions: 95,
    lines: 95,
    statements: 95,
  },
});
