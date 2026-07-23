/**
 * 新增清单功能 —— 展开面板下「➕ 新增清单」UI + 创建 + 自动关联。
 *
 * 提取自 vlt-sync.tsx（setupCreateListButton 集群）：
 * - setupCreateListButton：在 .jhs-list-panel 后插入新增清单 UI
 * - bindCreateListEvents / bindCreateListAvailability：事件绑定 + 可用性同步
 * - createList：GM_xmlhttpRequest POST /lists/remote_create + 多级兜底定位新 checkbox
 * - finishCreateList：完成态 toast + 刷新平铺面板 + 本地 IDB 同步
 *
 * 背景：原生「存入清单」模态框被 CSS 永久隐藏，footer「創建新清单」按钮不可达。
 * 改用 GM_xmlhttpRequest 绕过原生表单链路（JavDB 已迁移 Turbo，data-remote 失效）。
 */

import { jsxToString } from '../../core/jsx-to-string';

import { VltCreateListForm } from '../../components/misc/vlt-create-list-form';

import { handleCheckboxChange } from './vlt-checkbox';
import { fetchAuthoritativeCheckboxState } from './vlt-server';
import {
    getCurrentListContainer,
    getListInfo,
    getMovieInfo,
    LOG_PREFIX,
    normalizeListName,
    refreshListPanel,
    setListDisplayedCount
} from './vlt-helpers';
import { showToast } from './vlt-toast';

/** 新增清单 UI 是否已注入（幂等标记）。 */
let _createListUiInjected = false;
/** 新增清单请求是否进行中，避免 Enter 与按钮连击重复创建。 */
let _createListInFlight = false;

type CreateListResult = 'created' | 'failed' | 'unknown';

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
async function createList(listName: string): Promise<CreateListResult> {
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

    // ── CSRF token ──
    const csrfMeta = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null;
    const csrfToken = csrfMeta?.content || formData['authenticity_token'] || '';

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
    let responseText = '';
    try {
        responseText = await new Promise<string>((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: 'https://javdb.com/lists/remote_create',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                    Accept: 'text/javascript, application/javascript, application/ecmascript, application/x-ecmascript, */*;q=0.01',
                    'X-CSRF-Token': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest'
                },
                data: Object.entries(formData)
                    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
                    .join('&'),
                timeout: 15000,
                onload: (r) => {
                    if (r.status >= 200 && r.status < 300) {
                        resolve(r.responseText || '');
                    } else {
                        reject(
                            new Error(`HTTP ${r.status}: ${r.responseText?.slice(0, 200) || ''}`)
                        );
                    }
                },
                onerror: () => reject(new Error('网络错误')),
                ontimeout: () => reject(new Error('请求超时'))
            });
        });
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

/**
 * 轮询检测 modal 内 listContainer 是否出现新增 checkbox。
 *
 * @param modal     #modal-save-list 元素
 * @param beforeIds 提交前快照的 data-list-id 集合
 * @param timeoutMs 超时毫秒
 * @returns 新增的 checkbox 数组（超时则为空数组）
 */
function pollForNewCheckboxes(
    modal: Element,
    beforeIds: Set<string | undefined>,
    timeoutMs: number
): Promise<HTMLInputElement[]> {
    return new Promise((resolve) => {
        const start = Date.now();
        const check = () => {
            const lc = modal.querySelector('[data-list-target="listContainer"]');
            if (lc) {
                const after = Array.from(
                    lc.querySelectorAll('input[type="checkbox"][data-list-id]')
                ) as HTMLInputElement[];
                const newOnes = after.filter((cb) => !beforeIds.has(cb.dataset.listId));
                if (newOnes.length > 0) {
                    resolve(newOnes);
                    return;
                }
            }
            if (Date.now() - start < timeoutMs) {
                setTimeout(check, 100);
            } else {
                resolve([]);
            }
        };
        check();
    });
}

function findCurrentListCheckbox(listId: string): HTMLInputElement | null {
    const container = getCurrentListContainer();
    if (!container) return null;
    return (
        Array.from(
            container.querySelectorAll<HTMLInputElement>(
                'input[type="checkbox"][data-list-id]'
            )
        ).find((input) => input.dataset.listId === listId) || null
    );
}

