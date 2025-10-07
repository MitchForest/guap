import js from '@eslint/js';
import solid from 'eslint-plugin-solid';
import tseslint from 'typescript-eslint';

const solidRules = solid.configs.typescript?.rules ?? {};

export default tseslint.config(
  {
    ignores: ['dist', 'node_modules'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      solid,
    },
    rules: {
      ...solidRules,
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off',
      'solid/prefer-for': 'off',
      'solid/reactivity': 'off',
    },
  }
);
