/**
 * 状态标签「从缓存补渲染」 —— 有 car_list 记录、但页面未渲染标签时补出标签。
 *
 * 背景（需求：doc/24 Q2a）：列表卡片的 status-tag 由 `list-page/lp-filter` 渲染，
 * 其落地点是 `$item.find('.tags').append(...)`。若卡片没有 `.tags` 容器、
 * 番号解析失败或渲染时序不对，就会出现「car_list 里明明有已读/收藏记录，
 * 卡片上却看不到标签」的情况。
 *
 * 本模块以 `car_list` 索引为准，对缺失标签的卡片补渲染 —— 且注入点比原路径更宽
 * （复用 `injectStatusTag` 的三级回退：`.tags` → `.item-tag` → `.photo-info > span > div`）。
 *
 * **纯补充渲染**：不写 car_list、不改既有标签、不清除任何内容。
 */

import { FAVORITE_ACTION, FILTER_ACTION, HAS_WATCH_ACTION } from '../../constants/status';
import {
    STATUS_TAG_CONFIG,
    buildStatusTagHtml,
    getStatusTagPositionStyle,
    injectStatusTag
} from '../../core/util/util-status-tag';
import type { StatusTagConfig } from '../../core/util/util-status-tag';

import { collectMissingStatusTags } from './stf-score';

/** 状态 → 对应的渲染配置；无配置表示该状态不渲染标签。 */
function tagConfigForStatus(status: string): StatusTagConfig | null {
    if (status === FAVORITE_ACTION) return STATUS_TAG_CONFIG.IS_FAVORITE;
    if (status === HAS_WATCH_ACTION) return STATUS_TAG_CONFIG.IS_HAS_WATCH;
    if (status === FILTER_ACTION) return STATUS_TAG_CONFIG.IS_FILTERED;
    return null;
}

/**
 * 对当前页缺失状态标签的卡片做补渲染。
 *
 * @returns 实际补渲染的卡片数
 */
export async function renderMissingStatusTags(): Promise<number> {
    let positionStyle: string;
    try {
        const setting = await storageManager.getSetting();
        positionStyle = getStatusTagPositionStyle(setting?.tagPosition || 'rightTop');
    } catch (error: unknown) {
        clog.error('读取标签位置设置失败: ' + (error instanceof Error ? error.message : String(error)));
        positionStyle = getStatusTagPositionStyle('rightTop');
    }

    const missing = collectMissingStatusTags((item: Element, status: string): boolean => {
        const config = tagConfigForStatus(status);
        // 无可渲染配置 → 视为无需补渲染（跳过）
        if (!config || !config.text) return true;
        return Array.from(item.querySelectorAll('.status-tag')).some(
            (tagEl) => (tagEl.textContent?.trim() ?? '') === config.text
        );
    });

    let rendered = 0;
    for (const { item, status } of missing) {
        const config = tagConfigForStatus(status);
        if (!config || !config.text) continue;
        const tagHtml = buildStatusTagHtml(
            'render',
            config.text,
            config.color,
            config.reasonType,
            positionStyle
        );
        injectStatusTag($(item), tagHtml);
        rendered++;
    }
    if (rendered > 0) {
        clog.log(`[状态标签筛选] 从缓存补渲染 ${rendered} 个状态标签`);
    }
    return rendered;
}
