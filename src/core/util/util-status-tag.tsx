/**
 * 状态标签共享配置与工具函数（提取自 list-page-plugin.tsx）。
 *
 * 提供 STATUS_TAG_CONFIG 配置表、位置样式计算、StatusTagHtml 渲染、
 * 以及 DOM 注入辅助函数，供 list-page-plugin 等模块复用。
 */
import {
    BLOCKED_TEXT,
    BLOCK_COLOR,
    FAVORITED_TEXT,
    FAVORITE_COLOR,
    WATCHED_TEXT,
    WATCHED_COLOR
} from '../../constants/status';

import { jsxToString } from '../jsx-to-string';

import { StatusTagHtml } from '../../components/misc/status-tag-html';
import type { StatusTagVariant } from '../../components/misc/status-tag-html';

/** 状态标签配置项结构（原顶层 Te 对象的每个条目）。 */
export interface StatusTagConfig {
    text: string;
    color: string;
    reasonType: string;
    isCounted: boolean;
    countKey: string;
}

/**
 * 状态标签配置表（原顶层 Te）。
 * 将原 u/f/b/w/k/S 等单字母文本/颜色常量替换为 ../constants/status 的语义常量。
 */
export const STATUS_TAG_CONFIG: Record<string, StatusTagConfig> = {
    IS_FILTERED: {
        text: BLOCKED_TEXT,
        color: BLOCK_COLOR,
        reasonType: '单番号屏蔽',
        isCounted: true,
        countKey: 'currentPageFilterCount'
    },
    IS_FAVORITE: {
        text: FAVORITED_TEXT,
        color: FAVORITE_COLOR,
        reasonType: '',
        isCounted: true,
        countKey: 'currentPageFavoriteCount'
    },
    IS_HAS_WATCH: {
        text: WATCHED_TEXT,
        color: WATCHED_COLOR,
        reasonType: '',
        isCounted: true,
        countKey: 'currentPageHasWatchCount'
    },
    IS_KEYWORD_FILTER: {
        text: '❌ 关键词屏蔽',
        color: '#de3333',
        reasonType: '',
        isCounted: true,
        countKey: 'currentPageKeywordFilterCount'
    },
    IS_ACTOR_FILTER: {
        text: '♂️ 男演员屏蔽',
        color: '#b22222',
        reasonType: '',
        isCounted: true,
        countKey: 'currentPageActorFilterCount'
    },
    IS_ACTRESS_FILTER: {
        text: '♀️ 女演员屏蔽',
        color: '#cd5c5c',
        reasonType: '',
        isCounted: true,
        countKey: 'currentPageActorFilterCount'
    },
    IS_WAIT_CHECK: {
        text: '',
        color: '',
        reasonType: '',
        isCounted: true,
        countKey: 'currentPageWaitCheckCount'
    }
};

/**
 * 根据 tagPosition 设置值计算状态标签的 CSS 定位片段。
 * @param tagPosition 'rightTop' | 'leftTop'（默认 rightTop）
 * @returns CSS 定位字符串
 */
export function getStatusTagPositionStyle(tagPosition: string): string {
    return tagPosition === 'rightTop' ? 'right: 0; top:5px;' : 'left: 0; top:5px;';
}

/**
 * 渲染状态标签 HTML 字符串。
 * @param variant  模板变体（render / filter）
 * @param text     标签文案
 * @param color    标签背景色
 * @param dataTip  悬停提示
 * @param positionStyle 定位片段
 * @returns HTML 字符串
 */
export function buildStatusTagHtml(
    variant: StatusTagVariant,
    text: string,
    color: string,
    dataTip: string,
    positionStyle: string
): string {
    return jsxToString(
        <StatusTagHtml
            variant={variant}
            text={text}
            color={color}
            dataTip={dataTip}
            positionStyle={positionStyle}
        />
    );
}

/**
 * 将状态标签 HTML 注入到 .item 卡片的合适位置。
 * 优先级：.tags → .item-tag → .photo-info > span > div。
 * @param $item  jQuery 化的 .item 元素
 * @param tagHtml 状态标签 HTML 字符串
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- jQuery object, $ is any-typed
export function injectStatusTag($item: any, tagHtml: string): void {
    const tagsEl = $item.find('.tags');
    if (tagsEl.length) {
        tagsEl.append(tagHtml);
        return;
    }
    const itemTagEl = $item.find('.item-tag');
    if (itemTagEl.length) {
        itemTagEl.append(tagHtml);
        return;
    }
    $item.find('.photo-info > span > div').append(tagHtml);
}
