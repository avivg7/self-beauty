import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import globals from 'globals';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  {
    ignores: [
      'dist/**',
      '.astro/**',
      'node_modules/**',
      '.tools/**',
      'public/**',
      'playwright-report/**',
      'test-results/**',
      '.demo-dist/**',
      'artifacts/**',
      'spikes/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  ...astro.configs['jsx-a11y-strict'],
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/*.astro'],
    rules: {
      // Astro templates legitimately declare props via `const { ... } = Astro.props`
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
]);
