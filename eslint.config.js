import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['src/**/*.{ts,tsx}'],
        rules: {
            // 禁止新增 any（存量通过行内 eslint-disable 豁免）
            '@typescript-eslint/no-explicit-any': 'warn',
            // 强制 import type 用于纯类型导入
            '@typescript-eslint/consistent-type-imports': [
                'warn',
                { prefer: 'type-imports', fixStyle: 'separate-type-imports' }
            ],
            // 禁止未使用变量
            '@typescript-eslint/no-unused-vars': [
                'warn',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
            ],
            // 允许 require（油猴环境）
            '@typescript-eslint/no-require-imports': 'off',
            // 存量降级为 warn（基线绿色，后续逐步修复）
            'no-empty': 'warn',
            'no-useless-assignment': 'warn',
            'no-useless-catch': 'warn',
            'no-prototype-builtins': 'warn',
            'preserve-caught-error': 'warn',
            '@typescript-eslint/no-this-alias': 'warn',
            '@typescript-eslint/no-unused-expressions': 'warn'
        }
    },
    {
        ignores: ['dist/', 'archetype/', 'node_modules/', '*.config.*']
    }
);
