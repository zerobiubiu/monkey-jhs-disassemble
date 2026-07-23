import { defineConfig } from 'vitest/config';

// 测试运行器配置。刻意与 vite.config.ts（vite-plugin-monkey 用户脚本构建）分离：
// - 不引入 react/monkey 插件——被测模块（jsx-to-string / backup-crypto）为纯函数，
//   用 react.createElement 构造节点即可，无需 JSX 转换或浏览器 DOM。
// - environment: 'node'：Node 18+ 全局提供 crypto.subtle / atob / btoa / TextEncoder，
//   满足 backup-crypto 的 AES-GCM 路径，省去 jsdom 启动开销。
// - include 限定 tests/，与 src/ 构建产物隔离；tsc -b 与 eslint src/ 均不覆盖此目录，
//   故测试代码不影响用户脚本构建门禁。
export default defineConfig({
    test: {
        environment: 'node',
        include: ['tests/**/*.test.ts']
    }
});
