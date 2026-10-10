// @vitest-environment jsdom
/**
 * 开关命中区与标签联动测试（docs/55，audit doc/54 的 P1 项）。
 *
 * 覆盖用户可感知的口径：
 * 1. 快捷面板与设置弹层里每个 `.jhs-toggle` 都有配对的 `<label for>`（id 一一对应）；
 * 2. 点标签文案即切换开关（不再只有 40×22 那一条命中区）；
 * 3. 点问号提示**不**切换开关（提示图标留在 label 外）；
 * 4. `SettingRow` 未给 `controlId` 时退回 `<span>`（向后兼容，不产生无 `for` 的 label）。
 *
 * 夹具用**真实组件**（SimpleSettingPanel / SettingToggle / SettingRow 经 jsxToString 渲染），
 * class 与 id 契约一旦改动，本测试会失败。
 * 命中区的 40×44 由 CSS 的 `::after` 提供，jsdom 不做布局计算，故不在本测试内断言
 * （见 docs/55 的构建产物核验记录）。
 */
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { SettingRow } from '../src/components/setting/setting-row';
import { SettingToggle } from '../src/components/setting/setting-toggle';
import { SimpleSettingPanel } from '../src/components/setting/simple-setting-panel';
import { jsxToString } from '../src/core/jsx-to-string';

/** 把渲染产物挂进 jsdom。 */
function mount(html: string): void {
    document.body.innerHTML = html;
}

/** 快捷面板里所有开关（真实组件渲染）。 */
function mountQuickPanel(): { toggles: HTMLInputElement[]; labels: HTMLLabelElement[] } {
    mount(jsxToString(createElement(SimpleSettingPanel, { isJavdbSite: true })));
    return {
        toggles: [...document.querySelectorAll<HTMLInputElement>('input.jhs-toggle')],
        labels: [...document.querySelectorAll<HTMLLabelElement>('.jhs-qs-label > label')]
    };
}

afterEach(() => {
    document.body.innerHTML = '';
});

describe('开关标签联动', () => {
    it('快捷面板每个开关都有配对的 label[for]，id 一一对应', () => {
        const { toggles, labels } = mountQuickPanel();
        expect(toggles.length).toBe(11);
        expect(labels.length).toBe(11);
        const toggleIds = new Set(toggles.map((i) => i.id));
        expect(new Set(labels.map((l) => l.htmlFor))).toEqual(toggleIds);
        for (const label of labels) {
            expect(label.htmlFor).not.toBe('');
            expect(label.textContent?.trim()).not.toBe('');
        }
    });

    it('点标签文案即切换开关（快捷面板）', () => {
        const { toggles } = mountQuickPanel();
        const box = document.getElementById('enableLoadOtherSite') as HTMLInputElement;
        const label = document.querySelector<HTMLLabelElement>(
            'label[for="enableLoadOtherSite"]'
        )!;
        expect(box.checked).toBe(false);
        label.click();
        expect(box.checked).toBe(true);
        label.click();
        expect(box.checked).toBe(false);
        // 其它开关不受影响
        expect(toggles.filter((t) => t.checked)).toHaveLength(0);
    });

    it('点问号提示不切换开关（提示在 label 外）', () => {
        mountQuickPanel();
        const tip = document.querySelector<HTMLElement>('.jhs-tip-icon')!;
        expect(tip.closest('label')).toBeNull();
        tip.click();
        expect((document.getElementById('showAllItem') as HTMLInputElement).checked).toBe(false);
    });

    it('设置弹层原子行（SettingToggle）同样联动', () => {
        mount(
            jsxToString(
                createElement(SettingToggle, { id: 'probeToggle', label: '测试开关' })
            )
        );
        const label = document.querySelector<HTMLLabelElement>('.setting-label > label')!;
        expect(label.htmlFor).toBe('probeToggle');
        expect(label.textContent).toBe('测试开关');
        // 问号提示也在 label 外
        expect(label.querySelector('.jhs-tip-icon')).toBeNull();
        label.click();
        expect((document.getElementById('probeToggle') as HTMLInputElement).checked).toBe(true);
    });
});

describe('问号提示（单一实现）', () => {
    it('两个表面渲染同一个类，且可访问名称与视觉 tooltip 同源', () => {
        mountQuickPanel();
        const quickTips = [...document.querySelectorAll<HTMLElement>('.jhs-tip-icon')];
        expect(quickTips.length).toBe(5);
        for (const tip of quickTips) {
            expect(tip.getAttribute('role')).toBe('img');
            expect(tip.getAttribute('aria-label')).toBe(tip.getAttribute('data-tip'));
            expect(tip.getAttribute('aria-label')).not.toBe('');
            expect(tip.textContent).toBe('?');
        }

        mount(
            jsxToString(
                createElement(SettingToggle, {
                    id: 'probeToggle',
                    label: '测试开关',
                    tooltip: '行内提示文案'
                })
            )
        );
        const rowTip = document.querySelector<HTMLElement>('.setting-label .jhs-tip-icon')!;
        expect(rowTip.getAttribute('role')).toBe('img');
        expect(rowTip.getAttribute('aria-label')).toBe('行内提示文案');
        expect(rowTip.getAttribute('data-tip')).toBe('行内提示文案');
        // 旧的两套类名不再出现（doc/55 收敛）
        expect(document.querySelectorAll('.jhs-qs-tip, .jhs-tooltip-icon')).toHaveLength(0);
    });
});

describe('SettingRow 向后兼容', () => {
    it('未给 controlId 时标签仍是纯文本，且不产生无 for 的 label', () => {
        const html = jsxToString(
            createElement(SettingRow, {
                label: '无控件 id',
                children: createElement('span', null, '控件')
            })
        );
        mount(html);
        const labelBox = document.querySelector('.setting-label')!;
        expect(labelBox.textContent).toBe('无控件 id');
        expect(labelBox.querySelector('label')).toBeNull();
        expect(document.querySelectorAll('label[for]')).toHaveLength(0);
    });
});