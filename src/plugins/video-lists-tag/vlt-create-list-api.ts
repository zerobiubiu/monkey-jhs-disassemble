/**
 * 新增清单功能 —— 创建请求 + 多级兜底定位 + 完成态处理。
 *
 * 提取自 vlt-create-list.tsx：
 * - createList：GM_xmlhttpRequest POST /lists/remote_create + 多级兜底定位新 checkbox
 * - finishCreateList：完成态 toast + 刷新平铺面板 + 本地 IDB 同步
 * - restoreCreateListUi：还原「新增清单」展开 UI 到初始按钮态
 *
 * 背景：原生「存入清单」模态框被 CSS 永久隐藏，footer「創建新清单」按钮不可达。
 * 改用 GM_xmlhttpRequest 绕过原生表单链路（JavDB 已迁移 Turbo，data-remote 失效）。
 */

import { getCsrfTokenWithFormFallback } from '../../core/util/site/csrf';

import { LOG_PREFIX, refreshListPanel } from './vlt-helpers';
import { showToast } from './vlt-toast';
import { requestCreateList } from './server/vlt-create-request';
import { pollForNewCheckboxes, resolveAuthoritativeCreatedCheckbox, resolveCreatedListCheckbox, fetchListIdByName, finishCreateList } from './server/vlt-create-confirm';

export { restoreCreateListUi } from './server/vlt-create-confirm';

export type CreateListResult = 'created' | 'failed' | 'unknown';

/**
 * 创建新清单并自动关联当前影片。
 *
 * doc/56 原方案驱动原生 #new_list 表单 submit，依赖 Rails UJS data-remote 拦截，
 * 但 JavDB 已迁移 Turbo → 常规表单 POST → 页面导航 → 脚本卸载。
 * doc/58-60 修复：GM_xmlhttpRequest + 多级兜底定位新 checkbox（轮询 listContainer →
 * 响应正则提取 list-id → 切换 #save-list-button 重载 → GET /users/lists 匹配）。
 *
 * @param listName 新清单名称
 */
