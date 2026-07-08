/**
 * 同步逻辑模块 —— 清单 checkbox 勾选/取消 → IDB 同步 + 三重广播。
 *
 * 提取自 archetype/listsOptionSync.user.js L334-600（getMovieInfo/getListInfo/
 * syncMoviesLists/handleCheckboxChange + change 事件监听）。
 *
 * 原脚本通过 GM_xmlhttpRequest POST /api/sync/movies_lists 同步到远程服务器，
 * 此处改为调用 VltDb.sync() 写入本地 IndexedDB（寄生 JAV-JHS/appData）。
 *
 * 三重广播机制保留（GM_setValue/localStorage/CustomEvent），通知 VltTags
 * 自动刷新标签显示。跨标签页同步通过 GM_addValueChangeListener 实现。
 */

import { VltDb, type SyncResult } from './vlt-db';
import { showToast } from './vlt-toast';
import { FAVORITE_ACTION } from '../../constants/status';

/** 日志前缀。 */
const LOG_PREFIX = '[JavDB]';

/** 同步事件广播键。 */
const LAST_SYNC_KEY = 'jdb:last-sync';

/** 触发自动收藏的清单名称关键词（清单名称包含此词时，添加视频自动收藏）。 */
const AUTO_FAVORITE_KEYWORD = '等待更新';

/** association → toast 映射。 */
const ASSOC_TOAST: Record<
    string,
    (des: string, lname: string, created: string[]) => { msg: string; type: 'success' | 'error' }
> = {
    created: (des: string, lname: string, created: string[]) => {
        const extra = created.length > 0 ? `（已登记${created.join('和')}）` : '';
        return { msg: `✓ [${des}] 已添加至「${lname}」${extra}`, type: 'success' };
    },
    existed: (des: string, lname: string) => ({
        msg: `✓ [${des}] 已在「${lname}」中，数据一致`,
        type: 'success'
    }),
    limit_exceeded: (des: string, lname: string) => ({
        msg: `✗ [${des}]「${lname}」已达收藏上限（501 条）`,
        type: 'error'
    }),
    deleted: (des: string, lname: string) => ({
        msg: `✓ [${des}] 已从「${lname}」移除`,
        type: 'success'
    }),
    unchanged: (des: string, lname: string) => ({
        msg: `✓ [${des}] 未关联「${lname}」，数据一致`,
        type: 'success'
    })
};

/**
 * 从番号提取系列名（`-` 前部分）。
 * 对应原 L334-338。
 */
function getSeries(d: string): string {
    if (!d) return d;
    const i = d.indexOf('-');
    return i > 0 ? d.slice(0, i) : d;
}

/**
 * 从番号提取后缀编号（`-` 后部分）。
 * 对应原 L339-343。
 */
function getCode(d: string): string | null {
    if (!d) return null;
    const i = d.indexOf('-');
    return i > 0 ? d.slice(i + 1) : null;
}

/**
 * 从详情页提取评分。
 * 对应原 L344-355。
 * @returns 评分数值，找不到返回 0
 */
function getScore(): number {
    const spans = document.querySelectorAll('nav span');
    const found = Array.from(spans).find((s: Element) => s.textContent?.trim().endsWith('人評價'));
    if (!found) return 0.0;
    const m = found.innerHTML.match(/(\d+\.\d+)/);
    return m ? parseFloat(m[1]) : 0.0;
}

/** 缓存的评分（单次页面加载只计算一次）。 */
let _cachedScore: number | undefined;

/** 获取缓存的评分。 */
function getScoreCached(): number {
    if (_cachedScore === undefined) _cachedScore = getScore();
    return _cachedScore;
}

/**
 * 从详情页 DOM 提取影片信息。
 * 对应原 L364-405。
 * @param videoId 视频 ID（URL 末段）
 * @returns 影片信息或 null
 */
export function getMovieInfo(videoId: string): {
    designation: string;
    info: {
        href: string;
        title: string;
        release_date: string;
        cover_src: string;
        score: number;
        series: string;
        code: string;
    };
} | null {
    const detail = document.querySelector('.video-detail');
    if (!detail) {
        console.warn(`${LOG_PREFIX} 未找到 .video-detail，跳过`);
        return null;
    }

    const desEl = detail.querySelector('.panel-block.first-block a[data-clipboard-text]');
    if (!desEl) {
        console.warn(`${LOG_PREFIX} 未找到番号元素，跳过`);
        return null;
    }
    const designation = (desEl as HTMLElement).dataset.clipboardText || '';
    if (!designation) {
        console.warn(`${LOG_PREFIX} 番号为空，跳过`);
        return null;
    }
    const href = 'https://javdb.com/v/' + videoId;

    const titleEl = detail.querySelector('strong.current-title');
    const title = titleEl ? titleEl.innerHTML : '';

    const dateEl = detail.querySelector('.video-meta-panel nav > div:nth-child(2) > span');
    const release_date = dateEl ? dateEl.innerHTML : '';

    const coverEl = detail.querySelector('.column-video-cover img');
    const cover_src = coverEl ? (coverEl as HTMLImageElement).src : '';

    const score = getScoreCached();
    const series = getSeries(designation);
    const code = getCode(designation);

    return {
        designation,
        info: { href, title, release_date, cover_src, score, series, code: code || '' }
    };
}

