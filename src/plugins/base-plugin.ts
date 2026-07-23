/**
 * 插件基类 BasePlugin —— 对应原脚本 archetype/jhs.user.js L3029-3331。
 *
 * 原构造函数中 i(this,"field",val)（Object.defineProperty，[[Define]] 语义）
 * 注入的内联 SVG 图标，改为 class 字段语法（useDefineForClassFields:true，语义一致）。
 * 单字母局部变量已语义化；站点/类别常量 o/r/T/B/P/D/A 改由 ../constants/site 引入。
 */
import {
    currentHref,
    isJavdbSite,
    JAVDB,
    ACTOR,
    ACTRESS,
    CENSORED,
    UNCENSORED
} from '../constants/site';
import {
    EDIT_SVG as editSvg,
    DELETE_SVG as deleteSvg,
    REFRESH_SVG as refreshSvg,
} from '../resources/icons';
import { featureFlags } from '../core/feature-flags';
import { failWithToast } from '../core/toast';
import type { SiteType, PageType } from '../core/page-context';
import type { PluginManager } from './plugin-manager';
import type { PluginMap } from './plugin-registry';

/** 番号/影片信息（getPageInfo / getBoxCarInfo 返回结构） */
interface CarInfo {
    carNum: string | null;
    url: string | null;
    title?: string;
    publishTime?: string | null;
    actress?: string | null;
    actors?: string | null;
}

/** 列表页选择器配置（getSelector 返回结构） */
interface SelectorConfig {
    boxSelector: string;
    itemSelector: string;
    coverImgSelector: string;
    requestDomItemSelector: string;
    nextPageSelector: string;
}

/** 演员详情页信息（getActressPageInfo 返回结构） */
export interface ActressInfo {
    starId: string | null;
    name: string;
    allName: string[];
    role: string;
    movieType: string;
    blacklistUrl: string | null;
}

export class BasePlugin {
    /** 运行时由 PluginManager.register 注入 */
    pluginManager!: PluginManager;

    /**
     * 插件适用的站点列表（Runtime V2）。
     * 空数组 = 所有站点（默认，向后兼容）。
     * 子类覆写以声明站点约束，PluginManager 在注册时过滤。
     */
    get sites(): SiteType[] {
        return [];
    }

    /**
     * 插件适用的页面类型列表（Runtime V2）。
     * 空数组 = 所有页面类型（默认，向后兼容）。
     * 子类覆写以声明页面约束，PluginManager 在 processCss/processPlugins 时过滤。
     */
    get pageTypes(): PageType[] {
        return [];
    }

    /**
     * 插件销毁钩子（Runtime V2）。
     * 子类覆写以清理资源（Observer、定时器、事件监听器）。
     * PluginManager.destroyAll() 时调用。
     */
    destroy(): void {}

    // SVG 图标资源，原样保留自 archetype/jhs.user.js 构造函数 L3034-3071，已提取至 ../resources/icons
    editSvg = editSvg;
    deleteSvg = deleteSvg;
    refreshSvg = refreshSvg;
    /** 子类必须覆写返回插件名，否则抛错。对应原 L3073-3075。 */
    getName(): string {
        throw new Error(`${this.constructor.name} 未显示getName()`);
    }

    /** 委托 PluginManager 按名获取其它插件实例。对应原 L3076-3078。 */
    getBean<K extends string>(name: K): K extends keyof PluginMap ? PluginMap[K] : BasePlugin | undefined {
        return this.pluginManager.getBean(name);
    }

    /** 子类可覆写以注入 CSS；返回空串表示无样式。对应原 L3079-3081。 */
    async initCss(): Promise<string> {
        return '';
    }

    /** 子类可覆写以实现主逻辑。对应原 L3082。 */
    async handle(): Promise<void> {}

