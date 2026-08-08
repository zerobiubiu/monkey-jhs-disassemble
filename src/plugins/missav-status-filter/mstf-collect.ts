// mstf-collect.ts 关键实现
import { STATUS_CONFIG } from '../car-status-sync/car-status-config';

export const NO_TAG_VALUE = 'no-tag';
export const STATUS_ORDER = ['favorite', 'hasWatch', 'filter', 'hasDown'];

/**
 * 判断 URL 是否为 MissAV 视频详情页（pathname 末段为番号，如 `/cn/mkmp-745`）。
 *
 * 视频页的 `#sprite-plyr` 播放器延迟渲染（Camoufox 实测 ~1.5s 后才出现），
 * `isVideoPage()` 在 handle 执行时（document-idle）可能误判为 false，导致筛选器/
 * 瀑布流被错误挂载到视频页。改用 URL 特征判定（doc/227）。
 *
 * 搜索页（`/search/`）末段可能是番号，但搜索页需要筛选器，故排除。
 *
 * @param path pathname（如 `/cn/mkmp-745`、`/cn/new`、`/cn/search/mkmp-745`）
 * @returns 是否为视频详情页
 */
export function isVideoDetailPath(path: string): boolean {
    if (path.includes('/search/')) return false;
    const last = path.split('/').pop() || '';
    // 至少两段含连字符的番号/编号（mkmp-745 / fc2-ppv-4955762 / abc-123-456）
    return /^[a-z0-9]+(?:-[a-z0-9]+)+$/i.test(last);
}

export function statusToLabel(status: string): string {
    return STATUS_CONFIG[status]?.label || status;
}

export function getItemStatus(item: Element): string | null {
    const tag = item.querySelector<HTMLElement>('.missav-status-tag');
    return tag?.dataset.status || null;
}

export function collectStatusCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    let noTag = 0;
    document.querySelectorAll('.thumbnail.group').forEach((item) => {
        const status = getItemStatus(item);
        if (status) {
            const name = statusToLabel(status);
            counts[name] = (counts[name] || 0) + 1;
        } else {
            noTag++;
        }
    });
    if (noTag > 0) counts[NO_TAG_VALUE] = noTag;
    return counts;
}