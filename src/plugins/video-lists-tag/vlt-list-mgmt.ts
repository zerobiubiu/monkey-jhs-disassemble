/**
 * 清单管理 —— /users/lists 页面删除/改名清单 → 同步本地 IDB + 广播。
 *
 * 提取自 vlt-sync.tsx（doc/61 集群）：
 * - setupListManagementListener：拦截删除链接 + 改名保存按钮
 * - handleListDeletion：DELETE /users/remove_list → VltDb.deleteList → 广播
 * - handleListRename：POST /users/update_list → VltDb.renameList → 广播
 * - removeDetailPageCheckbox / updateDetailPageCheckboxLabel：详情页 DOM 更新
 *
 * 方案：拦截原生操作 + 自行发 GM_xmlhttpRequest + 实时三重广播。
 * 不用 MutationObserver 等 DOM 移除——JavDB 删除后不实时移除 <li>。
 */

import { VltDb } from './vlt-db';
import { showToast } from './vlt-toast';
import { broadcastListMgmt } from './vlt-broadcast';
import {
    extractListIdFromHref,
    getCsrfToken,
    LOG_PREFIX,
    refreshListPanel
} from './vlt-helpers';

/**
 * 在 /users/lists 页面监听清单删除与改名，同步本地 IndexedDB。
 *
 * DOM 结构（每个清单条目）：
 * <li class="list-item columns" id="list-<listId>">
 *   <div class="column is-10">
 *     <a href="/lists/<listId>"><strong class="list-name">清单名</strong></a>
 *   </div>
 *   <div class="column is-2">
 *     <div class="operation field has-addons">
 *       <p class="control"><button ...>分享</button></p>
 *       <p class="control"><button data-list-id="<listId>" class="modal-edit-list-button">修改</button></p>
 *       <p class="control"><a href="/users/remove_list?id=<listId>" data-method="delete" data-remote="true" data-confirm="...">刪除</a></p>
 *     </div>
 *   </div>
 * </li>
 *
 * 编辑弹窗（Stimulus list 控制器管理）：
 * #modal-edit-list > .modal-card
 *   input[data-list-target="inputName"]  ← 清单名称输入框
 *   input[type=hidden][data-list-target="inputId"]  ← 清单 ID 隐藏域
 *   button[data-action="list#updateList"] ← 保存按钮
 *
 * 服务端 API（从 app.js 逆向确认）：
 * - 删除：DELETE /users/remove_list?id=<listId>，Rails UJS dataType=script
 * - 改名：POST /users/update_list {id, name}，返回 JSON {success, name, message}
 */
export function setupListManagementListener(): void {
    console.log(`${LOG_PREFIX} /users/lists 清单管理监听已启动`);

    // ===== 删除：拦截删除链接 click → 自行发 GM_xmlhttpRequest DELETE =====
    document.addEventListener(
        'click',
        (e: Event) => {
            const target = e.target as HTMLElement;
            const deleteLink = target.closest?.(
                'a[href*="remove_list"][data-method="delete"]'
            ) as HTMLAnchorElement | null;
            if (!deleteLink) return;

            e.preventDefault();
            e.stopPropagation();

            const href = deleteLink.getAttribute('href') || '';
            const listId = extractListIdFromHref(href);
            if (!listId) {
                console.warn(`${LOG_PREFIX} 删除链接无法提取 listId: ${href}`);
                return;
            }

            const confirmMsg = deleteLink.dataset.confirm || '確認移除嗎?';
            if (!confirm(confirmMsg)) return;

            handleListDeletion(listId, href).then();
        },
        true
    );

    // ===== 改名：拦截保存按钮 click → 自行发 GM_xmlhttpRequest POST =====
    const editing: { listId: string; oldName: string } = { listId: '', oldName: '' };

    document.addEventListener(
        'click',
        (e: Event) => {
            const target = e.target as HTMLElement;
            const editBtn = target.closest?.('.modal-edit-list-button') as HTMLElement | null;
            if (!editBtn) return;
            const listId = editBtn.dataset.listId || '';
            if (!listId) return;
            const li = editBtn.closest('[id^="list-"]');
            const nameEl = li?.querySelector('.list-name');
            editing.listId = listId;
            editing.oldName = nameEl?.textContent?.trim() || '';
            console.log(`${LOG_PREFIX} 编辑清单快照: listId=${listId} oldName=${editing.oldName}`);
        },
        true
    );

    document.addEventListener(
        'click',
        (e: Event) => {
            const target = e.target as HTMLElement;
            const saveBtn = target.closest?.(
                '[data-action="list#updateList"]'
            ) as HTMLElement | null;
            if (!saveBtn) return;

            e.preventDefault();
            e.stopPropagation();

            if (!editing.listId) {
                console.warn(`${LOG_PREFIX} 保存清单改名但无快照，跳过`);
                return;
            }
            const modal = document.querySelector('#modal-edit-list');
            const nameInput = modal?.querySelector(
                '[data-list-target="inputName"]'
            ) as HTMLInputElement | null;
            const newName = nameInput?.value?.trim() || '';
            if (!newName) {
                showToast('請輸入清單名稱', 'warning');
                return;
            }
            if (newName === editing.oldName) {
                console.log(`${LOG_PREFIX} 清单改名前后名称相同（${newName}），跳过`);
                closeEditModal();
                return;
            }

            handleListRename(editing.listId, newName).then();
        },
        true
    );
}