/** 只有轻量权威接口确认“名称精确匹配且已勾选”，才允许提交新建后的本地关联。 */
async function resolveAuthoritativeCreatedCheckbox(
    listId: string,
    listName: string,
    videoId: string,
    beforeIds: ReadonlySet<string | undefined>
): Promise<HTMLInputElement | null> {
    if (!listId || !videoId || beforeIds.has(listId)) return null;
    const authoritative = await fetchAuthoritativeCheckboxState(videoId, listId);
    if (
        !authoritative?.checked ||
        !authoritative.name ||
        normalizeListName(authoritative.name) !== normalizeListName(listName) ||
        (authoritative.count !== null && authoritative.count < 1)
    ) {
        return null;
    }

    let input = findCurrentListCheckbox(listId);
    if (!input) {
        const container = getCurrentListContainer();
        input = container
            ? manuallyBuildCheckbox(
                  container,
                  listId,
                  authoritative.name,
                  videoId,
                  authoritative.count ?? 1
              )
            : null;
    }
    if (!input) return null;
    input.checked = true;
    if (authoritative.count !== null) {
        setListDisplayedCount(listId, authoritative.count);
    }
    return input;
}

/** 多个 DOM 候选必须最终只权威确认出一个清单，拒绝数组式盲写。 */
async function resolveCreatedListCheckbox(
    candidates: HTMLInputElement[],
    listName: string,
    videoId: string,
    beforeIds: ReadonlySet<string | undefined>
): Promise<HTMLInputElement | null> {
    const candidateIds = Array.from(
        new Set(candidates.map((input) => input.dataset.listId).filter(Boolean) as string[])
    );
    const confirmed: HTMLInputElement[] = [];
    for (const listId of candidateIds) {
        const input = await resolveAuthoritativeCreatedCheckbox(
            listId,
            listName,
            videoId,
            beforeIds
        );
        if (input) confirmed.push(input);
    }
    if (confirmed.length === 1) return confirmed[0];
    if (confirmed.length > 1) {
        console.warn(`${LOG_PREFIX} 新建清单出现多个权威候选，拒绝写入本地`, candidateIds);
    }
    return null;
}

/**
 * 通过 GET /users/lists 查找指定名称的清单 ID。
 *
 * JavDB 的 /lists/remote_create 响应仅返回 Toastr.success("...") JS，
 * 不含新清单的 list-id。为完成本地 IDB 同步，需额外请求 /users/lists
 * 页面，解析其中指向 /lists/{id} 的链接，匹配清单名称后提取 id。
 *
 * @param listName 新清单名称
 * @returns list-id 字符串，找不到返回 null
 */
