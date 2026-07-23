/**
 * FC2-123Av 浏览与分页（提取自 fc2-by-123av-plugin.tsx）。
 *
 * 职责：hookPage 初始化搜索/排序交互、handleQuery 双页合并抓取与卡片渲染、
 * parseCards DOM 解析、renderPagination 分页条生成与事件绑定。
 */
import type { RankingMovie } from '../../constants/api';

import { jsxToString } from '../../core/jsx-to-string';

import type { Fc2By123AvPlugin } from '../fc2-by-123av-plugin';

import { Fc2BrowsePage } from '../../components/fc2/fc2-browse-page';
import { HitShowMovieItem } from '../../components/hit-show/hit-show-movie-item';

/** 初始化浏览页：设置标题、渲染搜索/排序 UI、绑定事件。对应原 hookPage。 */
export function hookPage(plugin: Fc2By123AvPlugin): void {
    document.title = '123Av FC2';
    const $box = plugin.$contentBox;
    if (!$box?.length) return;
    $box.html(jsxToString(<Fc2BrowsePage keyword={plugin.keyword ?? undefined} />));
    $('#fc2-123av-sort').val(plugin.sortVal);
    $('#fc2-123av-search').on('click', () => {
        plugin.keyword = String($('#fc2-123av-keyword').val() || '') || null;
        plugin.currentPage = 1;
        plugin.handleQuery();
    });
    $('#fc2-123av-sort').on('change', () => {
        plugin.sortVal = String($('#fc2-123av-sort').val() || 'release_date');
        plugin.currentPage = 1;
        plugin.handleQuery();
    });
}

/** 渲染分页条。对应原 renderPagination。 */
export function renderPagination(plugin: Fc2By123AvPlugin): void {
    const $pg = $('#fc2-123av-pagination');
    if (!plugin.maxPage || plugin.maxPage <= 1) {
        $pg.empty();
        return;
    }
    let html = '';
    const cur = plugin.currentPage;
    const max = plugin.maxPage;
    const pages: number[] = [];
    for (let i = 1; i <= max; i++) {
        if (i === 1 || i === max || (i >= cur - 2 && i <= cur + 2)) {
            pages.push(i);
        }
    }
    let last = 0;
    for (const p of pages) {
        if (last && p - last > 1) {
            html += jsxToString(<span style={{ margin: '0 4px' }}>…</span>);
        }
        html += jsxToString(
            <a
                className={`button is-small ${p === cur ? 'is-primary' : ''}`}
                data-page={p}
                style={{ margin: '2px' }}
            >
                {p}
            </a>
        );
        last = p;
    }
    $pg.html(html);
    $pg.find('a[data-page]').on('click', (e: Event) => {
        e.preventDefault();
        plugin.currentPage = parseInt($(e.currentTarget).attr('data-page') || '1', 10);
        plugin.handleQuery();
    });
}

/** 双页合并查询与卡片渲染。对应原 handleQuery。 */
export async function handleQuery(plugin: Fc2By123AvPlugin): Promise<void> {
    const seq = ++plugin._querySeq;
    const base = await plugin.getBaseUrl();
    // 每 2 页合并，maxPage = rawMaxPage / 2
    const fetchPage = async (page: number) => {
        let url: string;
        if (plugin.keyword) {
            url = `${base}/search?keyword=${encodeURIComponent(plugin.keyword)}&page=${page}&sort=${plugin.sortVal}`;
        } else {
            url = `${base}/makers/fc2?page=${page}&sort=${plugin.sortVal}`;
        }
        const html = await gmHttp.get(url);
        return utils.htmlTo$dom(String(html));
    };
    try {
        show.info('正在加载 123Av FC2...');
        const pageA = (plugin.currentPage - 1) * 2 + 1;
        const pageB = pageA + 1;
        const $dom1 = await fetchPage(pageA);
        let movies = parseCards(plugin, $dom1);
        try {
            const $dom2 = await fetchPage(pageB);
            movies = movies.concat(parseCards(plugin, $dom2));
        } catch {
            /* 末页可能无 pageB */
        }
        if (seq !== plugin._querySeq) return;
        // 解析最大页
        const lastPageText =
            $dom1.find('.pagination .page-link').last().text() ||
            $dom1.find('.pagination a').last().text();
        const rawMax = parseInt(lastPageText, 10) || 1;
        plugin.maxPage = Math.max(1, Math.ceil(rawMax / 2));
        const html = movies
            .map((movie: RankingMovie) => jsxToString(<HitShowMovieItem movie={movie} />))
            .join('');
        $('#fc2-123av-list').html(html || jsxToString(<p>无结果</p>));
        renderPagination(plugin);
        $('#fc2-123av-list .item a.box').on('click', (e: Event) => {
            e.preventDefault();
            const href = $(e.currentTarget).attr('href') || '';
            const carNum =
                $(e.currentTarget).find('strong').text().trim() ||
                href.split('/').pop() ||
                '';
            plugin.open123AvFc2Dialog(carNum, href.startsWith('http') ? href : base + href);
        });
    } catch (e: unknown) {
        clog.error(e);
        show.error('加载 123Av FC2 失败: ' + (e instanceof Error ? e.message : String(e)));
    }
}

/** 解析卡片 DOM 为 RankingMovie 列表。对应原 parseCards。 */
export function parseCards(_plugin: Fc2By123AvPlugin, $dom: JQuery): RankingMovie[] {
    const list: RankingMovie[] = [];
    $dom.find('.card, .movie-list .item, .box').each((_i: number, el: HTMLElement) => {
        const $el = $(el);
        const $a = $el.find('a').first();
        const href = $a.attr('href') || '';
        const title =
            $a.attr('title') ||
            $el.find('.video-title, .title, h3').text().trim() ||
            '';
        const number =
            $el.find('strong').text().trim() ||
            (title.match(/FC2[-_]?PPV[-_]?(\d+)/i)
                ? 'FC2-' + title.match(/FC2[-_]?PPV[-_]?(\d+)/i)![1]
                : title.split(' ')[0]);
        const cover =
            $el.find('img').attr('data-src') ||
            $el.find('img').attr('src') ||
            '';
        const id = href.split('/').filter(Boolean).pop() || number;
        if (number || href) {
            list.push({
                id,
                number: number.startsWith('FC2') ? number : `FC2-${number}`,
                origin_title: title,
                cover_url: cover,
                release_date: $el.find('.meta, .date').text().trim() || '',
                has_cnsub: false,
                magnets_count: 0,
                new_magnets: false,
                _href: href
            } as RankingMovie);
        }
    });
    return list;
}