/**
 * 关闭编辑弹窗（模拟 Stimulus 关闭：移除 is-active 类 + 重置 body）。
 */
function closeEditModal(): void {
    const modal = document.querySelector('#modal-edit-list');
    if (!modal) return;
    modal.classList.remove('is-active');
    document.documentElement.classList.remove('is-clipped');
}

/**
 * 处理清单删除：先确认 JavDB 删除成功 → 删 IDB → 广播 + toast。
 *
 * @param listId 清单 ID
 * @param href 删除链接的 href（/users/remove_list?id=<listId>）
 */
async function handleListDeletion(listId: string, href: string): Promise<void> {
    const csrfToken = getCsrfToken();
    if (!csrfToken) {
        showToast('✗ 无法获取 CSRF token，删除失败', 'error');
        return;
    }

    console.log(`${LOG_PREFIX} ═══ 删除清单 listId=${listId} ═══`);

    showToast('正在同步删除…', 'info');

    const serverOk = await sendDeleteRequest(href, csrfToken);
    if (!serverOk) {
        showToast('✗ JavDB 删除清单失败，本地数据未改动', 'error');
        return;
    }

    const idbResult = await VltDb.deleteList(listId);
    document.querySelector(`#list-${listId}`)?.remove();

    console.log(
        `${LOG_PREFIX} 删除完成: listId=${listId} server=${serverOk} inventory=${idbResult.inventory} associations=${idbResult.associations}`
    );

    broadcastListMgmt('delete', listId);

    showToast(`✓ 清单已删除（${idbResult.associations} 条关联已清除）`, 'success');
    console.log(`${LOG_PREFIX} ═══ 删除完成 ═══`);
}

/**
 * 发送 DELETE 请求到 JavDB 服务器删除清单。
 */
function sendDeleteRequest(href: string, csrfToken: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
        GM_xmlhttpRequest({
            method: 'DELETE',
            url: window.location.origin + href,
            headers: {
                'X-CSRF-Token': csrfToken,
                'X-Requested-With': 'XMLHttpRequest',
                Accept: 'text/javascript, application/javascript, application/xhtml+xml, */*'
            },
            timeout: 15000,
            onload: (r) => resolve(r.status >= 200 && r.status < 400),
            onerror: () => resolve(false),
            ontimeout: () => resolve(false)
        });
    });
}

/**
 * 处理清单改名：发 POST /users/update_list → 成功后同步 IDB + 广播 + 更新 DOM + toast。
 *
 * @param listId 清单 ID
 * @param newName 新清单名称
 */
