/**
 * DMM 预览视频解析器（提取自 preview-video-plugin.tsx）。对应原 L3386-3632。
 *
 * 按 carNum 调用 DMM ItemList API 搜索候选 contentId，再并发请求各候选的
 * HTML5 播放页，从 `const args = ...` 脚本中解析 bitrates 数组，匹配
 * VIDEO_QUALITY_LIST 内的画质 .mp4 链接，返回画质 → URL 映射。
 * 结果按番号缓存到 localStorage；失败时回退设置 #fanzaBtn 为搜索页跳转。
 */
import { VIDEO_QUALITY_LIST } from '../../constants/video-quality';

import { jsxToString } from '../../core/jsx-to-string';

import { SiteResultTag } from '../../components/other-site/site-result-tag';

/** DMM 预览视频映射的 localStorage 缓存键。对应原 L3385。 */
const DMM_VIDEO_CACHE_KEY = 'jhs_dmm_video';

/** DMM「其它站点」记录（番号 → 跳转类型/URL）的 localStorage 键。对应原 L3491。 */
const DMM_OTHER_SITE_KEY = 'jhs_other_site_dmm';

/** 画质 → 预览视频 URL 映射。 */
export type QualityVideoMap = Record<string, string>;

/** 经 DMM API 筛选后的内容标识，用于提取预告片播放页链接。 */
interface DmmContentId {
    serviceCode: string;
    floorCode: string;
    contentId: string;
    pageUrl: string;
}

/** _searchContentIds 的关键词候选项。 */
interface KeywordCandidate {
    keyword: string;
    name: string;
}

/**
 * DMM 预览视频解析器。对应原 L3386-3630。
 *
 * 按 carNum 调用 DMM ItemList API 搜索候选 contentId，再并发请求各候选的
 * HTML5 播放页，从 `const args = ...` 脚本中解析 bitrates 数组，匹配
 * VIDEO_QUALITY_LIST 内的画质 .mp4 链接，返回画质 → URL 映射。
 * 结果按番号缓存到 localStorage；失败时回退设置 #fanzaBtn 为搜索页跳转。
 */
class DmmPreviewVideoResolver {
    /** 当前影片番号。 */
    carNum: string;
    /** 是否在失败时弹出 show.error 提示。 */
    showErrorMessages: boolean;

    /**
     * @param carNum             影片番号。
     * @param showErrorMessages  失败时是否弹出用户可见错误（默认 true）。
     */
    constructor(carNum: string, showErrorMessages = true) {
        this.carNum = carNum;
        this.showErrorMessages = showErrorMessages;
    }

    /**
     * 读取缓存中本番号的预览视频映射。对应原 L3391-3401。
     *
     * @returns 缓存命中返回画质 → URL 映射；未命中返回 null。
     */
    _checkCache(): QualityVideoMap | null {
        const rawCache = localStorage.getItem(DMM_VIDEO_CACHE_KEY);
        const cache: Record<string, QualityVideoMap> = rawCache ? JSON.parse(rawCache) : {};
        if (cache[this.carNum]) {
            clog.debug('缓存中存在预览视频信息', cache[this.carNum]);
            return cache[this.carNum];
        }
        return null;
    }

    /**
     * 写入本番号的预览视频映射到缓存。对应原 L3402-3409。
     *
     * @param videoMap 画质 → URL 映射。
     */
    _updateCache(videoMap: QualityVideoMap): void {
        const rawCache = localStorage.getItem(DMM_VIDEO_CACHE_KEY);
        const cache: Record<string, QualityVideoMap> = rawCache ? JSON.parse(rawCache) : {};
        cache[this.carNum] = videoMap;
        clog.debug('成功解析出预览视频并已缓存:', videoMap);
        localStorage.setItem(DMM_VIDEO_CACHE_KEY, JSON.stringify(cache));
    }

