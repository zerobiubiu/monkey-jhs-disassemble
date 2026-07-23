/**
 * 预览视频插件 PreviewVideoPlugin —— 对应原脚本 archetype/jhs.user.js L3369-3836。
 *
 * 在影片详情页解析 DMM 预告片（DMM ItemList API 搜索番号 → HTML5 播放页提取
 * 多画质 .mp4 链接），按用户期望画质切换/预加载预览视频，并为播放器底部
 * 注入画质切换、屏蔽/收藏/快进按钮工具栏；支持 localStorage 缓存解析结果、
 * 静音状态持久化、自动播放与画廊直跳。
 *
 * 已提取模块：
 *   - preview-video/dmm-resolver.tsx：DmmPreviewVideoResolver + fetchDmmPreviewVideo
 *   - preview-video/quality-selector.ts：selectAvailableVideoQuality
 *   - preview-video/video-toolbar.tsx：buildVideoToolbar（工具栏构建 + 事件绑定）
 *
 * window.isDetailPage 为运行时由启动序列（archetype L11529）挂载到 window 的全局，
 * 此处以 (window as any).isDetailPage 访问，保持原逻辑并满足 strict 类型检查。
 * $ / utils / storageManager / show / clog / gmHttp 已由 ../types/globals.d.ts 声明 any。
 */
import { currentHref } from '../constants/site';

import { jsxToString } from '../core/jsx-to-string';

import { BasePlugin } from './base-plugin';
import { fetchDmmPreviewVideo } from './preview-video/dmm-resolver';
import { selectAvailableVideoQuality } from './preview-video/quality-selector';
import { buildVideoToolbar } from './preview-video/video-toolbar';

import { PreviewVideoContainer } from '../components/preview-video/preview-video-container';

import previewVideoCssRaw from '../styles/preview-video-plugin.css?raw';

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
     * 对应原 L3724-3835。委托 preview-video/video-toolbar.tsx 的 buildVideoToolbar。
     *
     * @returns Promise<void>；不抛出异常（画质切换失败仅 console.error）。
     */
    async handleVideo(): Promise<void> {
        await buildVideoToolbar(this);
    }
}
