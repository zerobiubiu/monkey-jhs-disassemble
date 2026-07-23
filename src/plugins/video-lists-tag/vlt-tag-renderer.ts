/**
 * 标签渲染模块 —— 标签徽章创建、配色、等价比对、单卡片渲染。
 *
 * 提取自 vlt-tags.ts：
 * - BOOTSTRAP_COLORS：Bootstrap 标准颜色调色板
 * - getRandomBootstrapColor：随机选取配色
 * - tagsEqual：标签数组等价比对
 * - createTagBadge：创建单个标签徽章元素
 * - addTagDisplay：给单个 .item 卡片添加标签显示
 * - renderTags：批量渲染所有卡片标签
 */
import type { TagEntry, TagsCache, VltTags } from './vlt-tags';

/** Bootstrap 标准颜色调色板（IDB 中 style 缺失时回退使用）。 */
export const BOOTSTRAP_COLORS = [
    { name: 'primary', bg: '#0d6efd', text: '#fff' },
    { name: 'secondary', bg: '#6c757d', text: '#fff' },
    { name: 'success', bg: '#198754', text: '#fff' },
    { name: 'danger', bg: '#dc3545', text: '#fff' },
    { name: 'warning', bg: '#ffc107', text: '#212529' },
    { name: 'info', bg: '#0dcaf0', text: '#212529' },
    { name: 'dark', bg: '#212529', text: '#fff' }
] as const;

/**
 * 随机选取 Bootstrap 配色（对应原 L288-296）。
 * IDB 中标签 style 缺失时由 addTagDisplay 回退调用。
 *
 * @returns { bg, text, isLight } —— isLight 标记浅色背景（需用深色文字）
 */
export function getRandomBootstrapColor(): { bg: string; text: string; isLight: boolean } {
    const color = BOOTSTRAP_COLORS[Math.floor(Math.random() * BOOTSTRAP_COLORS.length)];
    return {
        bg: color.bg,
        text: color.text,
        isLight: color.text !== '#fff'
    };
}

/**
 * 比对两个标签数组是否等价（对应原 L466-471）。
 * 用于精准刷新时跳过未变化的 DOM 更新，避免无谓重渲染。
 *
 * @param a 旧标签数组（可能为 null，表示尚未加载）
 * @param b 新标签数组
 * @returns true 表示等价（可跳过 DOM 更新）
 */
export function tagsEqual(a: TagEntry[] | null, b: TagEntry[]): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * 创建单个标签徽章元素（对应原 L580-660 内循环体）。
 *
 * 有 url 用 `<a>`（可点击），无 url 用 `<span>`。
 * 优先用 tag.style 配色；缺失时回退 getRandomBootstrapColor()。
 * 浅色背景（text !== '#fff'）加 `jhs-vlt-light-bg` class。
 *
 * @param tag 标签条目
 * @returns 标签徽章元素
 */
export function createTagBadge(tag: TagEntry): HTMLElement {
    const urlTrimmed = tag.url?.trim();
    const hasUrl = !!urlTrimmed;
    const el = document.createElement(hasUrl ? 'a' : 'span');
    el.className = 'jhs-vlt-tag-link';
    if (hasUrl && urlTrimmed) {
        const anchor = el as HTMLAnchorElement;
        anchor.href = urlTrimmed;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
    }
    el.textContent = tag.name;

    // 优先使用 IDB 返回的 style；缺失时回退随机配色
    const style = tag.style;
    if (style && style.bg && style.text) {
        el.style.backgroundColor = style.bg;
        el.style.color = style.text;
        if (style.text !== '#fff') {
            el.classList.add('jhs-vlt-light-bg');
        }
    } else {
        const color = getRandomBootstrapColor();
        el.style.backgroundColor = color.bg;
        el.style.color = color.text;
        if (color.isLight) {
            el.classList.add('jhs-vlt-light-bg');
        }
    }

    return el;
}

/**
 * 给单个 .item 卡片添加标签显示（对应原 L580-660）。
 *
 * 流程：
 * 1. 查找 `a > div.video-title > strong` 获取番号
 * 2. tagsCache 未加载时跳过（等数据就绪后由调用方重新触发渲染）
 * 3. 查找 `.meta` 作为插入点
 * 4. 创建 `.jhs-vlt-tags-display` 容器
 * 5. 有标签：每个渲染为 `.jhs-vlt-tag-link`
 * 6. 无标签：渲染占位符 `—`（pointer-events: none，不可点击）
 * 7. 添加滚轮横向滚动监听（触达边界时交还页面纵向滚动）
 * 8. 插入到 `.meta` 之后
 *
 * @param plugin VltTags 实例
 * @param item 单个 .item 卡片元素
 */
export function addTagDisplay(plugin: VltTags, item: Element): void {
    if (item.querySelector('.jhs-vlt-tags-display')) return;

    const strongEl = item.querySelector('a > div.video-title > strong');
    if (!strongEl) return;
    const designation = strongEl.innerHTML;

    // 标签数据尚未加载时跳过（等待 IDB 返回后再渲染）
    const tagsCache: TagsCache | null = plugin.getTagsCache();
    if (!tagsCache) return;

    const meta = item.querySelector('.meta');
    if (!meta) return;

    const container = document.createElement('div');
    container.className = 'jhs-vlt-tags-display';

    const tags = tagsCache[designation];
    if (tags && tags.length > 0) {
        tags.forEach((tag: TagEntry) => {
            container.appendChild(createTagBadge(tag));
        });
    } else {
        // 无标签时放置一个不可点击的占位 span，保证容器有内容支撑 UI 平齐
        const placeholder = document.createElement('span');
        placeholder.className = 'jhs-vlt-tag-link';
        placeholder.textContent = '\u2014'; // em-dash 占位
        placeholder.style.backgroundColor = '#e9ecef';
        placeholder.style.color = '#6c757d';
        placeholder.style.pointerEvents = 'none';
        placeholder.style.userSelect = 'none';
        container.appendChild(placeholder);
    }

    // 鼠标滚轮横向滚动，触达边界时交还页面纵向滚动
    container.addEventListener(
        'wheel',
        (e: WheelEvent) => {
            if (e.deltaY !== 0) {
                const atStart = container.scrollLeft <= 0 && e.deltaY < 0;
                const atEnd =
                    container.scrollLeft + container.clientWidth >= container.scrollWidth - 1 &&
                    e.deltaY > 0;
                if (!atStart && !atEnd) {
                    e.preventDefault();
                    container.scrollLeft += e.deltaY;
                }
            }
        },
        { passive: false }
    );

    meta.insertAdjacentElement('afterend', container);
}

/**
 * 批量渲染所有 .item 卡片的标签。
 *
 * @param plugin VltTags 实例
 */
export function renderTags(plugin: VltTags): void {
    document.querySelectorAll('.item').forEach((item: Element) => addTagDisplay(plugin, item));
}
