/**
 * 新增清单功能 —— 展开面板下「➕ 新增清单」UI + 事件绑定 + 可用性同步。
 *
 * 提取自 vlt-create-list.tsx：
 * - setupCreateListButton：在 .jhs-list-panel 后插入新增清单 UI
 * - bindCreateListEvents / bindCreateListAvailability：事件绑定 + 可用性同步
 */

import { jsxToString } from '../../core/jsx-to-string';

import { createList, restoreCreateListUi } from './vlt-create-list-api';
import type { CreateListResult } from './vlt-create-list-api';
import { getCurrentListContainer, LOG_PREFIX } from './vlt-helpers';
import { showToast } from './vlt-toast';

import { VltCreateListForm } from '../../components/misc/vlt-create-list-form';

/** 新增清单 UI 是否已注入（幂等标记）。 */
let _createListUiInjected = false;
/** 新增清单请求是否进行中，避免 Enter 与按钮连击重复创建。 */
let _createListInFlight = false;

/**
 * 在 .jhs-list-panel 后插入「新增清单」UI。
 * 由于 .jhs-list-panel 由 DetailPageButtonPlugin 异步创建，此处轮询等待。
 */
export function setupCreateListButton(): void {
    if (_createListUiInjected) return;
    const panel = document.querySelector('.jhs-list-panel');
    if (!panel) {
        setTimeout(setupCreateListButton, 400);
        return;
    }
    if (document.querySelector('.jhs-list-create-wrap')) {
        _createListUiInjected = true;
        return;
    }
    const wrap = document.createElement('div');
    wrap.className = 'jhs-list-create-wrap';
    wrap.innerHTML = jsxToString(<VltCreateListForm />);
    panel.insertAdjacentElement('afterend', wrap);
    bindCreateListEvents(wrap);
    bindCreateListAvailability(panel, wrap);
    _createListUiInjected = true;
}

/** 清单仍在初始/分页载入或错误态时，阻止新建与 DOM 差量侦测发生竞态。 */
function bindCreateListAvailability(panel: Element, wrap: HTMLElement): void {
    const items = panel.querySelector('.jhs-list-panel__items');
    const btn = wrap.querySelector('.jhs-list-create-btn') as HTMLButtonElement | null;
    if (!items || !btn) return;
    const sync = () => {
        const ready = isCreateListPanelReady();
        btn.disabled = !ready;
        btn.title = ready ? '新建清单' : '清单载入后可新建';
    };
    const observer = new MutationObserver(sync);
    observer.observe(items, {
        attributes: true,
        attributeFilter: ['aria-busy']
    });
    observer.observe(panel, {
        attributes: true,
        attributeFilter: ['data-list-coverage']
    });
    sync();
}

function isCreateListPanelReady(): boolean {
    const panel = document.querySelector('.jhs-list-panel') as HTMLElement | null;
    const items = document.querySelector('.jhs-list-panel__items');
    return (
        panel?.dataset.listCoverage === 'complete' &&
        items?.getAttribute('aria-busy') === 'false' &&
        Boolean(getCurrentListContainer()?.querySelector('input[data-list-id]'))
    );
}

/**
 * 绑定新增清单 UI 的事件。
 */
function bindCreateListEvents(wrap: HTMLElement): void {
    const btn = wrap.querySelector('.jhs-list-create-btn') as HTMLButtonElement;
    const form = wrap.querySelector('.jhs-list-create-form') as HTMLElement;
    const input = wrap.querySelector('.jhs-list-create-input') as HTMLInputElement;
    const saveBtn = wrap.querySelector('.jhs-list-create-save') as HTMLButtonElement;
    const cancelBtn = wrap.querySelector('.jhs-list-create-cancel') as HTMLButtonElement;

    btn.addEventListener('click', () => {
        btn.style.display = 'none';
        btn.setAttribute('aria-expanded', 'true');
        form.style.display = 'inline-flex';
        input.value = '';
        input.focus();
    });

    cancelBtn.addEventListener('click', () => {
        if (_createListInFlight) return;
        restoreCreateListUi();
    });

    saveBtn.addEventListener('click', async () => {
        if (_createListInFlight) return;
        if (!isCreateListPanelReady()) {
            showToast('清单仍在载入，请稍后再新建', 'warning');
            return;
        }
        const name = input.value.trim();
        if (!name) {
            showToast('请输入清单名称', 'warning');
            input.focus();
            return;
        }
        _createListInFlight = true;
        setCreateListBusy(wrap, true);
        let result: CreateListResult = 'failed';
        try {
            result = await createList(name);
        } catch (error) {
            console.error(`${LOG_PREFIX} 新增清单发生未处理异常`, error);
            showToast('✗ 新增清单失败，请稍后重试', 'error');
        } finally {
            _createListInFlight = false;
            setCreateListBusy(wrap, false);
        }
        if (result !== 'created') input.focus();
    });

    input.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.isComposing) return;
        if (e.key === 'Enter') {
            e.preventDefault();
            saveBtn.click();
        } else if (e.key === 'Escape') {
            cancelBtn.click();
        }
    });
}

/** 更新新增清单表单的提交状态，保留失败时的名称供直接重试。 */
function setCreateListBusy(wrap: HTMLElement, busy: boolean): void {
    const input = wrap.querySelector('.jhs-list-create-input') as HTMLInputElement | null;
    const saveBtn = wrap.querySelector('.jhs-list-create-save') as HTMLButtonElement | null;
    const cancelBtn = wrap.querySelector('.jhs-list-create-cancel') as HTMLButtonElement | null;
    wrap.setAttribute('aria-busy', String(busy));
    if (input) input.disabled = busy;
    if (saveBtn) {
        saveBtn.disabled = busy;
        saveBtn.textContent = busy ? '新建中…' : '新建';
    }
    if (cancelBtn) cancelBtn.disabled = busy;
}
