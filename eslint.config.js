import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

/**
 * クリーンアーキテクチャのレイヤー境界を機械的に強制する。
 * 依存方向: ui → state → application → domain（+ shared は最下層）
 * 下位レイヤーは上位レイヤーを import できない。
 */
const layerZones = [
  {
    target: './src/shared',
    from: ['./src/domain', './src/application', './src/state', './src/ui'],
    message: 'shared は他レイヤーに依存できません。',
  },
  {
    target: './src/domain',
    from: ['./src/application', './src/state', './src/ui'],
    message: 'domain は shared 以外に依存できません。',
  },
  {
    target: './src/application',
    from: ['./src/state', './src/ui'],
    message: 'application は state/ui に依存できません（副作用は注入する）。',
  },
  {
    target: './src/state',
    from: ['./src/ui'],
    message: 'state は ui に依存できません。',
  },
  {
    target: './src/ui',
    from: ['./src/domain', './src/application'],
    message: 'ui はロジック層を直接 import できません（state 経由にする / tsx にロジックを書かない）。',
  },
];

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.browser },
    },
    plugins: {
      import: importPlugin,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    settings: {
      'import/resolver': {
        typescript: { project: './tsconfig.json' },
      },
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'import/no-restricted-paths': ['error', { zones: layerZones }],
    },
  },
  // テストファイルはレイヤー境界の対象外（クロスレイヤーの結合テストを許可）
  {
    files: ['**/*.{test,spec}.{ts,tsx}', 'test/**'],
    rules: {
      'import/no-restricted-paths': 'off',
    },
  },
);
