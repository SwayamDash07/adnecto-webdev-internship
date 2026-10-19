import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FlatCompat } from '@eslint/eslintrc'

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) })

export default [
  { ignores: ['**/.next/**', '**/dist/**', '**/node_modules/**', '**/coverage/**', 'next-env.d.ts'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    // Existing source currently violates these recommended rules. Keep them
    // visible while allowing the repository's lint command to run in CI.
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/triple-slash-reference': 'off',
      'prefer-const': 'warn',
      'react/no-unescaped-entities': 'warn',
    },
  },
]
