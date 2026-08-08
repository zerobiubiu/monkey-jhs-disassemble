// mstf-apply.ts 关键实现
import { NO_TAG_VALUE } from './mstf-collect';

export function shouldShow(itemStatus: string | null, activeValues: Set<string>): boolean {
    if (activeValues.size === 0) return true;
    return activeValues.has(itemStatus ?? NO_TAG_VALUE);
}

export function applyFilter(activeValues: Set<string>): void {
    document.querySelectorAll<HTMLElement>('.thumbnail.group').forEach((item) => {
        const tag = item.querySelector<HTMLElement>('.missav-status-tag');
        const status = tag?.dataset.status ?? null;
        if (shouldShow(status, activeValues)) {
            item.style.display = '';
            item.removeAttribute('data-mstf-hidden');
        } else {
            item.style.display = 'none';
            item.setAttribute('data-mstf-hidden', 'yes');
        }
    });
}