    /**
     * 通过 DMM ItemList API 搜索番号对应的 Content IDs。对应原 L3410-3515。
     *
     * 依次用「00 替换」「原始番号」「无连字符」三种关键词调用 API，对返回
     * items 按 content_id / maker_product 精确匹配，最多收集 2 条候选。
     * 命中时同步更新 #fanzaBtn 跳转与 jhs_other_site_dmm 缓存；全部失败时
     * 将 #fanzaBtn 指向 DMM 搜索页并标红。
     *
     * @returns 候选 DmmContentId 列表；无匹配返回 null。
     */
    async _searchContentIds(): Promise<DmmContentId[] | null> {
        const carNum = this.carNum;
        const noHyphen = carNum.replace(/-/g, '');
        const candidates: KeywordCandidate[] = [
            {
                keyword: carNum.replace('-', '00'),
                name: '00-替换关键词'
            },
            {
                keyword: carNum,
                name: '原始番号关键词'
            },
            {
                keyword: noHyphen,
                name: '无连字符关键词'
            }
        ];
        const carNumLower = carNum.toLowerCase();
        for (const candidate of candidates) {
            const { keyword, name } = candidate;
            const keywordLower = keyword.toLowerCase();
            clog.debug(`--- 尝试使用 ${name} (${keyword}) 进行 API 搜索 ---`);
            const apiUrl = `https://api.dmm.com/affiliate/v3/ItemList?${new URLSearchParams({
                api_id: 'UrwskPfkqQ0DuVry2gYL',
                affiliate_id: '10278-996',
                output: 'json',
                site: 'FANZA',
                sort: 'match',
                keyword: keyword
            }).toString()}`;
            let response: { result: { result_count: number; items: Array<{ content_id?: string; maker_product?: string; service_code?: string; floor_code?: string; URL?: string }> } } | undefined;
            try {
                response = (await gmHttp.get(apiUrl)) as typeof response;
            } catch (err) {
                clog.error(`API 请求失败，跳过 ${name}:`, err);
                continue;
            }
            if (!response || !response.result || !response.result.result_count) {
                clog.debug('API 返回无结果，尝试下一个关键词。');
                continue;
            }
            const matched: DmmContentId[] = [];
            for (const item of response.result.items) {
                if (matched.length >= 2) {
                    break;
                }
                const contentId: string = item.content_id || '';
                const makerProduct: string = item.maker_product || '';
                if (
                    contentId.includes(keywordLower.replace('-', '')) ||
                    carNumLower === makerProduct.toLowerCase() ||
                    contentId.includes(noHyphen.toLowerCase())
                ) {
                    matched.push({
                        serviceCode: item.service_code || '',
                        floorCode: item.floor_code || '',
                        contentId: contentId,
                        pageUrl: item.URL || ''
                    });
                    clog.debug(`[${name}] cid|makerProduct 匹配成功:`, contentId, makerProduct);
                }
            }
            if (matched.length > 0) {
                clog.debug(`--- 成功通过 ${name} 找到 Content IDs ---`);
                const $fanzaBtn = $('#fanzaBtn');
                let siteUrl = `https://www.dmm.co.jp/search/=/searchstr=${keyword}`;
                let linkType = 'single';
                if (matched.length > 1) {
                    $fanzaBtn.attr('href', siteUrl);
                    $fanzaBtn.append(jsxToString(<SiteResultTag />));
                    $fanzaBtn.css('backgroundColor', '#7bc73b');
                    linkType = 'multiple';
                } else {
                    siteUrl = matched[0].pageUrl;
                    $fanzaBtn.attr('href', siteUrl);
                    $fanzaBtn.css('backgroundColor', '#7bc73b');
                }
                const rawOther = localStorage.getItem(DMM_OTHER_SITE_KEY);
                const otherSiteCache: Record<string, { type: string; url: string }> = rawOther
                    ? JSON.parse(rawOther)
                    : {};
                otherSiteCache[this.carNum] = {
                    type: linkType,
                    url: siteUrl
                };
                localStorage.setItem(DMM_OTHER_SITE_KEY, JSON.stringify(otherSiteCache));
                return matched;
            }
            clog.debug(
                `[${name}] API 返回结果数 ${response.result.result_count}，但无精确匹配的 Content ID。`
            );
        }
        clog.warn('所有关键词尝试均未找到匹配的Content ID, 解析Dmm视频失败');
        const $fanzaBtn = $('#fanzaBtn');
        $fanzaBtn.attr('href', `https://www.dmm.co.jp/search/=/searchstr=${this.carNum}`);
        $fanzaBtn.attr('title', '未查询到, 点击前往搜索页');
        $fanzaBtn.css('backgroundColor', '#de3333');
        return null;
    }

    /**
     * 从 DMM HTML5 播放页提取画质 → 视频 URL 映射。对应原 L3516-3567。
     *
     * 请求播放页 HTML（带年龄校验 Cookie），从中解析 `const args = {...};`
     * 的 bitrates 数组，按 VIDEO_QUALITY_LIST 的画质正则匹配 .mp4 链接。
     *
     * @param content DMM 内容标识（contentId/serviceCode/floorCode）。
     * @returns 画质 → URL 映射。
     * @throws {Error} 节点不可用（地域限制）、未找到 const args、JSON 解析失败、
     *                 bitrates 非数组、无匹配画质链接时抛出。
     */
    async _extractTrailerLinks({
        contentId,
        serviceCode,
        floorCode
    }: DmmContentId): Promise<QualityVideoMap> {
        const playerUrl = `https://www.dmm.co.jp/service/digitalapi/-/html5_player/=/cid=${contentId}/mtype=AhRVShI_/service=${serviceCode}/floor=${floorCode}/mode=/`;
        const html = await gmHttp.get(playerUrl, undefined, {
            'accept-language': 'ja-JP,ja;q=0.9',
            Cookie: 'age_check_done=1'
        });
        if (typeof html != 'string') {
            clog.error(html);
            throw new Error('解析播放页内容失败, 非文本内容');
        }
        if (html.includes('このサービスはお住まいの地域からは')) {
            throw new Error('节点不可用，请将DMM域名分流到日本ip');
        }
        const argsMatch = html.match(/const\s+args\s+=\s+(.*);/);
        if (!argsMatch) {
            throw new Error('未在脚本中找到 const args = ... 变量');
        }
        let bitrates: unknown;
        try {
            ({ bitrates } = JSON.parse(argsMatch[1]));
        } catch (err) {
            throw new Error(`解析播放器脚本 JSON 失败: ${(err as Error).message}`);
        }
        const videoMap: QualityVideoMap = {};
        const qualityPattern = VIDEO_QUALITY_LIST.map((opt) => opt.quality).join('|');
        const qualityRegex = new RegExp(`(${qualityPattern})\\.mp4$`);
        if (!Array.isArray(bitrates)) {
            clog.error('解析画质链接失败: bitrates 字段不是一个数组或不存在');
            throw new Error('解析画质链接失败: bitrates 字段不是一个数组或不存在');
        }
        clog.debug('原始数据返回:', bitrates);
        for (const item of bitrates) {
            const src = item == null ? undefined : item.src;
            if (!src || typeof src != 'string' || !src.endsWith('.mp4')) {
                continue;
            }
            const qualityMatch = src.match(qualityRegex);
            let quality = '';
            if (qualityMatch && qualityMatch[1]) {
                quality = qualityMatch[1];
            }
            if (quality && !videoMap[quality]) {
                videoMap[quality] = src;
            }
        }
        if (Object.keys(videoMap).length === 0) {
            throw new Error('未找到匹配要求的预览画质视频');
        }
        return videoMap;
    }

