/**
 * CSS 占位符契约测试（docs/55）。
 *
 * 守住「样式表里的标记 ↔ main.tsx 的替换串逐字一致」这条隐性契约：
 * v1.28.15 的「原子化拆分」把注释统一补了内部空格（`/*X*\/` → `/* X *\/`），
 * 导致 `__HIDENAV2__` 与 `__SCROLLBAR__` 两处 CSS 注入**静默失效**（没人报错，
 * 只是样式一直没生效）。标记现由 src/core/style-injector.ts 单点声明，本测试锁住：
 * 1. 每个标记在其宿主样式表里恰好出现一次，替换后原标记消失、注入内容落位；
 * 2. 替换后样式表里不再残留 `__ABC__` 形式的标记；
 * 3. 全量扫描 src/styles：任何 `/* __X__ *\/` 形式的标记都必须是登记值（防再漂移）。
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { CSS_PLACEHOLDER, fillCssPlaceholder } from '../src/core/style-injector';

const STYLE_DIR = path.resolve('src/styles');

/** 标记 → 宿主样式表（相对 STYLE_DIR）。 */
const OWNER: Record<string, string> = {
    [CSS_PLACEHOLDER.hideNav]: 'javdb-site.css',
    [CSS_PLACEHOLDER.hideCoverSize]: 'javdb-site.css',
    [CSS_PLACEHOLDER.scrollbar]: 'common-toolbar.css'
};

/** 递归收集样式表（相对 STYLE_DIR 的路径 → 内容）。 */
function readStylesheets(): Map<string, string> {
    const out = new Map<string, string>();
    const walk = (rel: string): void => {
        for (const entry of readdirSync(path.join(STYLE_DIR, rel), { withFileTypes: true })) {
            const next = rel ? `${rel}/${entry.name}` : entry.name;
            if (entry.isDirectory()) walk(next);
            else if (entry.name.endsWith('.css'))
                out.set(next, readFileSync(path.join(STYLE_DIR, next), 'utf8'));
        }
    };
    walk('');
    return out;
}

const stylesheets = readStylesheets();

describe('CSS 占位符契约', () => {
    it('每个标记都有宿主样式表，且在其中恰好出现一次', () => {
        for (const [marker, file] of Object.entries(OWNER)) {
            const css = stylesheets.get(file);
            expect(css, `${file} 应存在`).toBeDefined();
            const hits = css!.split(marker).length - 1;
            expect(hits, `${file} 中的 ${marker} 出现次数`).toBe(1);
        }
    });

    it('替换后标记消失、注入内容落位、无 __ABC__ 残留', () => {
        for (const [file, css] of stylesheets) {
            const present = Object.values(CSS_PLACEHOLDER).filter((marker) => css.includes(marker));
            let filled = css;
            for (const marker of present) {
                filled = fillCssPlaceholder(filled, marker, '.probe-sentinel{}');
            }
            if (!present.length) continue;
            for (const marker of present) expect(filled).not.toContain(marker);
            expect(filled.match(/\.probe-sentinel\{\}/g)).toHaveLength(present.length);
            // 同一文件里的多个标记必须都被消费掉，不留 `__ABC__`
            expect(filled).not.toMatch(/__[A-Z][A-Z0-9_]*__/);
        }
    });

    it('src/styles 里不存在未登记形态的占位符标记', () => {
        const registered = new Set(Object.values(CSS_PLACEHOLDER));
        const malformed: string[] = [];
        for (const [file, css] of stylesheets) {
            for (const match of css.matchAll(/\/\*\s*(__[A-Z0-9_]+__)\s*\*\//g)) {
                const asWritten = css.slice(match.index, match.index! + match[0].length);
                if (!registered.has(asWritten)) malformed.push(`${file}: ${asWritten}`);
            }
        }
        expect(malformed, '形态漂移会让替换静默失效').toEqual([]);
    });
});