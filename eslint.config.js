import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

const sharedRules = {
  'react/react-in-jsx-scope': 'off',
  'react/jsx-uses-react': 'off',
  '@typescript-eslint/no-explicit-any': 'off',
  '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
  '@typescript-eslint/ban-ts-comment': 'off',
  'no-unused-vars': 'off',
  'no-empty': 'off',
  'no-useless-catch': 'off',
  'no-useless-escape': 'off',
  'no-case-declarations': 'off',
  'no-prototype-builtins': 'off',
  'no-extra-boolean-cast': 'off',
  'no-control-regex': 'off',
  'no-constant-binary-expression': 'off',
  'no-shadow-restricted-names': 'off',
  'no-var': 'off',
  '@typescript-eslint/no-empty-object-type': 'off',
  '@typescript-eslint/no-non-null-asserted-optional-chain': 'off',
  'prefer-const': 'warn',
}

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'android/**',
      'ios/**',
      'backend/uploads/**',
      'supabase/.temp/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    rules: sharedRules,
  },

  {
    files: ['src/**/*.{js,jsx,ts,tsx}', 'vite-plugins/**/*.{js,ts}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...sharedRules,
      'react-hooks/rules-of-hooks': 'warn',
    },
  },

  {
    files: ['backend/**/*.{js,ts}', 'scripts/**/*.{js,ts,mjs}', 'vite.config.ts', 'vitest.config.ts', 'capacitor.config.ts'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    rules: sharedRules,
  },

  {
    files: ['public/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...globals.serviceworker,
        firebase: 'readonly',
      },
    },
    rules: sharedRules,
  },

  {
    files: ['supabase/functions/**/*.{js,ts}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.deno,
        ...globals.es2022,
      },
    },
    rules: sharedRules,
  },

  {
    files: ['**/*.{test,spec}.{js,jsx,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.vitest,
        ...globals.jest,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
]
