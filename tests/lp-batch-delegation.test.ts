// @vitest-environment jsdom
/**
 * 批量 UI 委托白名单回归测试（doc/33 §回归）。
 *
 * 起因：v1.46.27 侧栏容器（`.jhs-lp-batch-side`）未列入委托白名单，
 * 导致「全选 / 反选 / 清空 / 请求列表」点了**没反应**（事件被直接忽略）。
 * 本测试锁定：两处容器（浮出操作条 + 左侧常驻竖排栏）内的按钮都必须被识别。
 */
import { describe, expect, it } from 'vitest';
import { ensureBatchSideBar, isBatchUiControl } from '../src/plugins/list-page/lp-batch';
import { ensureBatchSideSlot } from '../src/plugins/list-page/lp-batch';

/** 造一段指定容器类名下的按钮结构。 */
function htmlWith(containerClass: string): HTMLElement {
    document.body.innerHTML = `<div class="${containerClass}"><button data-act="select-all">全选</button></div>`;
    return document.querySelector('button') as HTMLElement;
}

describe('isBatchUiControl（委托白名单）', () => {
    it('左侧常驻竖排栏内的按钮被识别', () => {
        expect(isBatchUiControl(htmlWith('jhs-lp-batch-side'))).toBe(true);
    });

    it('浮出操作条内的按钮被识别', () => {
        expect(isBatchUiControl(htmlWith('jhs-lp-batch-layer'))).toBe(true);
    });

    it('侧栏按钮的子孙元素（如内部 span）也能上溯到容器', () => {
        document.body.innerHTML =
            '<div class="jhs-lp-batch-side"><button data-act="invert"><span>反选</span></button></div>';
        expect(isBatchUiControl(document.querySelector('span'))).toBe(true);
    });

    it('页面其它位置的 [data-act] 不被误认（不越权接管站点按钮）', () => {
        document.body.innerHTML = '<div class="movie-list"><button data-act="select-all">全选</button></div>';
        expect(isBatchUiControl(document.querySelector('button'))).toBe(false);
    });

    it('null / 脱离文档的元素返回 false', () => {
        expect(isBatchUiControl(null)).toBe(false);
        expect(isBatchUiControl(document.createElement('button'))).toBe(false);
    });

    it('状态标签筛选栏内的按钮不属于本插件白名单（各自独立）', () => {
        document.body.innerHTML =
            '<div class="status-tag-filter-bar"><span data-act="x">标签</span></div>';
        expect(isBatchUiControl(document.querySelector('span'))).toBe(false);
    });
});

describe('ensureBatchSideBar（侧栏渲染一次，停靠按钮不被冲掉）', () => {
    it('首次渲染写入选择组四键，且仅渲染一次（重复调用不重建）', () => {
        document.body.innerHTML = '<div class="jhs-lp-batch-side"></div>';
        const container = document.querySelector('.jhs-lp-batch-side') as HTMLElement;
        ensureBatchSideBar(container);
        const clearBtn = container.querySelector('[data-act="clear"]') as HTMLButtonElement;
        expect(container.querySelector('[data-act="request-list"]')).not.toBeNull();
        expect(container.querySelectorAll('button')).toHaveLength(4);
        expect(clearBtn.disabled).toBe(true); // 无选择

        ensureBatchSideBar(container);
        expect(container.querySelectorAll('button')).toHaveLength(4); // 没重建
    });

    it('停靠在组内第一位的按钮（加载全部）在多次刷新后仍存活且仍在首位', () => {
        document.body.innerHTML = '<div class="jhs-lp-batch-side"></div>';
        const container = document.querySelector('.jhs-lp-batch-side') as HTMLElement;
        ensureBatchSideBar(container);

        // 模拟 auto-page 停靠：插到组内第一位
        const docked = document.createElement('button');
        docked.className = 'jhs-load-all-btn is-docked';
        docked.textContent = '加载全部';
        container.prepend(docked);

        ensureBatchSideBar(container);
        ensureBatchSideBar(container);

        expect(container.querySelector('.jhs-load-all-btn')).toBe(docked);
        expect(docked.isConnected).toBe(true);
        expect(container.firstElementChild).toBe(docked); // 组内第一位
        expect(container.querySelectorAll('button')).toHaveLength(5);
    });

    it('选择组被外部清空时才会重建（不会丢停靠按钮以外的状态）', () => {
        document.body.innerHTML = '<div class="jhs-lp-batch-side"></div>';
        const container = document.querySelector('.jhs-lp-batch-side') as HTMLElement;
        ensureBatchSideBar(container);
        container.querySelector('[data-act="request-list"]')?.remove();
        ensureBatchSideBar(container);
        expect(container.querySelector('[data-act="request-list"]')).not.toBeNull();
    });

    it('停靠按钮仍属白名单（它与选择组同容器）', () => {
        document.body.innerHTML =
            '<div class="jhs-lp-batch-side"><button class="jhs-load-all-btn is-docked">加载全部</button></div>';
        expect(isBatchUiControl(document.querySelector('.jhs-load-all-btn'))).toBe(true);
    });
});
