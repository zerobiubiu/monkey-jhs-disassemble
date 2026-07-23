/**
 * 预览视频插件 PreviewVideoPlugin —— 对应原脚本 archetype/jhs.user.js L3369-3836。
 *
 * 在影片详情页解析 DMM 预告片（DMM ItemList API 搜索番号 → HTML5 播放页提取
 * 多画质 .mp4 链接），按用户期望画质切换/预加载预览视频，并为播放器底部
 * 注入画质切换、屏蔽/收藏/快进按钮工具栏；支持 localStorage 缓存解析结果、
 * 静音状态持久化、自动播放与画廊直跳。
 *
 * 单字母局部变量（原 e/t/n/a/i/s/o/r/l/c/h/g/d 等）已语义化：
 *   selectAvailableVideoQuality: available / desired / availableSet / descending / quality
 *   _checkCache: rawCache / cache
 *   _updateCache: rawCache / cache
 *   _searchContentIds: carNum / noHyphen / candidates / candidate / keyword / name /
 *     keywordLower / apiUrl / response / matched / item / contentId / makerProduct /
 *     $fanzaBtn / siteUrl / linkType / rawOther / otherSiteCache
 *   _extractTrailerLinks: contentId / serviceCode / floorCode / playerUrl / html /
 *     argsMatch / bitrates / videoMap / qualityPattern / qualityRegex / item / src /
 *     qualityMatch / quality
 *   fetchVideo: cached / contentIds / carNumLower / videoMap / errors / firstMsg / $fanzaBtn
 *   fetchDmmPreviewVideo: carNum / showErrorMessages
 *   handle: settings / $container / href
 *   initDmm: videoMap / desiredQuality / videoUrl / $video / videoEl / isHidden /
 *     currentTime / coverSrc
 *   handleVideo: $video / $videoWrap / videoEl / mutedStored / carNum / videoMap /
 *     $toolbar / $qualityGroup / currentQuality / desiredQuality / currentUrl /
 *     $actionGroup / $filterBtn / $favoriteBtn / $speedBtn / $btn / src
 *
 * 顶层闭包常量映射：
 *   o（window.location.href）→ currentHref（../constants/site，模块加载时求值）
 *   _（"yes"）→ YES、C（"no"）→ NO（../constants/status）
 *   L（画质清单）→ VIDEO_QUALITY_LIST（../constants/video-quality）
 * window.isDetailPage 为运行时由启动序列（archetype L11529）挂载到 window 的全局，
 * 此处以 (window as any).isDetailPage 访问，保持原逻辑并满足 strict 类型检查。
 * Promise.any 为 ES2021 API，而 tsconfig lib 为 ES2020，故以 (Promise as any).any
 * 规避类型检查，运行时行为与原脚本一致（现代浏览器均原生支持）。
 * $ / utils / storageManager / show / clog / gmHttp 已由 ../types/globals.d.ts 声明 any；
 * 因 $ 为 any，jQuery 链式结果均为 any，故局部常量仅以 :string/:number 等标注意图，
 * DOM 元素（$video[0] 等）不额外断言为 HTMLVideoElement——any 链式调用即可满足。
 * 内联 HTML（画质按钮、操作按钮、预览封面入口、多结果角标）已提取为组件
 * （PreviewVideoQualityBtn / PreviewVideoActionBtn / PreviewVideoContainer / SiteResultTag）；
 * 工具栏/分组容器仍为 $("<div></div>") 空元素创建（非模板注入，保留）。
 */
import { currentHref } from '../constants/site';
import { YES, NO } from '../constants/status';
import { VIDEO_QUALITY_LIST } from '../constants/video-quality';
import { BasePlugin } from './base-plugin';
import { PreviewVideoActionBtn } from '../components/preview-video/preview-video-action-btn';
import { PreviewVideoQualityBtn } from '../components/preview-video/preview-video-quality-btn';
import { PreviewVideoContainer } from '../components/preview-video/preview-video-container';
import { SiteResultTag } from '../components/other-site/site-result-tag';
import { jsxToString } from '../core/jsx-to-string';
import previewVideoCssRaw from '../styles/preview-video-plugin.css?raw';

/** DMM 预览视频映射的 localStorage 缓存键。对应原 L3385。 */
const DMM_VIDEO_CACHE_KEY = 'jhs_dmm_video';

/** DMM「其它站点」记录（番号 → 跳转类型/URL）的 localStorage 键。对应原 L3491。 */
const DMM_OTHER_SITE_KEY = 'jhs_other_site_dmm';

/** 预览视频静音状态的 localStorage 键。对应原 L3737/3742。 */
const VIDEO_MUTED_KEY = 'jhs_videoMuted';