    /** 提取当前影片详情页信息（依站点从 DOM 读取番号/演员/日期）。对应原 L3083-3135。 */
    getPageInfo(): CarInfo {
        let carNum: string | null = null;
        let url: string | null = null;
        let actress: string | null = null;
        let actors: string | null = null;
        let publishTime: string | null = null;
        const href = window.location.href;
        if (isJavdbSite) {
            carNum = $('a[title="複製番號"]').attr('data-clipboard-text') ?? null;
            url = href.split('?')[0].split('#')[0];
            actress = $('.female')
                .prev()
                .map((_index: number, el: HTMLElement) => $(el).text())
                .get()
                .join(' ');
            actors = $('.male')
                .prev()
                .map((_index: number, el: HTMLElement) => $(el).text())
                .get()
                .join(' ');
            publishTime = $('strong:contains("日期:")')
                .parent('.panel-block')
                .find('.value')
                .text()
                .trim();
        }
        return { carNum, url, actress, actors, publishTime };
    }

    /** 从 currentHref 匹配 /actors/<id>；未匹配返回 null。对应原 L3136-3143。 */
    getActressId(): string | null {
        const match = currentHref.match(/\/actors\/([^/?]+)/);
        if (match && match.length > 1) {
            return match[1];
        } else {
            return null;
        }
    }

    /** 提取演员详情页信息（姓名/角色/影片类型/黑名单URL）。对应原 L3144-3208。 */
    getActressPageInfo(): ActressInfo {
        const href = window.location.href;
        if (!href.includes('/actors/') && !href.includes('/star/')) {
            throw new Error('接口调用错误, 非演员详情页');
        }
        const allName: string[] = [];
        const nameEl = $('.actor-section-name');
        if (nameEl.length) {
            nameEl
                .text()
                .trim()
                .split(',')
                .forEach((part: string) => {
                    allName.push(part.trim());
                });
        }
        const metaEl = $(".section-meta:not(:contains('影片'))");
        if (metaEl.length) {
            metaEl
                .text()
                .trim()
                .split(',')
                .forEach((part: string) => {
                    allName.push(part.trim());
                });
        }
        const role = $(".section-meta:contains('男優')").length > 0 ? ACTOR : ACTRESS;
        let movieType: string = CENSORED;
        if (allName.some((part: string) => part.includes('無碼'))) {
            movieType = UNCENSORED;
        }
        if (href.includes('uncensored')) {
            movieType = UNCENSORED;
        }
        let blacklistUrl: string | null = null;
        let starId: string | null = null;
        const urlObj = new URL(href);
        if (isJavdbSite) {
            starId =
                urlObj.pathname
                    .split('/')
                    .filter((seg: string) => seg.trim() !== '')
                    .pop() ?? null;
            const searchParams = urlObj.searchParams;
            searchParams.delete('sort_type');
            searchParams.delete('page');
            blacklistUrl = urlObj.toString();
        }
        return {
            starId,
            name: allName[0],
            allName,
            role,
            movieType,
            blacklistUrl
        };
    }

    /** 取列表页 DOM 选择器配置（默认 javdb）。对应原 L3209-3224。 */
    getSelector(siteType?: string): SelectorConfig {
        const type = siteType || JAVDB;
        const selectors: Record<string, SelectorConfig> = {
            javdb: {
                boxSelector: '.movie-list',
                itemSelector: '.movie-list .item',
                coverImgSelector: '.cover img',
                requestDomItemSelector: '.movie-list .item',
                nextPageSelector: '.pagination-next'
            }
        };
        if (!type || !selectors[type]) {
            throw new Error('类型错误: 无法确定选择器类型 (JavDb)');
        }
        return selectors[type];
    }