/**
 * 从 DOM 提取清单名称。
 * 对应原 L407-424。
 */
function getListName(listId: string): string {
    const input = document.querySelector(
        `input[data-list-id="${listId}"]`
    ) as HTMLInputElement | null;
    if (!input) return '';
    const label = input.closest('label');
    if (!label) return '';
    return label.textContent
        .replace(/\(.*?\)/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * 获取清单信息。
 * 对应原 L426-430。
 */
export function getListInfo(listId: string): {
    list_id: string;
    info: { url: string; name: string };
} {
    const url = 'https://javdb.com/lists/' + listId + '?locale=zh';
    const name = getListName(listId);
    return { list_id: listId, info: { url, name } };
}

/**
 * 聚合同步：影片 upsert + 清单 upsert + 关联 add/remove。
 * 对应原 L438-481 的 syncMoviesLists，但调用 VltDb.sync() 替代 GM_xmlhttpRequest。
 *
 * @param movieInfo 影片信息（getMovieInfo 返回）
 * @param listInfo 清单信息（getListInfo 返回）
 * @param action "add" | "remove"
 * @returns SyncResult { movie, list, association }
 */
async function syncMoviesLists(
    movieInfo: NonNullable<ReturnType<typeof getMovieInfo>>,
    listInfo: ReturnType<typeof getListInfo>,
    action: 'add' | 'remove'
): Promise<SyncResult> {
    console.log(
        `${LOG_PREFIX} 同步(IDB): ${movieInfo.designation} → ${listInfo.info.name} (${action})`
    );

    const result = await VltDb.sync(
        movieInfo.designation,
        listInfo.list_id,
        {
            href: movieInfo.info.href,
            title: movieInfo.info.title,
            cover_src: movieInfo.info.cover_src,
            score: movieInfo.info.score,
            release_date: movieInfo.info.release_date,
            series: movieInfo.info.series,
            code: movieInfo.info.code
        },
        {
            url: listInfo.info.url,
            name: listInfo.info.name
        },
        action
    );

    console.log(
        `${LOG_PREFIX} 同步结果: movie=${result.movie} list=${result.list} association=${result.association}`
    );
    return result;
}

/** 防抖计时器映射。 */
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * 从详情页 DOM 提取演员名（与 BasePlugin.getPageInfo 的 actress 提取逻辑一致）。
 * 用于自动收藏时填充 CarRecord.names 字段。
 *
 * @returns 女演员名拼接字符串（空时返回空字符串）
 */
function getActressNames(): string {
    try {
        return $('.female')
            .prev()
            .map((_index: number, el: any) => $(el).text())
            .get()
            .join(' ')
            .trim();
    } catch {
        return '';
    }
}

/** 「想看/观看」状态变更广播键（与 DetailPageButtonPlugin.broadcastWantWatchedSync 一致）。 */
const WANT_WATCHED_SYNC_KEY = 'jdb:want-watched-sync';

/**
 * 广播「想看/观看」状态变更，与 DetailPageButtonPlugin.broadcastWantWatchedSync 等价。
 *
 * 三重通道：GM_setValue（跨标签页）/ localStorage（跨脚本同源）/ CustomEvent（同页面即时）。
 * 接收方为 DetailPageButtonPlugin.setupWantWatchedSyncListener，会：
 *   1. 详情页：showStatus 刷新菜单按钮文案（屏蔽/收藏/已观看）
 *   2. 列表页：refreshItemStatusTag 刷新匹配卡片 status-tag
 *
 * 自动收藏必须广播，才能让其他标签页/列表页/当前详情页同步刷新状态，
 * 与手动点击收藏（onWantAdded/quickConvertToFav）效果一致。
 *
 * @param carNum 番号
 * @param status 状态动作（FAVORITE_ACTION 等）
 * @param op 操作类型（'add' / 'remove'）
 */
function broadcastWantWatchedSync(carNum: string, status: string, op: 'add' | 'remove'): void {
    try {
        const payload = { carNum, status, op, time: Date.now() };
        const json = JSON.stringify(payload);
        // 1) GM 原生通道（跨标签页）
        try {
            GM_setValue(WANT_WATCHED_SYNC_KEY, json);
        } catch {}
        // 2) localStorage（跨脚本同源）
        try {
            localStorage.setItem(WANT_WATCHED_SYNC_KEY, json);
        } catch {}
        // 3) CustomEvent（同页面即时，DetailPageButtonPlugin.setupWantWatchedSyncListener 接收）
        try {
            document.dispatchEvent(new CustomEvent(WANT_WATCHED_SYNC_KEY, { detail: payload }));
        } catch {}
    } catch (err: any) {
        console.error(`${LOG_PREFIX} 自动收藏广播失败`, err);
    }
}

/**
 * 当向名称包含「等待更新」的清单添加视频时，自动将未收藏视频收藏。
 *
 * 策略（保守，不覆盖用户已设置的其它状态）：
 * - 记录不存在或 status 为空 → 自动收藏
 * - status 已是 FAVORITE_ACTION → 跳过（不重复收藏）
 * - status 为其它状态（屏蔽/已观看等）→ 跳过并提示
 *
 * 收藏成功后：
 * 1. 广播三重事件（与 onWantAdded/quickConvertToFav 一致），让当前详情页菜单按钮
 *    文案、其他标签页列表页 status-tag 同步刷新
 * 2. 通过 DetailPageButtonPlugin 调用 JavDB API 设为「想看」+ _syncRatingBar 刷新
 *    星标评分组件收藏状态（quickConvertToFav 同款事件链）
 *
 * @param movieInfo 影片信息（getMovieInfo 返回）
 * @param lname 清单名称
 */
async function autoFavoriteIfPendingUpdate(
    movieInfo: NonNullable<ReturnType<typeof getMovieInfo>>,
    lname: string
): Promise<void> {
    if (!lname.includes(AUTO_FAVORITE_KEYWORD)) return;

    const des = movieInfo.designation;
    try {
        const carRecord = await storageManager.getCar(des);
        if (carRecord && carRecord.status === FAVORITE_ACTION) {
            // 已收藏，跳过
            return;
        }
        if (carRecord && carRecord.status) {
            // 已有其它状态（屏蔽/已观看等），不覆盖
            showToast(`ℹ️ [${des}] 已标记为「${carRecord.status}」，跳过自动收藏`, 'info');
            return;
        }
        // 未收藏 → 自动收藏（写入 IndexedDB）
        await storageManager.saveCar({
            carNum: des,
            url: movieInfo.info.href,
            names: getActressNames(),
            actionType: FAVORITE_ACTION,
            publishTime: movieInfo.info.release_date
        });
        // 广播三重事件：让当前详情页 showStatus + 其他标签页 refreshItemStatusTag 同步刷新
        broadcastWantWatchedSync(des, FAVORITE_ACTION, 'add');
        showToast(`⭐ [${des}] 已自动收藏（添加至「${lname}」）`, 'success');
        console.log(`${LOG_PREFIX} 自动收藏: ${des}（触发清单：${lname}）`);
        // 联动星标评分组件：调 JavDB API 设为「想看」+ 刷新评分条收藏高亮
        // 与 quickConvertToFav 同款事件链（_reviewChain 串行化 + _wantWatchedSyncing 守卫）
        triggerJavdbWantAndSyncRatingBar(des);
    } catch (err: any) {
        console.error(`${LOG_PREFIX} 自动收藏失败: ${des}`, err);
        showToast(`✗ [${des}] 自动收藏失败：${err.message || '未知错误'}`, 'error');
    }
}

/**
 * 通过 DetailPageButtonPlugin 调用 JavDB API 设为「想看」并刷新星标评分组件。
 *
 * 复用 DetailPageButtonPlugin 的 _triggerJavdbWant（发 JavDB API 请求 + 执行 Rails JS
 * 同步更新 DOM）和 _syncRatingBar（从 .review-buttons DOM 检测 want 状态，刷新
 * 评分条收藏按钮高亮），与 quickConvertToFav 的事件链完全一致。
 *
 * 通过 _reviewChain 串行化（防止与 MutationObserver 竞争）+ _wantWatchedSyncing
 * 守卫（防止 onWantAdded 重复写入），均复用 DetailPageButtonPlugin 实例字段。
 *
 * @param carNum 番号（仅用于日志）
 */
function triggerJavdbWantAndSyncRatingBar(carNum: string): void {
    try {
        const detailPlugin: any = pluginManager?.getBean?.('DetailPageButtonPlugin');
        if (!detailPlugin) {
            console.warn(`${LOG_PREFIX} DetailPageButtonPlugin 未注册，跳过星标评分联动`);
            return;
        }
        // 复用 _reviewChain 串行化（与 quickConvertToFav 完全一致的结构）
        detailPlugin._reviewChain = (detailPlugin._reviewChain || Promise.resolve())
            .then(async () => {
                detailPlugin._wantWatchedSyncing = true;
                try {
                    await detailPlugin._triggerJavdbWant();
                    detailPlugin._syncRatingBar();
                } finally {
                    detailPlugin._wantWatchedSyncing = false;
                }
            })
            .catch(() => {});
    } catch (err: any) {
        console.error(`${LOG_PREFIX} 星标评分联动失败: ${carNum}`, err);
    }
}

/**
 * 处理 checkbox 勾选/取消。
 * 对应原 L515-571 的 handleCheckboxChange。
 *
 * @param movieInfo 影片信息
 * @param listInfo 清单信息
 * @param checked 是否勾选
 */
export async function handleCheckboxChange(
    movieInfo: NonNullable<ReturnType<typeof getMovieInfo>>,
    listInfo: ReturnType<typeof getListInfo>,
    checked: boolean
): Promise<void> {
    const des = movieInfo.designation;
    const lname = listInfo.info.name;
    const action = checked ? 'add' : 'remove';

    console.log(`${LOG_PREFIX} ═══ ${checked ? '勾选' : '取消'} [${des}] → ${lname} ═══`);

    let result: SyncResult;
    try {
        result = await syncMoviesLists(movieInfo, listInfo, action);
    } catch (err: any) {
        console.error(`${LOG_PREFIX} 同步失败`, err);
        showToast(`✗ [${des}] 同步失败：${err.message || '请检查 IndexedDB'}`, 'error');
        return;
    }

    // 收集实际新创建了什么
    const created: string[] = [];
    if (result.movie === 'created') created.push('影片');
    if (result.list === 'created') created.push('清单');

    const entry = ASSOC_TOAST[result.association];
    if (entry) {
        const { msg, type } = entry(des, lname, created);
        showToast(msg, type);
    } else {
        showToast(`✗ [${des}] 未知响应：${result.association}`, 'error');
    }

    // 勾选（添加到清单）且清单名称包含「等待更新」时，自动收藏未收藏视频
    if (checked) {
        autoFavoriteIfPendingUpdate(movieInfo, lname).then();
    }

    console.log(`${LOG_PREFIX} ═══ 完成 ═══`);

    // 广播同步事件（三重机制确保跨脚本/跨标签页联动）
    const syncPayload = {
        designation: des,
        action,
        association: result.association,
        time: Date.now()
    };
    const payloadStr = JSON.stringify(syncPayload);

    // 1) 同脚本跨标签页（GM 原生通道）
    GM_setValue(LAST_SYNC_KEY, payloadStr);

    // 2) 跨脚本跨标签页（localStorage 触发 storage 事件）
    localStorage.setItem(LAST_SYNC_KEY, payloadStr);

    // 3) 跨脚本同页面（CustomEvent 即时）
    document.dispatchEvent(new CustomEvent('jdb:sync-complete', { detail: syncPayload }));
}

/**
 * 注册 checkbox change 事件监听。
 * 对应原 L573-600。
 *
 * 监听 `input[type=checkbox][data-action="change->list#listCheckboxChanged"]`
 * 的 change 事件，防抖后调用 handleCheckboxChange。
 */
export function setupCheckboxListener(): void {
    document.addEventListener('change', (e: Event) => {
        const target = e.target as HTMLElement;

        if (
            target.tagName !== 'INPUT' ||
            (target as HTMLInputElement).type !== 'checkbox' ||
            target.dataset.action !== 'change->list#listCheckboxChanged'
        ) {
            return;
        }

        const input = target as HTMLInputElement;
        const movieInfo = getMovieInfo(input.value);
        if (!movieInfo) {
            console.warn(`${LOG_PREFIX} 无法获取影片信息，跳过`);
            return;
        }
        const listInfo = getListInfo(input.dataset.listId || '');
        if (!listInfo.info.name) {
            console.warn(`${LOG_PREFIX} 无法获取清单名称，跳过`);
            return;
        }
        const checked = input.checked;
        const key = `${movieInfo.designation}::${listInfo.list_id}`;

        clearTimeout(debounceTimers.get(key));
        debounceTimers.set(
            key,
            setTimeout(() => {
                handleCheckboxChange(movieInfo, listInfo, checked).then();
            }, 300)
        );
    });
}

/* ============================================================
 * 新增清单功能（修复展开面板下原生弹窗不可达 + 自动同步关联）
 * ============================================================
 *
 * 背景：
 * 原生「存入清单」模态框被 CSS 永久隐藏（rating-bar.css
 * `#modal-save-list{display:none}`），其 footer 的「創建新清单」按钮
 * 对用户不可达，导致展开布局下新增清单功能失效。
 *
 * 方案（零侵入已定稿插件，与网站原始功能相符）：
 * 1. 在 .jhs-list-panel 后方插入一份同款 Bulma 风格的「➕ 新增清单」
 *    UI（按钮 + 行内表单）。
 * 2. 提交时改用 GM_xmlhttpRequest 直接发 ajax POST /lists/remote_create
 *    （doc/58 终极修复：原方案驱动原生 #new_list 表单 submit，依赖
 *    Rails UJS data-remote 拦截，但 JavDB 已迁移到 Turbo，data-remote
 *    不再被拦截 → submitBtn.click() 触发常规表单 POST → 页面导航 →
 *    脚本环境卸载 → 所有后续效果丢失。改用 GM_xmlhttpRequest 完全
 *    绕过原生表单链路，自控请求与响应）。从 #new_list 表单收集字段
 *    （list[name]/video_id/authenticity_token）+ meta csrf-token，
 *    服务端创建清单后自动关联当前视频。
 * 3. 响应处理（doc/59 修复）：服务端响应仅为 `Toastr.success("...")` JS，
 *    不含 list-id、不更新 DOM。故多级兜底：轮询 2s 检测 listContainer 更新 →
 *    从响应正则提取 data-list-id → GET /users/lists 匹配清单名称提取 list-id →
 *    手动克隆 checkbox 构建。检测到后直接调用
 *    handleCheckboxChange(movieInfo, listInfo, true) 完成本地 IDB 同步，
 *    彻底消除手动「取消关联→再关联」步骤（用户核心诉求）。
 *
 * doc/57 修复（已失效）：挂 modal + 200ms 轮询。无效（原生表单 POST 导致
 * 页面导航，无新 checkbox 出现在 DOM 中）。
 * doc/58 修复：改用 GM_xmlhttpRequest 绕过原生表单。但响应无 list-id。
 * doc/59 修复：增加 GET /users/lists 查找新清单 list-id 兜底（失效：
 *   页面通过 JS 动态加载清单数据，原始 HTML 不含清单列表）。
 * doc/60 修复：增加 #save-list-button 切换重载兜底：点击两次（关闭→
 *   重新打开模态框），触发 JavDB 原生 Stimulus list 控制器重新 ajax
 *   加载清单列表，获取含新 checkbox 的完整 DOM。
 */

/** 新增清单 UI 是否已注入（幂等标记）。 */
let _createListUiInjected = false;

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
    wrap.innerHTML =
        '<button type="button" class="button is-info is-small jhs-list-create-btn">➕ 新增清单</button>' +
        '<span class="jhs-list-create-form" style="display:none;">' +
        '<input type="text" class="input is-small jhs-list-create-input" placeholder="输入新清单名稱" maxlength="50" />' +
        '<button type="button" class="button is-info is-small jhs-list-create-save">保存</button>' +
        '<button type="button" class="button is-light is-small jhs-list-create-cancel">取消</button>' +
        '</span>';
    panel.insertAdjacentElement('afterend', wrap);
    bindCreateListEvents(wrap);
    _createListUiInjected = true;
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
        form.style.display = 'inline-flex';
        input.value = '';
        input.focus();
    });

    cancelBtn.addEventListener('click', () => {
        form.style.display = 'none';
        btn.style.display = 'inline-flex';
        input.value = '';
    });

    saveBtn.addEventListener('click', () => {
        const name = input.value.trim();
        if (!name) {
            showToast('请输入清单名稱', 'warning');
            input.focus();
            return;
        }
        createList(name).then();
    });

    input.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveBtn.click();
        } else if (e.key === 'Escape') {
            cancelBtn.click();
        }
    });
}

