import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      'dist/**',
      '**/dist/**',
      'node_modules/**',
      '**/node_modules/**',
      'build/**',
      '**/build/**',
      'coverage/**',
      'bun.lock',
    ],
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: ['packages/engine-core/src/**/*.{ts,tsx}'],
    ignores: ['**/__tests__/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'fs', message: 'Engine-core must be deterministic pure TypeScript: no fs allowed.' },
            { name: 'node:fs', message: 'Engine-core must be deterministic pure TypeScript: no fs allowed.' },
            { name: 'path', message: 'Engine-core must be deterministic pure TypeScript: no path allowed.' },
            { name: 'node:path', message: 'Engine-core must be deterministic pure TypeScript: no path allowed.' },
          ],
          patterns: [
            { group: ['node:*'], message: 'Engine-core must be deterministic pure TypeScript: no Node-only modules allowed.' },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'Engine-core must be pure TypeScript: no DOM globals (window).' },
        { name: 'document', message: 'Engine-core must be pure TypeScript: no DOM globals (document).' },
        { name: 'fetch', message: 'Engine-core must be pure TypeScript: no network (fetch).' },
        { name: 'localStorage', message: 'Engine-core must be pure TypeScript: no localStorage.' },
        { name: 'indexedDB', message: 'Engine-core must be pure TypeScript: no indexedDB.' },
      ],
    },
  }
);
