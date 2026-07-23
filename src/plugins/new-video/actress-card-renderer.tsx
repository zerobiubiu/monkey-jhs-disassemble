/**
 * 女优卡片渲染与分页（提取自 new-video-plugin.tsx）。
 * 对应原 L11093-11366。
 *
 * 职责：读取收藏列表 → 按类型过滤 → 排序 → 分页切片 → 生成卡片 HTML →
 * 绑定取消收藏/编辑按钮 → 渲染分页。
 */
import type { CSSProperties } from 'react';
import { UNCENSORED, CENSORED } from '../../constants/site';

import { jsxToString } from '../../core/jsx-to-string';

import type { NewVideoPlugin } from '../new-video-plugin';

import { ActressCard } from '../../components/actress/actress-card';
import { ActressPagination } from '../../components/actress/actress-pagination';

/**
 * 收藏女优记录结构（storageManager.getFavoriteActressList() 返回元素）。
 * starId/name/avatar 为收藏时必填；其余字段可缺省，由各处 || "" / Array.isArray 兜底。
 */
export interface FavoriteActressRecord {
    /** 演员 starId（URL /actors/<id> 末段） */
    starId: string;
    /** 主名称 */
    name: string;
    /** 头像 URL */
    avatar: string;
    /** 全部别名 */
    allName?: string[];
    /** 最新作品番号列表 */
    newVideoList?: string[];
    /** 演员类别：censored / uncensored / 空(未知) */
    actressType?: string;
    /** 备注 */
    remark?: string;
    /** 上次检测时间 */
    lastCheckTime?: string;
    /** 最后发行作品时间 */
    lastPublishTime?: string;
}

/** 女优类型 → 标签/颜色映射。 */
const ACTRESS_TYPE_MAP: Record<string, { label: string; color: string }> = {
    [UNCENSORED]: { label: '无码', color: '#4CAF50' },
    [CENSORED]: { label: '有码', color: '#FF9800' }
};

/** 默认（未知）类型的标签与颜色。 */
const DEFAULT_TYPE = { label: '未知', color: '#9E9E9E' };

/**
 * 渲染收藏女优卡片网格：读取收藏列表 → 按类型过滤 → 排序（新作品数、最后发行时间）
 * → 分页切片 → 生成卡片 HTML → 绑定取消收藏/编辑按钮 → 渲染分页。
 * 对应原 L11093-11195。
 *
 * @param plugin NewVideoPlugin 实例（用于 getBean / editSvg / deleteSvg / editActress / loadData）。
 */