/**
 * 创建新清单并自动关联当前影片。
 *
 * doc/56 原方案驱动原生 #new_list 表单 submit（`submitBtn.click()`），依赖
 * Rails UJS `data-remote` 拦截为 ajax。但实测：JavDB 已迁移到 Turbo，
 * `data-remote="true"` 不再被拦截 → `submitBtn.click()` 触发的是**常规表单
 * POST**（非 ajax），页面导航到 `/lists/remote_create`，脚本环境被卸载，
 * 所有 setTimeout/MutationObserver/setInterval 全部销毁。服务端虽创建了
 * 清单（刷新后可见），但客户端无任何后续效果（无 toast、无 IDB 同步、
 * 无自动收藏），且 listContainer 未被更新。doc/57 的「挂 modal + 轮询」
 * 修复也无效，因为根本没有新 checkbox 出现在 DOM 中。
 *
 * doc/58-59 修复：改用 `GM_xmlhttpRequest` 直接发 ajax POST，自控请求
 * 与响应。服务端响应仅为 `Toastr.success("...")` JS，不含 list-id、
 * 不含 HTML 片段、不更新 listContainer。
 *
 * doc/60 修复（增加多级兜底，按优先级依次尝试）：
 * 1. 从 #new_list 表单收集字段 + meta csrf-token，GM_xmlhttpRequest POST
 * 2. 注入 `<script>` 执行 JS 响应（显示 JavDB 原生 Toastr 通知）
 * 3. 轮询 2s 检测 listContainer 是否被更新（若响应含 DOM 更新）
 * 4. 从响应正则提取 data-list-id 并手动构建 checkbox
 * 5. **核心兜底**：点击 #save-list-button 两次（关闭→重新打开模态框），
 *    触发 JavDB 原生 Stimulus list 控制器重新 ajax 加载清单列表（含新清单
 *    的 checkbox），轮询 5s 检测新 checkbox
 * 6. **最后兜底**：GET /users/lists 页面解析 /lists/{id} 链接匹配清单名
 *    （可能因页面 JS 动态加载而失效）
 * 7. 完成：refreshListPanel() 刷新平铺面板 + handleCheckboxChange(add)
 *    同步本地 IDB + 三重广播 + 自动收藏
 *
 * @param listName 新清单名称
 */