export async function createList(listName: string): Promise<CreateListResult> {
    const modal = document.querySelector('#modal-save-list');
    if (!modal) {
        showToast('✗ 未找到存入清单弹窗，请重新进入详情页', 'error');
        return 'failed';
    }
    const nameInput = modal.querySelector(
        'input[data-list-target="listNewNameInput"]'
    ) as HTMLInputElement | null;
    const form = modal.querySelector('#new_list') as HTMLFormElement | null;
    const listContainer = modal.querySelector(
        '[data-list-target="listContainer"]'
    ) as HTMLElement | null;
    if (!nameInput || !form || !listContainer) {
        showToast('✗ 清单新建表单未就绪，请重新进入详情页', 'error');
        return 'failed';
    }

    // ── 收集表单字段 ──
    const formData: Record<string, string> = {};
    Array.from(form.querySelectorAll('input, textarea, select')).forEach((el) => {
        const field = el as HTMLInputElement;
        if (
            field.name &&
            field.type !== 'submit' &&
            field.type !== 'button' &&
            field.type !== 'reset'
        ) {
            formData[field.name] = field.value;
        }
    });
    // 用新清单名覆盖名称字段（nameInput.name 通常是 list[name]）
    if (nameInput.name) {
        formData[nameInput.name] = listName;
    }

    // ── CSRF token（meta 优先，表单字段兜底；共享实现见 core/util/site/csrf）──
    const csrfToken = getCsrfTokenWithFormFallback(formData);

    // ── 提交前快照 ──
    const beforeIds = new Set(
        Array.from(listContainer.querySelectorAll('input[type="checkbox"][data-list-id]')).map(
            (el) => (el as HTMLInputElement).dataset.listId
        )
    );
    const videoId =
        formData['video_id'] ||
        (form.querySelector('input[name="video_id"]') as HTMLInputElement | null)?.value ||
        '';
    if (!videoId) {
        showToast('✗ 无法识别当前影片，清单未新建', 'error');
        return 'failed';
    }

    showToast('正在新建清单…', 'info');
    console.log(`${LOG_PREFIX} ═══ 新增清单「${listName}」(video_id=${videoId}) ═══`);

    // ── 发送 ajax 请求 ──
    let responseText: string;
    try {
        responseText = await requestCreateList(formData, csrfToken);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '请稍后重试';
        console.error(`${LOG_PREFIX} 新增清单失败`, err);
        showToast(`✗ 新建清单失败：${message}`, 'error');
        return 'failed';
    }

    console.log(`${LOG_PREFIX} 服务端响应（前 500 字）: ${responseText.slice(0, 500)}`);

    // ── 在页面上下文执行 JS 响应 ──
    if (responseText.trim()) {
        try {
            const script = document.createElement('script');
            script.textContent = responseText;
            (document.body || document.documentElement).appendChild(script);
            script.remove();
            console.log(`${LOG_PREFIX} JS 响应已注入执行`);
        } catch (e) {
            console.warn(`${LOG_PREFIX} JS 响应注入失败`, e);
        }
    }
    if (/\btoastr\s*(?:\.\s*error|\[\s*['"]error['"]\s*\])\s*\(/i.test(responseText)) {
        showToast('✗ JavDB 拒绝新建清单，请检查名称后重试', 'error');
        return 'failed';
    }

    // ── 快速检测列表是否被 JS 响应直接更新（最多 200ms） ──
    let newCheckboxes = await pollForNewCheckboxes(modal, beforeIds, 200);
    if (newCheckboxes.length > 0) {
        console.log(`${LOG_PREFIX} 侦测到 ${newCheckboxes.length} 个新 checkbox，走正常完成流程`);
        const confirmedCheckbox = await resolveCreatedListCheckbox(
            newCheckboxes,
            listName,
            videoId,
            beforeIds
        );
        if (confirmedCheckbox) {
            finishCreateList(confirmedCheckbox, listName);
            return 'created';
        }
    }

    // ── 从响应提取 list-id（若响应含 HTML 片段） ──
    const listIdMatch = responseText.match(/data-list-id=["']([^"']+)["']/);
    if (listIdMatch) {
        const listId = listIdMatch[1];
        const confirmedCheckbox = await resolveAuthoritativeCreatedCheckbox(
            listId,
            listName,
            videoId,
            beforeIds
        );
        if (confirmedCheckbox) {
            console.log(`${LOG_PREFIX} 从响应提取并权威确认 list-id=${listId}`);
            finishCreateList(confirmedCheckbox, listName);
            return 'created';
        }
    }

    // ── 核心兜底：通过切换 #save-list-button 重新加载模态框的清单列表 ──
    console.log(`${LOG_PREFIX} 响应无 list-id，通过切换 #save-list-button 重载清单列表`);
    const saveListBtn = document.querySelector('#save-list-button') as HTMLElement | null;
    if (saveListBtn) {
        saveListBtn.click();
        await new Promise((r) => setTimeout(r, 200));
        saveListBtn.click();
        newCheckboxes = await pollForNewCheckboxes(modal, beforeIds, 5000);
        if (newCheckboxes.length > 0) {
            console.log(
                `${LOG_PREFIX} 重载后侦测到 ${newCheckboxes.length} 个新 checkbox，走正常完成流程`
            );
            const confirmedCheckbox = await resolveCreatedListCheckbox(
                newCheckboxes,
                listName,
                videoId,
                beforeIds
            );
            if (confirmedCheckbox) {
                finishCreateList(confirmedCheckbox, listName);
                return 'created';
            }
        }
    }

    // ── 最后兜底：尝试 GET /users/lists 查找 list-id ──
    console.log(`${LOG_PREFIX} 按钮重载未找到新 checkbox，尝试 /users/lists 作为最后手段`);
    const listId = await fetchListIdByName(listName);
    if (listId) {
        const confirmedCheckbox = await resolveAuthoritativeCreatedCheckbox(
            listId,
            listName,
            videoId,
            beforeIds
        );
        if (confirmedCheckbox) {
            console.log(`${LOG_PREFIX} 从 /users/lists 查得并权威确认 list_id=${listId}`);
            finishCreateList(confirmedCheckbox, listName);
            return 'created';
        }
    }

    // ── 全部失败 ──
    console.error(
        `${LOG_PREFIX} 新增清单后无法定位新 checkbox。响应前 300 字: ${responseText.slice(0, 300)}`
    );
    refreshListPanel();
    showToast(`⚠ 清单「${listName}」可能已新建，请刷新页面确认`, 'warning');
    return 'unknown';
}