/** 画质 → 预览视频 URL 映射。 */
type QualityVideoMap = Record<string, string>;

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
 * 从可用画质集合中选择最接近期望的画质。对应原 L3369-3384。
 *
 * 优先返回期望画质；若不可用，按 VIDEO_QUALITY_LIST 降序找首个可用；
 * 仍无匹配则回退到首个可用画质；集合为空返回 null。
 *
 * @param available 可用画质列表（通常为 Object.keys(videoMap)）。
 * @param desired   用户期望画质（storageManager.getSetting("videoQuality")）。
 * @returns         命中的画质字符串；无任何可用画质时为 null。
 */
export const selectAvailableVideoQuality = (available: string[], desired: string): string | null => {
    if (!available || available.length === 0) {
        return null;
    }
    const availableSet = new Set(available);
    if (availableSet.has(desired)) {
        return desired;
    }
    const descending = VIDEO_QUALITY_LIST.map((opt) => opt.quality).reverse();
    for (const quality of descending) {
        if (availableSet.has(quality)) {
            return quality;
        }
    }
    return available[0];
};

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

/**
 * 预览视频插件 —— 在详情页解析 DMM 预告片、切换/预加载画质、注入播放器工具栏。
 * 对应原 L3633-3836。
 */
export class PreviewVideoPlugin extends BasePlugin {
    /** 返回插件名，供 PluginManager 注册去重。对应原 L3634-3636。 */
    getName(): string {
        return 'PreviewVideoPlugin';
    }

    /**
     * 注入预览视频控制按钮内联样式。对应原 L3637-3639。
     *
     * @returns Promise<string>（CSS 文本）；不抛出异常。
     */
    async initCss(): Promise<string> {
        return previewVideoCssRaw;
    }

    /**
     * 详情页主处理：绑定预览视频点击、按设置预加载 DMM、处理画廊/自动播放跳转。
     * 对应原 L3640-3678。
     *
     * 仅当 (window as any).isDetailPage 为真时执行；监听 .preview-video-container
     * 点击并在 fancybox 内 #preview-video 出现后调用 handleVideo；若启用预加载
     * 且非 autoPlay 链接则调用 initDmm；gallery-1/2 链接直接探测并 handleVideo；
     * autoPlay=1 自动触发首个容器点击。
     *
     * @returns Promise<void>；不抛出异常（内部错误均被 catch 或 .then() 吞掉）。
     */
    async handle(): Promise<void> {
        if (!(window as unknown as Record<string, unknown>).isDetailPage) {
            return;
        }
        const $container = $('.preview-video-container');
        $container.on('click', () => {
            utils.loopDetector(
                () => $('.fancybox-content #preview-video').length > 0,
                () => {
                    this.handleVideo().then();
                }
            );
        });
        if (!currentHref.includes('autoPlay=1')) {
            this.initDmm().then();
        }
        const href = window.location.href;
        if (href.includes('gallery-1') || href.includes('gallery-2')) {
            utils.loopDetector(
                () => $('.fancybox-content #preview-video').length > 0,
                () => {
                    if ($('.fancybox-content #preview-video').length > 0) {
                        this.handleVideo().then();
                    }
                }
            );
        }
        if (href.includes('autoPlay=1') && $container.length > 0) {
            $container[0].click();
        }
    }

    /**
     * 预加载 DMM 预览视频并按期望画质切换/补建播放元素。对应原 L3679-3723。
     *
     * 解析失败静默 clog.error；成功后若已存在 #preview-video 则在播放器已
     * 手动打开时变更 src 并续播进度，否则用封面图新建 .preview-video-container
     * 并绑定点击→handleVideo。
     *
     * @returns Promise<void>；不抛出异常。
     */
    async initDmm(): Promise<void> {
        try {
            const videoMap = await fetchDmmPreviewVideo(this.getPageInfo().carNum as string, false);
            if (!videoMap) {
                return;
            }
            const desiredQuality = await storageManager.getSetting('videoQuality');
            clog.debug('解析其它画质预览视频', '设置-期望画质', desiredQuality);
            const videoUrl =
                videoMap[
                    selectAvailableVideoQuality(Object.keys(videoMap), desiredQuality) as string
                ];
            clog.log('切换其它画质预览视频: ', videoUrl);
            const $video = $('#preview-video');
            const videoEl = $video.length ? ($video[0] as HTMLVideoElement) : null;
            const isHidden = !videoEl || utils.isHidden($video);
            if ($video.length) {
                if (videoEl) {
                    const currentTime = videoEl.currentTime;
                    $video.attr('src', videoUrl);
                    if (!isHidden) {
                        clog.debug('播放器已手动打开, 变更进度条');
                        videoEl.currentTime = currentTime;
                        videoEl.play();
                    }
                }
            } else {
                clog.debug('JavDB没有视频播放元素, 开始创建...');
                const coverSrc = $('.column-video-cover img').attr('src');
                $('.preview-images').prepend(
                    jsxToString(<PreviewVideoContainer coverSrc={coverSrc ?? ''} />)
                );
                $('.preview-video-container').on('click', () => {
                    utils.loopDetector(
                        () => $('.fancybox-content #preview-video').length > 0,
                        async () => {
                            await this.handleVideo();
                        }
                    );
                });
            }
        } catch (err) {
            clog.error('预加载dmm失败:', err);
        }
    }