    /**
     * 解析并返回本番号的预览视频映射（含缓存与错误处理）。对应原 L3568-3629。
     *
     * 先查缓存；再按 carNum 排除无码/VR 类型后调用 _searchContentIds；
     * 对候选并发执行 _extractTrailerLinks（Promise.any 取首个成功），
     * 成功则缓存并返回；失败按错误类型提示并将 #fanzaBtn 回退为搜索页。
     *
     * @returns 画质 → URL 映射；无结果或失败返回 null。
     */
    async fetchVideo(): Promise<QualityVideoMap | null> {
        const cached = this._checkCache();
        if (cached) {
            return cached;
        }
        let contentIds: DmmContentId[] | null;
        try {
            const carNumLower = this.carNum.toLowerCase();
            if (
                carNumLower.startsWith('heyzo') ||
                /^(n\d+|\d+(-\d+)*)$/.test(carNumLower) ||
                /^n\d+$/.test(carNumLower)
            ) {
                throw new Error('无码番号类型, 取消dmm解析');
            }
            if (this.carNum.includes('VR-')) {
                throw new Error('VR类型, 取消dmm解析');
            }
            contentIds = await this._searchContentIds();
        } catch (err) {
            clog.error('DMM API 搜索失败:', err);
            const $fanzaBtn = $('#fanzaBtn');
            $fanzaBtn.attr('href', `https://www.dmm.co.jp/search/=/searchstr=${this.carNum}`);
            $fanzaBtn.attr('title', '未查询到, 点击前往搜索页');
            $fanzaBtn.css('backgroundColor', '#de3333');
            return null;
        }
        if (!contentIds || contentIds.length === 0) {
            return null;
        }
        try {
            // Promise.any 为 ES2021 API，tsconfig lib 为 ES2020，以 as any 规避类型检查。
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const videoMap = await (Promise as any).any(
                contentIds.map((id) => this._extractTrailerLinks(id))
            );
            this._updateCache(videoMap);
            return videoMap;
        } catch (err) {
            const errors: unknown[] =
                err && typeof err === 'object' && 'errors' in err && Array.isArray(err.errors)
                    ? err.errors
                    : [err];
            if (errors.some((e) => e instanceof Error && e.message.includes('节点不可用'))) {
                if (this.showErrorMessages) {
                    show.error('节点不可用，请将DMM域名分流到日本ip');
                }
            } else {
                const first = errors[0];
                const firstMsg = first instanceof Error && first.message ? first.message : first;
                clog.error(`解析失败: ${firstMsg}`, errors);
                if (this.showErrorMessages) {
                    show.error(`解析失败: ${firstMsg}`);
                }
            }
            const $fanzaBtn = $('#fanzaBtn');
            $fanzaBtn.attr('href', `https://www.dmm.co.jp/search/=/searchstr=${this.carNum}`);
            $fanzaBtn.attr('title', '未查询到, 点击前往搜索页');
            $fanzaBtn.css('backgroundColor', '#de3333');
            return null;
        }
    }
}

/**
 * 解析并返回指定番号的 DMM 预览视频映射。对应原 L3631-3632。
 *
 * @param carNum             影片番号。
 * @param showErrorMessages  失败时是否弹出用户可见错误（默认 true）。
 * @returns 画质 → URL 映射；无结果或失败返回 null。
 */
export const fetchDmmPreviewVideo = async (
    carNum: string,
    showErrorMessages = true
): Promise<QualityVideoMap | null> =>
    new DmmPreviewVideoResolver(carNum, showErrorMessages).fetchVideo();