    /** 从影片 URL 解析影片 ID（取最后一段并去掉 query/hash）。对应原 L3225-3227。 */
    parseMovieId(url: string): string {
        return url.split('/').pop()!.split(/[?#]/)[0];
    }

    /** 从单个影片卡片元素提取番号信息；carNum 为空时抛错。对应原 L3228-3282。 */
    getBoxCarInfo(boxEl: JQuery): CarInfo {
        let titleAttr: string | undefined;
        let imgTitleAttr: string | undefined;
        let dataTitleAttr: string | undefined;
        const linkEl = boxEl.find('a');
        const url = linkEl.attr('href');
        let carNum: string | null = null;
        let title: string | null | undefined = null;
        let publishTime: string | null | undefined = null;
        const videoTitleEl = boxEl.find('.video-title');
        if (videoTitleEl.length > 0) {
            const strongEl = videoTitleEl.find('strong');
            if (strongEl.length > 0) {
                carNum = strongEl.text().trim();
            }
            title = (titleAttr = linkEl.attr('title')) == null ? undefined : titleAttr.trim();
            if (!title) {
                const text = videoTitleEl.text().trim();
                title = carNum && text.includes(carNum) ? text.replace(carNum, '').trim() : text;
            }
            publishTime = boxEl.find('.meta').text().trim();
        }
        if (!carNum) {
            const imgEl = boxEl.find('img');
            if (imgEl.length > 0) {
                title =
                    ((imgTitleAttr = imgEl.attr('title')) == null
                        ? undefined
                        : imgTitleAttr.trim()) ||
                    ((dataTitleAttr = imgEl.attr('data-title')) == null
                        ? undefined
                        : dataTitleAttr.trim());
            }
            const dates: string[] = boxEl
                .find('date')
                .map((_index: number, el: HTMLElement) => $(el).text().trim())
                .get();
            const isDate = (val: string) => /^\d{4}-\d{1,2}-\d{1,2}$/.test(val);
            publishTime = dates.find(isDate) || null;
            carNum = dates.find((val: string) => !isDate(val)) || null;
        }
        if (!carNum) {
            const msg = '提取番号信息失败: carNum 为空';
            clog.error('Error in getBoxCarInfo:', msg, 'Box Element:', boxEl.get(0));
            failWithToast(msg);
        }
        if (featureFlags.westernCarFormat) {
            carNum = this._formatWesternCar(carNum, publishTime || '');
        }
        return {
            carNum,
            url: url || '',
            title: title || '',
            publishTime: publishTime || ''
        };
    }

    /**
     * 西方番号格式化：纯字母 carNum + 日期 → carNum.YY.MM.DD。
     * @param carNum 原始番号
     * @param rawDate 发布时间文本
     */
    _formatWesternCar(carNum: string, rawDate: string): string {
        if (!carNum || !rawDate) return carNum;
        if (!/^[a-zA-Z\s]+$/.test(carNum)) return carNum;
        const dateMatch = rawDate.match(/\d{2}(\d{2})-(\d{2})-(\d{2})/);
        if (dateMatch) {
            return `${carNum.replace(/\s+/g, '')}.${dateMatch[1]}.${dateMatch[2]}.${dateMatch[3]}`;
        }
        return carNum;
    }

    /** 提取当前列表页所有影片卡片的番号信息。对应原 L3283-3305。 */
    getBoxCarInfoList(boxEls: JQuery | null = null): CarInfo[] {
        boxEls ||= $(this.getSelector().itemSelector);
        if (boxEls.length === 0) {
            clog.error('获取当前列表页所有item的番号信息失败!');
            return [];
        }
        const list: CarInfo[] = [];
        boxEls.each((index: number, element: HTMLElement) => {
            const itemEl = $(element);
            try {
                const info = this.getBoxCarInfo(itemEl);
                list.push(info);
            } catch (err: unknown) {
                clog.error(
                    '[getBoxCarInfoList] 提取单个 boxCar 信息失败:',
                    err instanceof Error ? err.message : String(err),
                    '元素索引:',
                    index
                );
            }
        });
        return list;
    }

    /** 检测新页番号在已加载页中的重复比例（≥50%），用于发现分页被限制。对应原 L3306-3330。
     *  原逻辑为"连续≥2个重复"即判定，但加载大量页后已加载番号集合极大，
     *  个别番号碰巧连续重复易误判。改为重复比例≥50%才判定页码受限
     *  （JavDB 返回重复内容时大部分番号会重复）。 */
    checkDuplicateCarNumbers(list: CarInfo[], other: CarInfo[]): boolean {
        if (!list || list.length === 0 || !other || other.length === 0) {
            return false;
        }
        const existing = new Set(list.map((item) => item.carNum).filter(Boolean));
        if (existing.size === 0) {
            return false;
        }
        let duplicateCount = 0;
        for (const item of other) {
            if (item && item.carNum && existing.has(item.carNum)) {
                duplicateCount++;
            }
        }
        if (duplicateCount / other.length >= 0.5) {
            clog.warn('警告: 检测到大量番号信息重复, 该类别可能已被限制页码。');
            return true;
        }
        return false;
    }
}