    /**
     * 在 fancybox 内 #preview-video 出现后注入底部工具栏并绑定画质/动作按钮。
     * 对应原 L3724-3835。
     *
     * 若设置禁用预览视频则直接返回；否则读取/切换到 DMM 画质链接，按
     * VIDEO_QUALITY_LIST 渲染画质按钮（高亮当前），并注入屏蔽/收藏/快进按钮，
     * 快进/屏蔽/收藏分别委托 DetailPageButtonPlugin 的 speedVideo/filterOne/
     * favoriteOne；静音状态持久化到 localStorage。
     *
     * @returns Promise<void>；不抛出异常（画质切换失败仅 console.error）。
     */
    async handleVideo(): Promise<void> {
        const $video = $('#preview-video');
        if (!$video.length) {
            return;
        }
        const $videoWrap = $video.parent();
        $videoWrap.css('position', 'relative');
        const videoEl = $video[0] as HTMLVideoElement;
        const mutedStored = localStorage.getItem(VIDEO_MUTED_KEY);
        if (mutedStored) {
            videoEl.muted = mutedStored === YES;
        }
        videoEl.addEventListener('volumechange', () => {
            localStorage.setItem(VIDEO_MUTED_KEY, videoEl.muted ? YES : NO);
        });
        videoEl.play();
        const carNum = this.getPageInfo().carNum as string;
        const videoMap = await fetchDmmPreviewVideo(carNum);
        const $toolbar = $('<div></div>').attr('id', 'video-bottom-toolbar').css({
            display: 'flex',
            gap: '5px',
            'align-items': 'center',
            'flex-wrap': 'wrap'
        });
        const $qualityGroup = $('<div></div>').css({
            display: 'flex',
            gap: '5px',
            'align-items': 'center'
        });
        let currentQuality: string | null = null;
        if (videoMap) {
            const desiredQuality = await storageManager.getSetting('videoQuality');
            currentQuality = selectAvailableVideoQuality(Object.keys(videoMap), desiredQuality);
            const currentUrl = videoMap[currentQuality as string];
            if ($video.attr('src') !== currentUrl) {
                $video.attr('src', currentUrl);
                videoEl.load();
                videoEl.play();
            }
            VIDEO_QUALITY_LIST.forEach((opt) => {
                const src = videoMap[opt.quality];
                if (src) {
                    const isActive = currentQuality === opt.quality;
                    const $btn = $(
                        jsxToString(
                            <PreviewVideoQualityBtn opt={opt} src={src} isActive={isActive} />
                        )
                    );
                    $qualityGroup.append($btn);
                }
            });
        }
        $toolbar.append($qualityGroup);
        const $actionGroup = $('<div></div>').css({
            display: 'flex',
            gap: '5px',
            'align-items': 'center',
            'margin-left': 'auto'
        });
        const $filterBtn = $(
            jsxToString(
                <PreviewVideoActionBtn id="video-filterBtn" color="#de3333" label="屏蔽" />
            )
        );
        $actionGroup.append($filterBtn);
        const $favoriteBtn = $(
            jsxToString(
                <PreviewVideoActionBtn id="video-favoriteBtn" color="#25b1dc" label="收藏" />
            )
        );
        $actionGroup.append($favoriteBtn);
        const $speedBtn = $(
            jsxToString(<PreviewVideoActionBtn id="speed-btn" color="#76b45d" label="快进" />)
        );
        $actionGroup.append($speedBtn);
        $toolbar.append($actionGroup);
        $videoWrap.append($toolbar);
        $toolbar.on('click', '.video-control-btn', async (event: Event) => {
            const $btn = $(event.currentTarget);
            const src = $btn.data('video-src');
            if (!$btn.hasClass('active')) {
                try {
                    const currentTime = videoEl.currentTime;
                    $video.attr('src', src);
                    videoEl.load();
                    videoEl.currentTime = currentTime;
                    await videoEl.play();
                    $toolbar.find('.video-control-btn').removeClass('active').css({
                        'background-color': '#fff',
                        color: 'black'
                    });
                    $btn.addClass('active').css({
                        'background-color': '#007bff',
                        color: 'white'
                    });
                } catch (err) {
                    console.error('切换画质失败:', err);
                }
            }
        });
        $('#speed-btn').on('click', () => {
            this.getBean('DetailPageButtonPlugin').speedVideo();
        });
        utils.rightClick(document.body, '#speed-btn', (event: MouseEvent) => {
            this.getBean('DetailPageButtonPlugin').filterOne(event);
        });
        $('#video-filterBtn').on('click', (event: Event) => {
            this.getBean('DetailPageButtonPlugin').filterOne(event as MouseEvent);
        });
        $('#video-favoriteBtn').on('click', () => {
            this.getBean('DetailPageButtonPlugin').favoriteOne();
        });
    }
}