async function createList(listName: string): Promise<void> {
    const modal = document.querySelector('#modal-save-list');
    if (!modal) {
        showToast('✗ 未找到存入清单弹窗，请重新进入详情页', 'error');
        return;
    }
    const nameInput = modal.querySelector(
        'input[data-list-target="listNewNameInput"]'
    ) as HTMLInputElement | null;
    const form = modal.querySelector('#new_list') as HTMLFormElement | null;
    const listContainer = modal.querySelector(
        '[data-list-target="listContainer"]'
    ) as HTMLElement | null;
    if (!nameInput || !form || !listContainer) {
        showToast('✗ 清单建立表单未就绪，请重新进入详情页', 'error');
        return;
    }

    // ── 收集表单字段 ──
    const formData: Record<string, string> = {};
    Array.from(form.querySelectorAll('input, textarea, select')).forEach((el: any) => {
        if (el.name && el.type !== 'submit' && el.type !== 'button' && el.type !== 'reset') {
            formData[el.name] = el.value;
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
            (el: any) => el.dataset.listId
        )
    );
    const videoId =
        formData['video_id'] ||
        (form.querySelector('input[name="video_id"]') as HTMLInputElement | null)?.value ||
        '';

    // ── 还原我们的展开 UI（立即恢复，不等待请求完成） ──
    restoreCreateListUi();

    showToast('正在建立清单…', 'info');
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
                onload: (r: any) => {
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
    } catch (err: any) {
        console.error(`${LOG_PREFIX} 新增清单失败`, err);
        showToast(`✗ 新增清单失败：${err.message || '请稍后重試'}`, 'error');
        return;
    }

    console.log(`${LOG_PREFIX} 服务端响应（前 500 字）: ${responseText.slice(0, 500)}`);

    // ── 在页面上下文执行 JS 响应 ──
    // 服务端返回的是 JS（如 Toastr.success("...")），注入 <script> 执行，
    // 让 JavDB 原生 Toastr 通知正常显示。
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

    // ── 快速检测列表是否被 JS 响应直接更新（最多 200ms） ──
    // JavDB 的响应通常是 Toastr.success，不会更新 DOM，所以很短的轮询
    // 即可。保留这段是为了应对响应格式可能变化（保险）。
    let newCheckboxes = await pollForNewCheckboxes(modal, beforeIds, 200);
    if (newCheckboxes.length > 0) {
        console.log(`${LOG_PREFIX} 侦测到 ${newCheckboxes.length} 个新 checkbox，走正常完成流程`);
        finishCreateList(newCheckboxes, listName);
        return;
    }

    // ── 从响应提取 list-id（若响应含 HTML 片段） ──
    const listIdMatch = responseText.match(/data-list-id=["']([^"']+)["']/);
    if (listIdMatch) {
        const listId = listIdMatch[1];
        const manualCb = manuallyBuildCheckbox(listContainer, listId, listName, videoId);
        if (manualCb) {
            console.log(`${LOG_PREFIX} 从响应提取 list-id 成功 (list_id=${listId})`);
            finishCreateList([manualCb], listName);
            return;
        }
    }

    // ── 核心兜底：通过切换 #save-list-button 重新加载模态框的清单列表 ──
    // 服务端响应只有 Toastr.success，不含 list-id、不更新 DOM。
    // 但 JavDB 的 Stimulus list 控制器在模态框打开时会 ajax 加载清单列表，
    // 新建清单后关闭再打开即可拉取到含新清单的完整列表（包含新 checkbox）。
    console.log(`${LOG_PREFIX} 响应无 list-id，通过切换 #save-list-button 重载清单列表`);
    const saveListBtn = document.querySelector('#save-list-button') as HTMLElement | null;
    if (saveListBtn) {
        // 第一次点击：关闭模态框（Stimulus 切换状态）
        saveListBtn.click();
        // 等待 Stimulus 处理关闭（短延迟可避免下次开关合并）
        await new Promise((r) => setTimeout(r, 200));
        // 第二次点击：重新打开模态框（触发 ajax 加载新清单列表）
        saveListBtn.click();
        // 轮询检测新增 checkbox（最多 5s）
        newCheckboxes = await pollForNewCheckboxes(modal, beforeIds, 5000);
        if (newCheckboxes.length > 0) {
            console.log(
                `${LOG_PREFIX} 重载后侦测到 ${newCheckboxes.length} 个新 checkbox，走正常完成流程`
            );
            finishCreateList(newCheckboxes, listName);
            return;
        }
    }

    // ── 最后兜底：尝试 GET /users/lists 查找 list-id（可能因 JS 动态加载而失败） ──
    console.log(`${LOG_PREFIX} 按钮重载未找到新 checkbox，尝试 /users/lists 作为最后手段`);
    const listId = await fetchListIdByName(listName);
    if (listId) {
        const manualCb = manuallyBuildCheckbox(listContainer, listId, listName, videoId);
        if (manualCb) {
            console.log(`${LOG_PREFIX} 从 /users/lists 查得 list_id=${listId}，手动构建 checkbox`);
            finishCreateList([manualCb], listName);
            return;
        }
    }

    // ── 全部失败 ──
    // 服务端可能已创建清单（HTTP 200），但无法定位新 checkbox。
    // 仍尝试刷新平铺面板，并提示用户。
    console.error(
        `${LOG_PREFIX} 新增清单后无法定位新 checkbox。响应前 300 字: ${responseText.slice(0, 300)}`
    );
    refreshListPanel();
    showToast(`⚠ 清单「${listName}」可能已建立，请刷新页面确认`, 'warning');
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
                onload: (r: any) => {
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

        // 解析 HTML，查找指向 /lists/{id} 的链接中匹配清单名称的项。
        // 注意：/users/lists 页面可能通过 JS（Turbo/Stimulus）动态加载
        // 清单数据，服务端返回的原始 HTML 中可能不包含清单列表。此时此
        // 兜底方案会失败，依赖前面的 #save-list-button 重载方案。
        const doc = new DOMParser().parseFromString(html, 'text/html');

        // 先尝试直接匹配 a[href*="/lists/"]
        let links = doc.querySelectorAll('a[href*="/lists/"]');
        if (links.length === 0) {
            // 可能页面结构不同，尝试更宽泛的查找
            links = doc.querySelectorAll('[href*="/lists/"]');
        }

        console.log(`${LOG_PREFIX} /users/lists 页面解析到 ${links.length} 条 /lists/ 链接`);

        for (const link of Array.from(links)) {
            const href = (link as Element).getAttribute('href') || '';
            // 提取 /lists/{id} 中的 id（排除 /users/lists 自身）
            const m = href.match(/\/lists\/([^/?#]+)/);
            if (!m) continue;
            const id = m[1];
            if (id === 'users' || id === '' || id === 'new') continue;
            // 匹配清单名称
            const text = (link as Element).textContent || '';
            if (text.trim().includes(listName)) {
                console.log(`${LOG_PREFIX} /users/lists 匹配到清单「${listName}」→ list_id=${id}`);
                return id;
            }
        }

        // 未匹配到：打印部分 HTML 以便排查
        const bodyText = doc.body?.textContent?.slice(0, 1000) || '';
        console.warn(
            `${LOG_PREFIX} /users/lists 未找到名称含「${listName}」的清单（共 ${links.length} 条链接）。` +
                `页面文本前 500 字: ${bodyText.slice(0, 500)}`
        );
        return null;
    } catch (err: any) {
        console.error(`${LOG_PREFIX} 获取 /users/lists 失败`, err);
        return null;
    }
}

/**
 * 手动构建新清单的 checkbox 并插入 listContainer（兜底方案）。
 *
 * 克隆 listContainer 内已有的一个 checkbox <label>，修改 data-list-id /
 * value / 文案 / checked，插入 listContainer 末尾。这样即使 JS 响应未成功
 * 更新 DOM，也能让平铺面板和后续同步流程拿到合法的 checkbox 元素。
 *
 * @param listContainer 原生清单容器
 * @param listId        从响应提取的新清单 ID
 * @param listName      新清单名称
 * @param videoId       当前影片 ID
 * @returns 构建的新 checkbox input 元素，失败返回 null
 */
function manuallyBuildCheckbox(
    listContainer: HTMLElement,
    listId: string,
    listName: string,
    videoId: string
): HTMLInputElement | null {
    // 找一个已有的 checkbox label 作为模板克隆
    const existingCb = listContainer.querySelector(
        'input[type="checkbox"][data-list-id]'
    ) as HTMLInputElement | null;
    if (!existingCb) return null;
    const existingLabel = existingCb.closest('label');
    if (!existingLabel) return null;

    const clone = existingLabel.cloneNode(true) as HTMLElement;
    const cb = clone.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    if (!cb) return null;
    cb.dataset.listId = listId;
    cb.value = videoId;
    cb.checked = true;
    // Stimulus action 属性保留（克隆已带）

    // 更新 label 文案为「清单名 (1)」——尝试替换最后一个 (N) 计数
    // label 文本结构通常是「清单名 (count)」，克隆后改成新名 + (1)
    const textNodes = Array.from(clone.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE);
    if (textNodes.length > 0) {
        // 替换最后一个文本节点的计数部分
        const lastText = textNodes[textNodes.length - 1] as Text;
        lastText.nodeValue = ` ${listName} (1)`;
    } else {
        // 无独立文本节点，追加
        clone.append(` ${listName} (1)`);
    }

    listContainer.appendChild(clone);
    return cb;
}

/**
 * 新建清单完成态：toast + 刷新平铺面板 + 触发本地 IDB 同步 + 还原 UI。
 *
 * @param newCheckboxes 检测/构建出的新增 checkbox 数组
 * @param listName      新清单名称（用于 toast 文案）
 */
function finishCreateList(newCheckboxes: HTMLInputElement[], listName: string): void {
    // 还原 newListArea 状态（点击 list#cancelNewList，避免下次打开仍在新增态）
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
    showToast(`✓ 清单「${listName}」已建立，已自动关联當前影片`, 'success');

    // 立即刷新 .jhs-list-panel 平铺面板
    refreshListPanel();

    // 对每个新增 checkbox，触发本地 IDB 同步（核心优化：消除手动取消/关联步骤）
    for (const cb of newCheckboxes) {
        const movieInfo = getMovieInfo(cb.value);
        if (!movieInfo) {
            console.warn(`${LOG_PREFIX} 新建清单后无法取得影片资讯，跳过同步`, cb);
            continue;
        }
        const listInfo = getListInfo(cb.dataset.listId || '');
        if (!listInfo.info.name) {
            // 手动构建的 checkbox 文案可能读不到名称，用 listName 兜底
            console.warn(
                `${LOG_PREFIX} 新建清单后无法从 DOM 取得清单名稱，使用传入名稱「${listName}」`
            );
        }
        // JavDB 已自动勾选（关联视频），故传入 true
        handleCheckboxChange(movieInfo, listInfo, true).then();
    }
}

/**
 * 还原「新增清单」展开 UI 到初始按钮态。幂等。
 */
function restoreCreateListUi(): void {
    const w = document.querySelector('.jhs-list-create-wrap') as HTMLElement | null;
    if (!w) return;
    const btn = w.querySelector('.jhs-list-create-btn') as HTMLElement | null;
    const f = w.querySelector('.jhs-list-create-form') as HTMLElement | null;
    const inp = w.querySelector('.jhs-list-create-input') as HTMLInputElement | null;
    if (btn) btn.style.display = 'inline-flex';
    if (f) f.style.display = 'none';
    if (inp) inp.value = '';
}

/**
 * 刷新 `.jhs-list-panel` 平铺面板：从 modal 内最新 listContainer 克隆全部
 * 条目（跳过「预设清单」），与 DetailPageButtonPlugin._initListPanel 的 sync
 * 逻辑等价、幂等。
 *
 * 用途：新建清单后，若 _initListPanel 的 MutationObserver 因 listContainer
 * 被替换而失效，不会自动 clone 新条目到平铺面板，用户需刷新页面才能看到
 * 新清单。此处主动重建，消除该等待。
 */
function refreshListPanel(): void {
    const panel = document.querySelector('.jhs-list-panel');
    if (!panel) return;
    const lc = document.querySelector('#modal-save-list [data-list-target="listContainer"]');
    if (!lc) return;
    panel.innerHTML = '';
    Array.from(lc.children).forEach((child: any) => {
        // 跳过「预设清单」
        if (child.textContent.includes('预设清单')) return;
        panel.appendChild(child.cloneNode(true));
    });
}
