/** 创建后的目录确认、DOM 补齐与原生完成态；批量路径不调用此处的 UI/本地写入。 */
import { handleCheckboxChange } from '../vlt-checkbox';
import { getCurrentListContainer, getListInfo, getMovieInfo, LOG_PREFIX, normalizeListName, refreshListPanel, setListDisplayedCount } from '../vlt-helpers';
import { showToast } from '../vlt-toast';
import { fetchAuthoritativeCheckboxState } from './vlt-server-api';

export function pollForNewCheckboxes(
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

/** 只有轻量权威接口确认"名称精确匹配且已勾选"，才允许提交新建后的本地关联。 */
export async function resolveAuthoritativeCreatedCheckbox(
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
export async function resolveCreatedListCheckbox(
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
export async function fetchListIdByName(listName: string): Promise<string | null> {
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
export function finishCreateList(checkbox: HTMLInputElement, listName: string): void {
    const modal = document.querySelector('#modal-save-list');
    if (modal) {
        try {
            const cancelLink = modal.querySelector(
                'a[data-action="list#cancelNewList"]'
            ) as HTMLAnchorElement | null;
            cancelLink?.click();
        } catch { /* ignore */ }
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
export function restoreCreateListUi(): void {
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