async function handleListRename(listId: string, newName: string): Promise<void> {
    const csrfToken = getCsrfToken();
    if (!csrfToken) {
        showToast('✗ 无法获取 CSRF token，改名失败', 'error');
        return;
    }

    showToast('正在改名…', 'info');
    console.log(`${LOG_PREFIX} ═══ 改名清单 listId=${listId} newName=${newName} ═══`);

    try {
        const response = await new Promise<{ success: boolean; name: string; message: string }>(
            (resolve) => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: 'https://javdb.com/users/update_list',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                        'X-CSRF-Token': csrfToken,
                        'X-Requested-With': 'XMLHttpRequest',
                        Accept: 'application/json, text/javascript, */*;q=0.01'
                    },
                    data: `id=${encodeURIComponent(listId)}&name=${encodeURIComponent(newName)}`,
                    timeout: 15000,
                    onload: (r) => {
                        if (r.status >= 200 && r.status < 300) {
                            try {
                                resolve(JSON.parse(r.responseText));
                            } catch {
                                resolve({
                                    success: false,
                                    name: '',
                                    message: '响应解析失败'
                                });
                            }
                        } else {
                            resolve({
                                success: false,
                                name: '',
                                message: `HTTP ${r.status}`
                            });
                        }
                    },
                    onerror: () => resolve({ success: false, name: '', message: '网络错误' }),
                    ontimeout: () => resolve({ success: false, name: '', message: '请求超时' })
                });
            }
        );

        if (!response.success) {
            showToast(`✗ 改名失败：${response.message || '未知错误'}`, 'error');
            return;
        }

        const finalName = response.name || newName;
        console.log(`${LOG_PREFIX} 服务端改名成功: listId=${listId} name=${finalName}`);

        const ok = await VltDb.renameList(listId, finalName);
        if (ok) {
            console.log(`${LOG_PREFIX} IDB 清单改名完成: listId=${listId} name=${finalName}`);
        } else {
            console.warn(`${LOG_PREFIX} IDB 清单改名跳过: listId=${listId} 不在本地 inventory 中`);
        }

        broadcastListMgmt('rename', listId, { newName: finalName });

        const nameEl = document.querySelector(`#list-${listId} .list-name`);
        if (nameEl) {
            nameEl.textContent = finalName;
        }

        closeEditModal();

        showToast(`✓ 清单已改名为「${finalName}」`, 'success');
        console.log(`${LOG_PREFIX} ═══ 改名完成 ═══`);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '未知错误';
        console.error(`${LOG_PREFIX} 清单改名失败: listId=${listId}`, err);
        showToast(`✗ 清单改名失败：${message}`, 'error');
    }
}

/**
 * 详情页：移除指定清单的 checkbox（从 .jhs-list-panel 和 #modal-save-list 两处）。
 * @param listId 清单 ID
 */
export function removeDetailPageCheckbox(listId: string): void {
    const panelCb = document.querySelector(`.jhs-list-panel input[data-list-id="${listId}"]`);
    if (panelCb) {
        panelCb.closest('p.control')?.remove() || panelCb.closest('label')?.remove();
    }
    const modalCb = document.querySelector(`#modal-save-list input[data-list-id="${listId}"]`);
    if (modalCb) {
        modalCb.closest('p.control')?.remove() || modalCb.closest('label')?.remove();
    }
    refreshListPanel();
    console.log(`${LOG_PREFIX} 详情页已移除清单 ${listId} 的 checkbox`);
}

/**
 * 详情页：更新指定清单 checkbox 的标签文本。
 * @param listId 清单 ID
 * @param newName 新清单名称
 */
export function updateDetailPageCheckboxLabel(listId: string, newName: string): void {
    const checkboxes = document.querySelectorAll(`input[data-list-id="${listId}"]`);
    checkboxes.forEach((cb: Element) => {
        const label = cb.closest('label');
        if (!label) return;
        const displayName = label.querySelector('.jhs-list-item__name');
        if (displayName) {
            displayName.textContent = newName;
            return;
        }
        Array.from(label.childNodes).forEach((node: Node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                node.textContent = '';
            }
        });
        const inputEl = label.querySelector('input');
        if (inputEl && inputEl.nextSibling) {
            inputEl.nextSibling.textContent = `\u00A0\n    ${newName}\u00A0\n    `;
        } else if (inputEl) {
            inputEl.insertAdjacentText('afterend', `\u00A0${newName}\u00A0`);
        }
    });
    refreshListPanel();
    console.log(`${LOG_PREFIX} 详情页已更新清单 ${listId} 的标签为「${newName}」`);
}
