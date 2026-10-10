// mstf-collect.ts 关键实现
import { STATUS_CONFIG } from '../car-status-sync/car-status-config';

export const NO_TAG_VALUE = 'no-tag';
export const STATUS_ORDER = ['favorite', 'hasWatch', 'filter', 'hasDown'];

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