async function fetchListIdByName(listName: string): Promise<string | null> {
    try {
        const html: string = await new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: 'https://javdb.com/users/lists',
                timeout: 10000,
                onload: (r) => {
                    if (r.status >= 200 && r.status < 300) {
                        resolve(r.responseText || '');
                    } else {
                        reject(new Error(`HTTP ${r.status}`));
                    }
                },
                onerror: () => reject(new Error('网络错误')),
                ontimeout: () => reject(new Error('请求超时'))
            });
        });

        const doc = new DOMParser().parseFromString(html, 'text/html');

        let links = doc.querySelectorAll('a[href*="/lists/"]');
        if (links.length === 0) {
            links = doc.querySelectorAll('[href*="/lists/"]');
        }

        console.log(`${LOG_PREFIX} /users/lists 页面解析到 ${links.length} 条 /lists/ 链接`);

        const matchedIds = new Set<string>();
        const expectedName = normalizeListName(listName);
        for (const link of Array.from(links)) {
            const href = (link as Element).getAttribute('href') || '';
            const m = href.match(/\/lists\/([^/?#]+)/);
            if (!m) continue;
            const id = m[1];
            if (id === 'users' || id === '' || id === 'new') continue;
            const text = ((link as Element).textContent || '').replace(/\s*\(\d+\)\s*$/, '');
            if (normalizeListName(text) === expectedName) {
                matchedIds.add(id);
            }
        }
        if (matchedIds.size === 1) {
            const [id] = matchedIds;
            console.log(`${LOG_PREFIX} /users/lists 精确匹配清单「${listName}」→ list_id=${id}`);
            return id;
        }
        if (matchedIds.size > 1) {
            console.warn(`${LOG_PREFIX} /users/lists 存在重名清单，拒绝猜测 list-id`, matchedIds);
            return null;
        }

        const bodyText = doc.body?.textContent?.slice(0, 1000) || '';
        console.warn(
            `${LOG_PREFIX} /users/lists 未精确找到「${listName}」（共 ${links.length} 条链接）。` +
                `页面文本前 500 字: ${bodyText.slice(0, 500)}`
        );
        return null;
    } catch (err: unknown) {
        console.error(`${LOG_PREFIX} 获取 /users/lists 失败`, err);
        return null;
    }
}

/**
 * 手动构建新清单的 checkbox 并插入 listContainer（兜底方案）。
 *
 * 克隆 listContainer 内已有的一个 checkbox <label>，修改 data-list-id /
 * value / 文案 / checked，插入 listContainer 末尾。
 */
function manuallyBuildCheckbox(
    listContainer: HTMLElement,
    listId: string,
    listName: string,
    videoId: string,
    count: number
): HTMLInputElement | null {
    const duplicate = Array.from(
        listContainer.querySelectorAll<HTMLInputElement>(
            'input[type="checkbox"][data-list-id]'
        )
    ).find((input) => input.dataset.listId === listId);
    if (duplicate) {
        duplicate.checked = true;
        return duplicate;
    }

    const existingCb = listContainer.querySelector(
        'input[type="checkbox"][data-list-id]'
    ) as HTMLInputElement | null;
    if (!existingCb) return null;
    const existingLabel = existingCb.closest('label');
    if (!existingLabel) return null;

    const existingEntry = existingLabel.closest('p.control') || existingLabel;
    const clone = existingEntry.cloneNode(true) as HTMLElement;
    const label = (clone.matches('label') ? clone : clone.querySelector('label')) as
        | HTMLLabelElement
        | null;
    const cb = label?.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    if (!label || !cb) return null;
    cb.dataset.listId = listId;
    cb.value = videoId;
    cb.checked = true;
    cb.disabled = false;
    cb.removeAttribute('id');
    cb.removeAttribute('disabled');
    delete cb.dataset.vltWasDisabled;
    cb.removeAttribute('aria-busy');
    label.removeAttribute('for');

    for (const node of Array.from(label.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE) node.remove();
    }
    const countSpan = label.querySelector('span') as HTMLElement | null;
    const nameNode = document.createTextNode(` ${listName} `);
    if (cb.parentNode === label) label.insertBefore(nameNode, cb.nextSibling);
    else label.appendChild(nameNode);
    if (countSpan) {
        countSpan.textContent = `(${count})`;
    } else {
        const createdCount = document.createElement('span');
        createdCount.textContent = `(${count})`;
        label.appendChild(createdCount);
    }

    listContainer.appendChild(clone);
    return cb;
}

/**
 * 新建清单完成态：toast + 刷新平铺面板 + 触发本地 IDB 同步 + 还原 UI。
 *
 * @param checkbox 权威确认后的唯一新增 checkbox
 * @param listName 新清单名称（用于 toast 文案）
 */
function finishCreateList(checkbox: HTMLInputElement, listName: string): void {
    const modal = document.querySelector('#modal-save-list');
    if (modal) {
        try {
            const cancelLink = modal.querySelector(
                'a[data-action="list#cancelNewList"]'
            ) as HTMLAnchorElement | null;
            cancelLink?.click();
        } catch {}
    }

    restoreCreateListUi();
    showToast(`✓ 清单「${listName}」已新建，并已关联当前影片`, 'success');

    refreshListPanel();

    const movieInfo = getMovieInfo(checkbox.value);
    if (!movieInfo) {
        console.warn(`${LOG_PREFIX} 新建清单后无法取得影片资讯，跳过同步`, checkbox);
        return;
    }
    const listInfo = getListInfo(checkbox.dataset.listId || '');
    if (!listInfo.info.name) {
        console.warn(
            `${LOG_PREFIX} 新建清单后无法从 DOM 取得清单名称，使用传入名称「${listName}」`
        );
        listInfo.info.name = listName;
    }
    handleCheckboxChange(movieInfo, listInfo, true, { serverConfirmed: true }).then();
}

/**
 * 还原「新增清单」展开 UI 到初始按钮态。幂等。
 */
function restoreCreateListUi(): void {
    const w = document.querySelector('.jhs-list-create-wrap') as HTMLElement | null;
    if (!w) return;
    const activeElement = document.activeElement;
    const shouldRestoreFocus =
        !activeElement || activeElement === document.body || w.contains(activeElement);
    const btn = w.querySelector('.jhs-list-create-btn') as HTMLButtonElement | null;
    const f = w.querySelector('.jhs-list-create-form') as HTMLElement | null;
    const inp = w.querySelector('.jhs-list-create-input') as HTMLInputElement | null;
    if (btn) {
        btn.style.display = 'inline-flex';
        btn.setAttribute('aria-expanded', 'false');
    }
    if (f) f.style.display = 'none';
    if (inp) inp.value = '';
    if (btn && shouldRestoreFocus) btn.focus({ preventScroll: true });
}
