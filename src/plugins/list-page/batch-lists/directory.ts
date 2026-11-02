/** 完整读取每个视频的新鲜清单目录；不以缺页、登录页或损坏条目规划路由。 */
import { fetchSimpleListsPage } from '../../../core/util/util-simple-lists';

import type { ListMember } from '../../detail-page-button/dpb-list-merge';
import { extractListNameFromInput, getCheckboxCount } from '../../video-lists-tag/vlt-helpers';

export async function fetchBatchListDirectory(videoId: string): Promise<ListMember[]> {
    if (!videoId) throw new Error('无法识别 JavDB 影片 ID');
    let url: URL | null = new URL('/users/simple_lists', window.location.origin);
    url.searchParams.set('vid', videoId);
    const visited = new Set<string>();
    const lists = new Map<string, ListMember>();
    while (url) {
        if (visited.has(url.href)) throw new Error('清单分页出现循环，未载入完整目录');
        visited.add(url.href);
        const page = await fetchSimpleListsPage(url.href, videoId);
        const doc = new DOMParser().parseFromString(page.entries, 'text/html');
        const inputs = Array.from(doc.querySelectorAll<HTMLInputElement>('input[type="checkbox"][data-list-id]'));
        if (page.entries.trim() && inputs.length === 0) throw new Error('未取得有效清单，请确认已登录 JavDB');
        for (const input of inputs) {
            const listId = input.dataset.listId?.trim() || '';
            const name = extractListNameFromInput(input);
            if (!listId || !name) throw new Error('清单目录包含缺少 ID 或名称的条目');
            const member = { listId, name, num: 0, count: getCheckboxCount(input), checked: input.checked, disabled: input.disabled };
            const previous = lists.get(listId);
            if (previous && JSON.stringify(previous) !== JSON.stringify(member)) throw new Error('清单目录分页状态变化，请重新打开后重试');
            lists.set(listId, member);
        }
        url = page.nextUrl ? new URL(page.nextUrl) : null;
    }
    return Array.from(lists.values());
}