export async function renderActressCards(plugin: NewVideoPlugin): Promise<void> {
    const $container = $('#actress-card-container');
    if (!$container.length) {
        return;
    }
    let favoriteActresses: FavoriteActressRecord[] =
        (await storageManager.getFavoriteActressList()) as FavoriteActressRecord[];
    const typeFilter = String($('#paramActressType').val() ?? '');
    if (typeFilter !== 'all') {
        favoriteActresses = favoriteActresses.filter(
            (actress) => actress.actressType === typeFilter
        );
    }
    const sortedActresses: FavoriteActressRecord[] = utils.genericSort(favoriteActresses, [
        {
            key: (actress: FavoriteActressRecord) => actress.newVideoList?.length ?? 0,
            order: 'desc'
        },
        {
            key: 'lastPublishTime',
            order: 'desc'
        }
    ]);
    const totalCount: number = sortedActresses.length;
    const totalPages: number = Math.ceil(totalCount / plugin.pageSize);
    const startIndex: number = (plugin.currentPage - 1) * plugin.pageSize;
    const endIndex: number = startIndex + plugin.pageSize;
    const pageActresses: FavoriteActressRecord[] = sortedActresses.slice(startIndex, endIndex);
    const javDbUrl: string = await plugin.getBean('OtherSitePlugin').getJavDbUrl();
    const ruleTimeHours: number =
        (await storageManager.getSetting('checkNewVideo_ruleTime')) || 8760;
    const cardsHtml: string = pageActresses
        .map((actress: FavoriteActressRecord) => {
            const allNameText: string = Array.isArray(actress.allName)
                ? actress.allName.join('，')
                : '';
            // 保留原 no-op 语句（原 L11132-11134，join 结果未使用，控制流不变）
            if (Array.isArray(actress.newVideoList)) {
                actress.newVideoList.join('，');
            }
            const actressUrl: string = `${javDbUrl}/actors/${actress.starId}?t=d`;
            let isStale: boolean = false;
            if (actress.lastPublishTime) {
                isStale = !utils.isUnnecessaryCheck(actress.lastPublishTime, ruleTimeHours);
            }
            const typeInfo = ACTRESS_TYPE_MAP[actress.actressType ?? ''] ?? DEFAULT_TYPE;
            let btnStyle: CSSProperties = {};
            if (isStale) {
                btnStyle = {
                    background: 'linear-gradient(145deg, #e0e0e0 0%, #cabdbd 100%)',
                    boxShadow: 'none'
                };
            }
            return jsxToString(
                <ActressCard
                    starId={actress.starId}
                    avatar={
                        actress.avatar || 'https://c0.jdbstatic.com/images/actor_unknow.jpg'
                    }
                    name={actress.name}
                    allNameText={allNameText}
                    actressUrl={actressUrl}
                    lastCheckTime={actress.lastCheckTime || ''}
                    lastPublishTime={actress.lastPublishTime || ''}
                    isStale={isStale}
                    ruleTimeYears={ruleTimeHours / 24 / 365}
                    remark={actress.remark || ''}
                    editSvg={plugin.editSvg}
                    deleteSvg={plugin.deleteSvg}
                    btnStyle={btnStyle}
                    typeLabel={typeInfo.label}
                    typeColor={typeInfo.color}
                    newVideoCount={actress.newVideoList?.length || 0}
                />
            );
        })
        .join('');
    $container.html(cardsHtml);
    $('.btn-delete-actress')
        .off('click')
        .on('click', (event: Event) => {
            event.preventDefault();
            const starId: string = $(event.currentTarget).attr('data-starId') ?? '';
            const actress = sortedActresses.find((item) => item.starId === starId);
            if (!actress) return;
            utils.q(event as MouseEvent, `是否取消收藏 ${actress.name}?`, async () => {
                const uncollectUrl: string = `${await plugin.getBean('OtherSitePlugin').getJavDbUrl()}/actors/${starId}/uncollect`;
                const csrfToken: string =
                    document.querySelector('meta[name=csrf-token]')?.getAttribute('content') ??
                    '';
                const response = await gmHttp.post(uncollectUrl, undefined, {
                    'x-csrf-token': csrfToken
                });
                if ((response as string).includes('removeClass')) {
                    await storageManager.removeFavoriteActress(starId);
                    plugin.loadData();
                } else {
                    show.error('移除失败');
                    clog.error('移除失败,返回值:', response);
                }
            });
        });
    $('.btn-edit-actress')
        .off('click')
        .on('click', (event: Event) => {
            event.preventDefault();
            const starId: string = $(event.currentTarget).attr('data-starId') ?? '';
            const actress = sortedActresses.find((item) => item.starId === starId);
            if (actress) {
                plugin.editActress(actress);
            } else {
                show.error(`未找到 starId 为 ${starId} 的女优记录。`);
            }
        });
    renderPagination(plugin, totalCount, totalPages);
    show.ok('加载完成');
}

/**
 * 渲染分页条（首页/上一页/页码/下一页/尾页/记录数），并绑定页码点击。
 * 对应原 L11322-11366。
 *
 * @param plugin     NewVideoPlugin 实例。
 * @param totalCount 记录总数。
 * @param totalPages 总页数。
 */
export function renderPagination(
    plugin: NewVideoPlugin,
    totalCount: number,
    totalPages: number
): void {
    const page: number = plugin.currentPage;
    const $pagination = $('#actress-pagination');
    $pagination.html(
        jsxToString(
            <ActressPagination totalCount={totalCount} totalPages={totalPages} page={page} />
        )
    );
    $('.pagination-btn')
        .off('click')
        .on('click', (event: Event) => {
            if ($(event.currentTarget).is('[disabled]')) {
                return;
            }
            const targetPage: number = parseInt($(event.currentTarget).data('page'));
            if (
                targetPage >= 1 &&
                targetPage <= totalPages &&
                targetPage !== plugin.currentPage
            ) {
                plugin.currentPage = targetPage;
                plugin.renderActressCards();
            }
        });
}
