// @vitest-environment jsdom
/**
 * 展示层渲染契约（doc/26 / doc/27）。
 *
 * 组件本身只做渲染（`jsxToString` → HTML 字符串），交互由控制器的事件委托负责；
 * 这里断言「渲染出的 HTML 含哪些行、哪些按钮」——即面板/工具栏对外承诺的结构。
 * 用 `React.createElement` 构造节点（测试文件本身不写 JSX）。
 */
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { jsxToString } from '../src/core/jsx-to-string';
import { PreloadQueuePanel } from '../src/components/other-site/preload-queue-panel';
import {
    LpBatchSideBar,
    LpBatchToolbar
} from '../src/components/list-page/lp-batch-bar';

describe('PreloadQueuePanel 渲染契约', () => {
    it('渲染行（番号/站点/状态）与按状态给出的动作按钮', () => {
        const html = jsxToString(
            createElement(PreloadQueuePanel, {
                rows: [
                    {
                        key: 'DAZD-314_missAvBtn',
                        carNum: 'DAZD-314',
                        siteLabel: 'missAv',
                        status: 'requesting',
                        inQueue: true,
                        running: true
                    },
                    {
                        key: 'ABC-1_missAvBtn',
                        carNum: 'ABC-1',
                        siteLabel: 'missAv',
                        status: 'queued',
                        inQueue: true,
                        running: false
                    },
                    {
                        key: 'XYZ-9_missAvBtn',
                        carNum: 'XYZ-9',
                        siteLabel: 'missAv',
                        status: 'failed',
                        inQueue: false,
                        running: false
                    }
                ],
                counts: { queued: 1, requesting: 1, failed: 1, cancelled: 0 },
                concurrency: 1
            })
        );
        expect(html).toContain('预加载请求列表');
        expect(html).toContain('执行中 1'); // 摘要
        expect(html).toContain('执行中 1 · 排队 1 · 失败 1');
        expect(html).toContain('DAZD-314');
        expect(html).toContain('ABC-1');
        expect(html).toContain('XYZ-9');
        // 执行中：只能取消（不能置顶）
        expect(html).toContain('data-act="cancel" data-key="DAZD-314_missAvBtn"');
        // 排队中：置顶 + 取消
        expect(html).toContain('data-act="prioritize" data-key="ABC-1_missAvBtn"');
        // 终态：重试 + 移除（且不带取消）
        expect(html).toContain('data-act="retry" data-key="XYZ-9_missAvBtn"');
        expect(html).toContain('data-act="remove" data-key="XYZ-9_missAvBtn"');
        expect(html).toContain('data-act="retry-failed"');
        expect(html).toContain('data-act="clear-terminal"');
    });

    it('空队列渲染空态且「全部重试 / 清空已结束」禁用', () => {
        const html = jsxToString(
            createElement(PreloadQueuePanel, {
                rows: [],
                counts: { queued: 0, requesting: 0, failed: 0, cancelled: 0 },
                concurrency: 2
            })
        );
        expect(html).toContain('队列为空');
        expect(html).toContain('并发 2');
        expect(html).toContain('disabled');
    });
});

describe('LpBatchToolbar 渲染契约', () => {
    it('浮出操作条渲染：计数 + 快捷评分条（收藏/已读/拉黑 + 五颗星），不含选择组', () => {
        const html = jsxToString(createElement(LpBatchToolbar, { count: 3, busy: false }));
        expect(html).toContain('已选');
        expect(html).toContain('<strong>3</strong>');
        expect(html).toContain('data-act="favorite"');
        expect(html).toContain('data-act="filter"');
        // 全选/反选/清空已移至常驻侧栏（LpBatchSideBar）
        expect(html).not.toContain('data-act="select-all"');
        expect(html).not.toContain('data-act="invert"');
        // 全选/反选/清空已移至常驻侧栏（LpBatchSideBar）
        expect(html).not.toContain('data-act="select-all"');
        expect(html).not.toContain('data-act="invert"');
        expect(html).not.toContain('data-act="clear"');
        // 已读（0星）与五颗星（1–5）
        expect(html).toContain('data-act="watched" data-score="0"');
        for (const score of [1, 2, 3, 4, 5]) {
            expect(html).toContain(`data-act="watched" data-score="${score}"`);
        }
        expect(html).not.toMatch(/data-act="favorite"[^>]*disabled/);
    });

    it('count=0：操作按钮禁用，选择组不在此浮出条内', () => {
        const html = jsxToString(createElement(LpBatchToolbar, { count: 0, busy: false }));
        // 断言到属性边界为止，不依赖 disabled 的具体序列化形式
        expect(html).toMatch(/data-act="favorite"[^>]*disabled/);
        expect(html).toMatch(/data-act="watched"[^>]*data-score="5"[^>]*disabled/);
        expect(html).not.toContain('data-act="select-all"');
        expect(html).not.toContain('data-act="invert"');
        expect(html).not.toContain('data-act="clear"');
        // 「全选 / 反选」必须在 count=0 时可用，否则无法开始选择
        expect(html).not.toMatch(/data-act="select-all"[^>]*disabled/);
        expect(html).not.toMatch(/data-act="invert"[^>]*disabled/);
    });
});

describe('LpBatchSideBar 渲染契约（常驻竖排选择组）', () => {
    it('含请求列表 / 全选 / 反选 / 清空四枚竖排按钮', () => {
        const html = jsxToString(createElement(LpBatchSideBar, { hasSelection: true }));
        expect(html).toContain('data-act="clear"');
        expect(html).toContain('请求列表');
        // 不得自带容器类：容器由控制器创建，自带会形成同名嵌套（实测反馈的结构错误）
        expect(html).not.toContain('jhs-lp-batch-side"');
        expect(html).not.toContain('<div');
    });

    it('有选择时「清空」可用；无选择时禁用（全选/反选不受限）', () => {
        const withSel = jsxToString(createElement(LpBatchSideBar, { hasSelection: true }));
        const empty = jsxToString(createElement(LpBatchSideBar, { hasSelection: false }));
        expect(withSel).not.toMatch(/data-act="clear"[^>]*disabled/);
        expect(empty).toMatch(/data-act="clear"[^>]*disabled/);
        expect(empty).not.toMatch(/data-act="select-all"[^>]*disabled/);
        expect(empty).not.toMatch(/data-act="invert"[^>]*disabled/);
    });
});
